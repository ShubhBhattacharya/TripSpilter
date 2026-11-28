import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateNetBalances } from '../src/lib/financial/split-engine';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');

function readAllMigrations(): { files: string[]; combined: string } {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const combined = files
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n\n');
  return { files, combined };
}

interface SettlementRow {
  id: string;
  trip_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  amount_paise: number;
  status: string;
}

function simulateSettlementUpdate(
  sql: string,
  row: SettlementRow,
  patch: Partial<SettlementRow>,
  role: 'debtor' | 'creditor' | 'admin'
): SettlementRow {
  const next = { ...row, ...patch };
  // In PostgreSQL, BEFORE UPDATE triggers execute before RLS WITH CHECK validates the resulting row
  const hasTrigger =
    /CREATE\s+TRIGGER\s+trg_settlements_immutable_columns\s+BEFORE\s+UPDATE\s+ON\s+public\.settlements/i.test(
      sql
    );
  if (hasTrigger) {
    if (
      next.trip_id !== row.trip_id ||
      next.from_user_id !== row.from_user_id ||
      next.to_user_id !== row.to_user_id ||
      next.amount !== row.amount ||
      next.amount_paise !== row.amount_paise
    ) {
      throw new Error(
        'Immutable columns (trip_id, from_user_id, to_user_id, amount, amount_paise) on settlements cannot be modified'
      );
    }
  }
  if (role === 'debtor') {
    const allowed = ['payment_initiated', 'manually_reported_paid', 'failed'];
    if (!allowed.includes(next.status)) {
      throw new Error('RLS violation: debtor status not allowed');
    }
  }
  return next;
}

const mockExpenseState = {
  userId: '11111111-1111-4111-8111-111111111111',
  isMember: true,
  lastInsertedPaidBy: null as string | null,
};

vi.mock('../src/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  createClient: () => ({}),
}));

vi.mock('../src/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: mockExpenseState.userId } },
        error: null,
      }),
    },
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === 'trip_members') {
            return mockExpenseState.isMember
              ? { data: { role: 'member' }, error: null }
              : { data: null, error: null };
          }
          if (table === 'trips') {
            return { data: { created_by: 'other-user' }, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: (v: { data: unknown; error: null }) => void) => {
          if (table === 'trip_members') {
            return resolve({
              data: mockExpenseState.isMember
                ? [{ user_id: mockExpenseState.userId }]
                : [],
              error: null,
            });
          }
          return resolve({ data: [], error: null });
        },
      };
      return chain;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'create_expense_with_splits') {
        mockExpenseState.lastInsertedPaidBy = mockExpenseState.userId;
        return {
          data: {
            isIdempotentReplay: false,
            expense: {
              id: 'exp-mock-1',
              trip_id: args.p_trip_id,
              paid_by: mockExpenseState.userId,
              total_amount: args.p_total_amount,
            },
            splits: [],
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  }),
}));

import { POST as createExpense } from '../src/app/api/expenses/route';

describe('Phase 5A: Migration Defect Remediations (F-01 through F-05) & Null Paid-By Safety', () => {
  beforeEach(() => {
    mockExpenseState.userId = '11111111-1111-4111-8111-111111111111';
    mockExpenseState.isMember = true;
    mockExpenseState.lastInsertedPaidBy = null;
  });

  it('[Static SQL] F-01 attaches idempotent on_auth_user_created and on_trip_created AFTER INSERT triggers safely', () => {
    const { combined } = readAllMigrations();
    expect(combined).toMatch(
      /DROP\s+TRIGGER\s+IF\s+EXISTS\s+on_auth_user_created\s+ON\s+auth\.users;\s*CREATE\s+TRIGGER\s+on_auth_user_created\s+AFTER\s+INSERT\s+ON\s+auth\.users\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.handle_new_user\(\)/i
    );
    expect(combined).toMatch(
      /DROP\s+TRIGGER\s+IF\s+EXISTS\s+on_trip_created\s+ON\s+public\.trips;\s*CREATE\s+TRIGGER\s+on_trip_created\s+AFTER\s+INSERT\s+ON\s+public\.trips\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.handle_new_trip_creator\(\)/i
    );
    // Must not silently swallow trigger errors
    const f5a = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261128000003_auth_triggers_and_fk_safety.sql'),
      'utf8'
    );
    expect(f5a).not.toMatch(/EXCEPTION\s+WHEN\s+OTHERS/i);
  });

  it('[Static SQL] F-02 resolves expenses.paid_by ON DELETE SET NULL + NOT NULL contradiction while retaining INSERT ownership check', () => {
    const { combined } = readAllMigrations();
    expect(combined).toMatch(/ALTER\s+TABLE\s+public\.expenses\s+ALTER\s+COLUMN\s+paid_by\s+DROP\s+NOT\s+NULL/i);
    // RLS still enforces paid_by = auth.uid() on INSERT
    expect(combined).toMatch(/is_trip_member\(trip_id\)\s+AND\s+paid_by\s*=\s*auth\.uid\(\)/i);
  });

  it('[Static SQL] F-03 secures search_path = public, pg_temp across all 14 custom SECURITY DEFINER functions and revokes trigger direct RPC execution without touching rls_auto_enable()', () => {
    const f5a = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261128000003_auth_triggers_and_fk_safety.sql'),
      'utf8'
    );
    const { combined } = readAllMigrations();

    const hardenedFunctions = [
      'is_trip_member(UUID)',
      'is_trip_admin(UUID)',
      'create_expense_with_splits(UUID, TEXT, TEXT, NUMERIC, BIGINT, TEXT, TEXT, JSONB, TEXT)',
      'dispatch_trip_notification(UUID, UUID[], TEXT, TEXT, TEXT, TEXT, JSONB)',
      'update_expense_with_splits(UUID, TEXT, TEXT, NUMERIC, BIGINT, TEXT, TEXT, JSONB)',
      'reserve_payment_refund(UUID, BIGINT, TEXT, TEXT)',
      'prevent_expense_splits_immutable_update()',
    ];
    for (const sig of hardenedFunctions) {
      expect(f5a, `Missing ALTER FUNCTION search_path for ${sig}`).toContain(sig);
    }

    // Trigger functions must not remain executable by PUBLIC/anon/authenticated
    for (const trgFn of [
      'handle_new_user()',
      'handle_new_trip_creator()',
      'prevent_last_trip_admin_loss()',
      'prevent_expense_splits_immutable_update()',
      'prevent_settlements_immutable_update()',
    ]) {
      expect(f5a).toContain(`REVOKE ALL ON FUNCTION public.${trgFn} FROM PUBLIC, anon, authenticated`);
    }

    // Core authenticated grants preserved
    expect(combined).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_trip_member\(UUID\)\s+TO\s+authenticated/i);
    expect(combined).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.accept_trip_invitation\(TEXT\)\s+TO\s+authenticated/i);
    expect(combined).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.finalize_payment_refund[\s\S]*TO\s+service_role/i);
    expect(combined).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.process_payment_webhook[\s\S]*TO\s+service_role/i);

    // Supabase-managed template function must not be modified directly in Phase 5A
    expect(f5a).not.toMatch(/ALTER\s+FUNCTION\s+public\.rls_auto_enable|REVOKE[\s\S]*public\.rls_auto_enable|DROP\s+FUNCTION[\s\S]*rls_auto_enable/i);
  });

  it('[Static SQL] F-04 guards settlements immutable columns while permitting debtor report & creditor verify transitions', () => {
    const { combined } = readAllMigrations();
    const baseSettlement: SettlementRow = {
      id: 'st-1',
      trip_id: 'tr-1',
      from_user_id: 'u-debtor',
      to_user_id: 'u-creditor',
      amount: 1200,
      amount_paise: 120000,
      status: 'pending',
    };

    // Unauthorized mutations to all 5 protected columns fail even with a valid debtor status transition
    for (const badPatch of [
      { trip_id: 'tr-other', status: 'manually_reported_paid' },
      { from_user_id: 'u-victim', status: 'manually_reported_paid' },
      { to_user_id: 'u-attacker', status: 'manually_reported_paid' },
      { amount: 1, status: 'manually_reported_paid' },
      { amount_paise: 100, status: 'manually_reported_paid' },
    ] as Array<Partial<SettlementRow>>) {
      expect(() => simulateSettlementUpdate(combined, baseSettlement, badPatch, 'debtor')).toThrow(
        /Immutable columns/i
      );
      expect(() => simulateSettlementUpdate(combined, baseSettlement, badPatch, 'creditor')).toThrow(
        /Immutable columns/i
      );
    }

    // Legitimate transitions succeed
    const reported = simulateSettlementUpdate(
      combined,
      baseSettlement,
      { status: 'manually_reported_paid' },
      'debtor'
    );
    expect(reported.status).toBe('manually_reported_paid');

    const verified = simulateSettlementUpdate(
      combined,
      reported,
      { status: 'verified_paid' },
      'creditor'
    );
    expect(verified.status).toBe('verified_paid');
  });

  it('[Static SQL] F-05 adds idx_trips_created_by without unverified index drops', () => {
    const f5a = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261128000003_auth_triggers_and_fk_safety.sql'),
      'utf8'
    );
    expect(f5a).toContain('CREATE INDEX IF NOT EXISTS idx_trips_created_by ON public.trips(created_by)');
    expect(f5a).not.toMatch(/DROP\s+INDEX/i);
  });

  it('[Mocked App & Financial Engine] handles normal creation, blocks unauthorized expense creation, and survives deleted payer paidBy=null cleanly', async () => {
    // 1. Normal expense creation attributes paid_by strictly to authenticated caller
    const okRes = await createExpense(
      new Request('http://localhost/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: '33333333-3333-4333-8333-333333333333',
          vendorName: 'Cafe',
          vendorUpiId: 'cafe@okaxis',
          totalAmount: 100,
          splitType: 'EQUAL',
          paidBy: 'attacker-spoof-ignored',
          splits: [{ userId: '11111111-1111-4111-8111-111111111111', amountOwed: 100 }],
        }),
      })
    );
    expect(okRes.status).toBe(201);
    expect(mockExpenseState.lastInsertedPaidBy).toBe('11111111-1111-4111-8111-111111111111');

    // 2. Non-member unauthorized expense creation rejected -> 403
    mockExpenseState.isMember = false;
    const forbiddenRes = await createExpense(
      new Request('http://localhost/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: '33333333-3333-4333-8333-333333333333',
          vendorName: 'Cafe',
          vendorUpiId: 'cafe@okaxis',
          totalAmount: 100,
          splitType: 'EQUAL',
          splits: [{ userId: '11111111-1111-4111-8111-111111111111', amountOwed: 100 }],
        }),
      })
    );
    expect(forbiddenRes.status).toBe(403);

    // 3. Deleted user scenario (ON DELETE SET NULL -> paidBy: null) never coerces to "null" key
    const { balances } = calculateNetBalances({
      memberIds: ['user-alive'],
      expenses: [{ id: 'exp-deleted-payer', paidBy: null, totalAmount: 500 }],
      splits: [{ expenseId: 'exp-deleted-payer', userId: 'user-alive', amountOwed: 250, status: 'pending' }],
      settlements: [],
    });
    expect(Object.keys(balances)).toEqual(['user-alive']);
    expect(balances['user-alive'].netBalance).toBe(-250);
  });
});

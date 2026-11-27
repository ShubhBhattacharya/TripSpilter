import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

type Role = 'debtor' | 'creditor' | 'service_role';

interface ExpenseSplitRow {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  amount_owed_paise: number;
  status: string;
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');

function loadMigrationsCombined(): string {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n\n');
}

function hasImmutableExpenseSplitsTrigger(sql: string): boolean {
  const triggerRegex =
    /CREATE\s+TRIGGER\s+\w+\s+BEFORE\s+UPDATE\s+ON\s+public\.expense_splits\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+public\.(\w+)\s*\(/i;
  const match = sql.match(triggerRegex);
  if (!match) return false;
  const fnName = match[1];
  const fnRegex = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fnName}\\s*\\([\\s\\S]*?RAISE\\s+EXCEPTION[\\s\\S]*?END;`,
    'i'
  );
  const fnMatch = sql.match(fnRegex);
  if (!fnMatch) return false;
  const body = fnMatch[0];
  // Must protect all four immutable columns unconditionally (not bypassed by role/jwt checks)
  const protectsAllColumns =
    /NEW\.expense_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.expense_id/i.test(body) &&
    /NEW\.user_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.user_id/i.test(body) &&
    /NEW\.amount_owed\s+IS\s+DISTINCT\s+FROM\s+OLD\.amount_owed/i.test(body) &&
    /NEW\.amount_owed_paise\s+IS\s+DISTINCT\s+FROM\s+OLD\.amount_owed_paise/i.test(body);
  const bypassesRole =
    /current_setting\s*\(\s*'request\.jwt\.claim\.role'|auth\.role\s*\(\s*\)|service_role/i.test(body);
  return protectsAllColumns && !bypassesRole;
}

function simulateExpenseSplitsUpdate(
  sql: string,
  row: ExpenseSplitRow,
  patch: Partial<ExpenseSplitRow>,
  actorRole: Role
): ExpenseSplitRow {
  const next: ExpenseSplitRow = { ...row, ...patch };

  // RLS policy check from 20261122_security_hardening.sql
  if (actorRole === 'debtor') {
    const allowedStatuses = ['payment_initiated', 'manually_reported_paid', 'failed'];
    if (!allowedStatuses.includes(next.status)) {
      throw new Error('RLS violation: debtor status not allowed');
    }
  }

  // BEFORE UPDATE trigger (all roles)
  if (hasImmutableExpenseSplitsTrigger(sql)) {
    if (
      next.expense_id !== row.expense_id ||
      next.user_id !== row.user_id ||
      next.amount_owed !== row.amount_owed ||
      next.amount_owed_paise !== row.amount_owed_paise
    ) {
      throw new Error(
        'Immutable columns (expense_id, user_id, amount_owed, amount_owed_paise) on expense_splits cannot be modified'
      );
    }
  }

  return next;
}

describe('Item 1: expense_splits immutable columns BEFORE UPDATE trigger', () => {
  const baseRow: ExpenseSplitRow = {
    id: '11111111-1111-4111-8111-111111111111',
    expense_id: '22222222-2222-4222-8222-222222222222',
    user_id: '33333333-3333-4333-8333-333333333333',
    amount_owed: 1250,
    amount_owed_paise: 125000,
    status: 'pending',
  };

  it('defines a BEFORE UPDATE trigger on public.expense_splits applying to all roles', () => {
    const sql = loadMigrationsCombined();
    expect(hasImmutableExpenseSplitsTrigger(sql)).toBe(true);
  });

  it('blocks a debtor from updating amount_owed or amount_owed_paise', () => {
    const sql = loadMigrationsCombined();
    expect(() =>
      simulateExpenseSplitsUpdate(
        sql,
        baseRow,
        { status: 'manually_reported_paid', amount_owed: 0, amount_owed_paise: 0 },
        'debtor'
      )
    ).toThrow(/Immutable columns/i);
  });

  it('allows a debtor to report manually_reported_paid when amounts and identity stay unchanged', () => {
    const sql = loadMigrationsCombined();
    const updated = simulateExpenseSplitsUpdate(
      sql,
      baseRow,
      { status: 'manually_reported_paid' },
      'debtor'
    );
    expect(updated.status).toBe('manually_reported_paid');
    expect(updated.amount_owed).toBe(1250);
    expect(updated.amount_owed_paise).toBe(125000);
  });

  it('blocks a creditor from updating amount_owed, amount_owed_paise, expense_id, or user_id', () => {
    const sql = loadMigrationsCombined();
    expect(() =>
      simulateExpenseSplitsUpdate(
        sql,
        baseRow,
        { amount_owed: 2500, amount_owed_paise: 250000 },
        'creditor'
      )
    ).toThrow(/Immutable columns/i);
    expect(() =>
      simulateExpenseSplitsUpdate(
        sql,
        baseRow,
        { user_id: '44444444-4444-4444-8444-444444444444' },
        'creditor'
      )
    ).toThrow(/Immutable columns/i);
    expect(() =>
      simulateExpenseSplitsUpdate(
        sql,
        baseRow,
        { expense_id: '55555555-5555-4555-8555-555555555555' },
        'service_role'
      )
    ).toThrow(/Immutable columns/i);
  });
});

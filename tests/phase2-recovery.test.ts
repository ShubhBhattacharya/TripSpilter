import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authMockState = {
  user: null as { id: string; email?: string } | null,
  tripMemberRole: null as 'admin' | 'member' | null,
  tripCreatedBy: '99999999-9999-4999-8999-999999999999',
  savedPrefs: null as Record<string, unknown> | null,
  savedNotifications: [] as Array<Record<string, unknown>>,
};

function makeSupabaseMock() {
  const makeQuery = (table: string) => {
    const filters: Record<string, unknown> = {};
    let mode: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    let payload: Record<string, unknown> = {};

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      insert: (data: Record<string, unknown>) => {
        mode = 'insert';
        payload = data;
        return chain;
      },
      upsert: (data: Record<string, unknown>) => {
        mode = 'upsert';
        payload = data;
        if (table === 'user_preferences') authMockState.savedPrefs = data;
        return chain;
      },
      update: (data: Record<string, unknown>) => {
        mode = 'update';
        payload = data;
        return chain;
      },
      delete: () => {
        mode = 'delete';
        return chain;
      },
      single: async () => {
        if (table === 'trips' && mode === 'insert') {
          return {
            data: { id: '33333333-3333-4333-8333-333333333333', ...payload },
            error: null,
          };
        }
        if (table === 'user_preferences') {
          return { data: authMockState.savedPrefs, error: null };
        }
        return { data: { id: 'row-1', ...payload }, error: null };
      },
      maybeSingle: async () => {
        if (table === 'trip_members') {
          return authMockState.tripMemberRole
            ? { data: { role: authMockState.tripMemberRole }, error: null }
            : { data: null, error: null };
        }
        if (table === 'trips') {
          return { data: { created_by: authMockState.tripCreatedBy }, error: null };
        }
        if (table === 'user_preferences') {
          return { data: authMockState.savedPrefs, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        if (table === 'notifications') {
          if (mode === 'delete') authMockState.savedNotifications = [];
          return resolve({ data: authMockState.savedNotifications, error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  };

  return {
    auth: {
      getUser: async () => ({
        data: { user: authMockState.user },
        error: null,
      }),
    },
    from: (table: string) => makeQuery(table),
  };
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => makeSupabaseMock(),
}));

vi.mock('../src/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  createClient: () => makeSupabaseMock(),
}));

vi.mock('../src/lib/supabase/server', () => ({
  createClient: async () => makeSupabaseMock(),
}));

import { updateSession, isProtectedAppPath } from '../src/lib/supabase/middleware';
import { getServerServiceRoleKey, isValidSupabaseConfig } from '../src/lib/config/env';
import { GET as getTrips, POST as createTrip } from '../src/app/api/trips/route';
import { GET as getExpenses } from '../src/app/api/expenses/route';
import { GET as getPreferences, PUT as putPreferences } from '../src/app/api/preferences/route';
import { GET as getNotifications } from '../src/app/api/notifications/route';

describe('Phase 2 Supabase Recovery, Migrations Ordering, Middleware Fail-Closed & Security', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    authMockState.user = null;
    authMockState.tripMemberRole = null;
    authMockState.tripCreatedBy = '99999999-9999-4999-8999-999999999999';
    authMockState.savedPrefs = null;
    authMockState.savedNotifications = [{ id: 'n-1', title: 'Trip Expense', read: false }];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('orders all 10 Supabase migrations monotonically without forward-dependency errors and covers all 16+ RLS tables', () => {
    const migDir = path.join(process.cwd(), 'supabase', 'migrations');
    const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();

    expect(files).toEqual([
      '20261121000001_complete_schema.sql',
      '20261122000001_security_hardening.sql',
      '20261122000002_final_backend_hardening.sql',
      '20261125000001_ai_payments_bookings_hardening.sql',
      '20261126000001_market_readiness_hardening.sql',
      '20261126000002_95_market_readiness_final.sql',
      '20261127000001_security_booking_webhook_remediation.sql',
      '20261127000002_day7_refund_webhook_hardening.sql',
      '20261127000003_phase8_complete_rls_and_webhook_hardening.sql',
      '20261127000004_phase9_audit_remediations.sql',
      '20261128000001_expense_splits_immutable_amounts.sql',
      '20261128000002_payment_webhook_transaction_rpc.sql',
    ]);

    const sqlByFile = files.map((f) => ({
      name: f,
      sql: fs.readFileSync(path.join(migDir, f), 'utf8'),
    }));

    const findIdx = (needle: RegExp) => sqlByFile.findIndex((m) => needle.test(m.sql));

    // Dependency 1: is_trip_admin() created before final_backend_hardening references it
    expect(findIdx(/CREATE OR REPLACE FUNCTION public\.is_trip_admin/i)).toBeLessThan(
      files.indexOf('20261122000002_final_backend_hardening.sql')
    );

    // Dependency 2: payment_refunds created before 95_market_readiness_final alters it
    expect(findIdx(/CREATE TABLE IF NOT EXISTS public\.payment_refunds/i)).toBeLessThan(
      files.indexOf('20261126000002_95_market_readiness_final.sql')
    );

    // Dependency 3: booking_webhook_events created before day7 alters it
    expect(findIdx(/CREATE TABLE IF NOT EXISTS public\.booking_webhook_events/i)).toBeLessThan(
      files.indexOf('20261127000002_day7_refund_webhook_hardening.sql')
    );

    // Verify all 16 core tables + auxiliary tables enable RLS
    const allSql = sqlByFile.map((m) => m.sql).join('\n');
    const requiredTables = [
      'profiles', 'trips', 'trip_members', 'trip_invitations', 'expenses', 'expense_splits',
      'vendor_splits', 'vendor_split_members', 'settlements', 'itinerary_items', 'bookings',
      'polls', 'poll_options', 'poll_votes', 'activity_logs', 'notifications',
      'idempotency_keys', 'user_preferences', 'ai_conversations', 'ai_messages',
      'receipt_uploads', 'payment_orders', 'payment_webhook_events', 'payment_refunds',
      'booking_status_history', 'ai_usage_logs', 'booking_webhook_events',
    ];
    for (const tbl of requiredTables) {
      expect(allSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${tbl}\\b`, 'i'));
      expect(allSql).toMatch(new RegExp(`ALTER TABLE public\\.${tbl} ENABLE ROW LEVEL SECURITY`, 'i'));
    }
  });

  it('middleware fails closed on /trips, /profile, /qr-split, /settings when Supabase env vars are missing or unauthenticated while leaving public routes accessible', async () => {
    // 1. Missing Supabase credentials -> protected paths MUST redirect cleanly (never bypass!)
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(isValidSupabaseConfig()).toBe(false);

    for (const protectedPath of ['/trips', '/trips/abc', '/qr-split', '/profile', '/settings']) {
      expect(isProtectedAppPath(protectedPath)).toBe(true);
      const res = await updateSession(new NextRequest(`https://tripsplitter.example${protectedPath}`));
      expect(res.status).toBe(307);
      const loc = res.headers.get('location') || '';
      expect(loc).toContain('/login');
      expect(loc).toContain('error=supabase-unconfigured');
    }

    // Public routes remain accessible even without Supabase configured
    for (const publicPath of ['/', '/explore', '/destinations/manali', '/3d-experience', '/ai-assistant', '/login', '/signup', '/privacy']) {
      expect(isProtectedAppPath(publicPath)).toBe(false);
      const res = await updateSession(new NextRequest(`https://tripsplitter.example${publicPath}`));
      expect(res.status).toBe(200);
    }

    // 2. Placeholder values also fail closed
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project-ref.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';
    const placeholderRes = await updateSession(new NextRequest('https://tripsplitter.example/profile'));
    expect(placeholderRes.status).toBe(307);

    // 3. Valid config with unauthenticated user -> redirect to /login
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ycfasggikwwmxejhgawf.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-live-anon-jwt';
    authMockState.user = null;
    const unauthProtected = await updateSession(new NextRequest('https://tripsplitter.example/trips'));
    expect(unauthProtected.status).toBe(307);
    expect(unauthProtected.headers.get('location')).toContain('/login?redirectTo=%2Ftrips');

    // 4. Valid authenticated session -> allows protected route & redirects auth pages to /
    authMockState.user = { id: '11111111-1111-4111-8111-111111111111' };
    const authOk = await updateSession(new NextRequest('https://tripsplitter.example/trips'));
    expect(authOk.status).toBe(200);
    const loginRedirect = await updateSession(new NextRequest('https://tripsplitter.example/login'));
    expect(loginRedirect.status).toBe(307);
  });

  it('enforces authenticated isolation, cross-user trip denial (403), preference & notification persistence, and browser service-role protection', async () => {
    // 1. Unauthenticated API calls fail with 401
    authMockState.user = null;
    expect((await getTrips(new Request('http://localhost/api/trips'))).status).toBe(401);
    expect((await getPreferences()).status).toBe(401);
    expect((await getNotifications()).status).toBe(401);

    // 2. Authenticated User A cannot read User B trip expenses -> 403
    authMockState.user = { id: '11111111-1111-4111-8111-111111111111' };
    authMockState.tripMemberRole = null;
    authMockState.tripCreatedBy = '22222222-2222-4222-8222-222222222222';
    const idorExp = await getExpenses(
      new Request('http://localhost/api/expenses?tripId=33333333-3333-4333-8333-333333333333')
    );
    expect(idorExp.status).toBe(403);

    // 3. Trip creation succeeds when authenticated
    const createTripRes = await createTrip(
      new Request('http://localhost/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Spiti Valley 2026',
          destination: 'Kaza',
          startDate: '2026-12-01',
          endDate: '2026-12-06',
          budget: 25000,
        }),
      })
    );
    expect(createTripRes.status).toBe(201);

    // 4. Preferences & notifications persist via API
    const putPrefRes = await putPreferences(
      new Request('http://localhost/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_language: 'hi', email_notifications: false }),
      })
    );
    expect(putPrefRes.status).toBe(200);
    const getPrefRes = await getPreferences();
    const getPrefJson = await getPrefRes.json();
    expect(getPrefJson.preferences?.preferred_language).toBe('hi');

    // 5. Service-role accessor throws immediately in browser environment
    vi.stubGlobal('window', {});
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-role-key-value';
    expect(() => getServerServiceRoleKey()).toThrow(/SECURITY VIOLATION/i);
  });
});

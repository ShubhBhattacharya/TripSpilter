import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = {
  userId: '11111111-1111-4111-8111-111111111111',
  isMember: true,
  isAdmin: true,
  tripMembers: [
    { user_id: '11111111-1111-4111-8111-111111111111', role: 'admin' },
    { user_id: '22222222-2222-4222-8222-222222222222', role: 'member' },
  ] as Array<{ user_id: string; role: string }>,
  tripExpenses: [] as Array<Record<string, unknown>>,
  tripSettlements: [] as Array<Record<string, unknown>>,
  bookingRow: null as Record<string, unknown> | null,
  webhookEvents: [] as Array<Record<string, unknown>>,
  webhookHistoryInserts: [] as Array<Record<string, unknown>>,
  lastAcceptCodePassed: '' as string,
  acceptInviteRpcResult: {
    data: { joined: true, alreadyMember: false, tripId: '33333333-3333-4333-8333-333333333333', role: 'member' },
    error: null,
  } as {
    data: unknown;
    error: { code?: string; message?: string } | null;
  },
};

function makeClient() {
  const makeQuery = (table: string) => {
    const eqFilters: Record<string, unknown> = {};
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payloadData: Record<string, unknown> = {};

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        eqFilters[col] = val;
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      insert: (data: Record<string, unknown>) => {
        mode = 'insert';
        payloadData = data;
        if (table === 'booking_webhook_events') {
          state.webhookEvents.push({ id: `evt-${state.webhookEvents.length + 1}`, retry_count: 0, ...data });
        }
        if (table === 'booking_status_history') {
          state.webhookHistoryInserts.push(data);
        }
        return chain;
      },
      update: (data: Record<string, unknown>) => {
        mode = 'update';
        payloadData = data;
        return chain;
      },
      delete: () => {
        mode = 'delete';
        return chain;
      },
      single: async () => {
        if (table === 'trip_invitations') {
          return {
            data: { id: 'inv-1', trip_id: payloadData.trip_id || '33333333-3333-4333-8333-333333333333', invite_code: payloadData.invite_code || 'TS-PHASE9' },
            error: null,
          };
        }
        return { data: state.bookingRow, error: null };
      },
      maybeSingle: async () => {
        if (table === 'booking_webhook_events') {
          if (mode === 'update') {
            for (const evt of state.webhookEvents) {
              const matchId = !eqFilters.id || evt.id === eqFilters.id;
              const matchProv = !eqFilters.provider || evt.provider === eqFilters.provider;
              const matchEvt = !eqFilters.event_id || evt.event_id === eqFilters.event_id;
              const matchProc = !eqFilters.processing_status || evt.processing_status === eqFilters.processing_status;
              if (matchId && matchProv && matchEvt && matchProc) {
                Object.assign(evt, payloadData);
                return { data: evt, error: null };
              }
            }
            return { data: null, error: null };
          }
          const matched = state.webhookEvents.find(
            (e) => e.provider === eqFilters.provider && e.event_id === eqFilters.event_id
          );
          return { data: matched || null, error: null };
        }
        if (table === 'bookings') {
          if (mode === 'update' && state.bookingRow) {
            state.bookingRow = { ...state.bookingRow, ...payloadData };
          }
          return { data: state.bookingRow, error: null };
        }
        if (table === 'trip_members') {
          if (mode === 'update' && eqFilters.user_id) {
            const member = state.tripMembers.find((m) => m.user_id === eqFilters.user_id);
            if (member && payloadData.role) member.role = String(payloadData.role);
            return { data: member || null, error: null };
          }
          return state.isMember
            ? { data: { role: state.isAdmin ? 'admin' : 'member' }, error: null }
            : { data: null, error: null };
        }
        if (table === 'trips') return { data: { created_by: 'other-user' }, error: null };
        return { data: null, error: null };
      },
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        if (table === 'booking_webhook_events' && mode === 'update') {
          for (const evt of state.webhookEvents) {
            const matchId = !eqFilters.id || evt.id === eqFilters.id;
            const matchProv = !eqFilters.provider || evt.provider === eqFilters.provider;
            const matchEvt = !eqFilters.event_id || evt.event_id === eqFilters.event_id;
            const matchProc = !eqFilters.processing_status || evt.processing_status === eqFilters.processing_status;
            if (matchId && matchProv && matchEvt && matchProc) {
              Object.assign(evt, payloadData);
            }
          }
          return resolve({ data: null, error: null });
        }
        if (table === 'trip_members') {
          if (mode === 'delete' && eqFilters.user_id) {
            state.tripMembers = state.tripMembers.filter((m) => m.user_id !== eqFilters.user_id);
            return resolve({ data: null, error: null });
          }
          return resolve({ data: state.tripMembers, error: null });
        }
        if (table === 'expenses') return resolve({ data: state.tripExpenses, error: null });
        if (table === 'settlements') return resolve({ data: state.tripSettlements, error: null });
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  };

  return {
    auth: { getUser: async () => ({ data: { user: { id: state.userId } }, error: null }) },
    from: (table: string) => makeQuery(table),
    rpc: async (fnName: string, args?: Record<string, unknown>) => {
      if (fnName === 'accept_trip_invitation') {
        state.lastAcceptCodePassed = String(args?.p_invite_code || '');
        return state.acceptInviteRpcResult;
      }
      return { data: null, error: null };
    },
  };
}

vi.mock('../src/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  createClient: () => makeClient(),
}));

vi.mock('../src/lib/supabase/server', () => ({
  createClient: async () => makeClient(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeClient(),
}));

import { POST as createInvite, GET as listInvites } from '../src/app/api/trips/invitations/route';
import { POST as acceptInvite } from '../src/app/api/trips/invitations/accept/route';
import {
  GET as listMembers,
  PATCH as patchMemberRole,
  DELETE as deleteMember,
} from '../src/app/api/trips/[id]/members/route';
import { POST as bookingWebhook } from '../src/app/api/bookings/webhook/route';

const TRIP_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const BOOKING_ID = '44444444-4444-4444-8444-444444444444';

describe('Phase 9 End-to-End Verification & Regression Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-non-placeholder';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key';
    delete process.env.BOOKING_PROVIDER_WEBHOOK_SECRET;
    process.env.BOOKING_WEBHOOK_SECRET_AMADEUS = 'amadeus_phase9_secret_abc';
    process.env.BOOKING_WEBHOOK_SECRET_LITEAPI = 'liteapi_phase9_secret_xyz';

    state.userId = ADMIN_ID;
    state.isMember = true;
    state.isAdmin = true;
    state.tripMembers = [
      { user_id: ADMIN_ID, role: 'admin' },
      { user_id: MEMBER_ID, role: 'member' },
    ];
    state.tripExpenses = [];
    state.tripSettlements = [];
    state.webhookEvents = [];
    state.webhookHistoryInserts = [];
    state.lastAcceptCodePassed = '';
    state.bookingRow = {
      id: BOOKING_ID,
      trip_id: TRIP_ID,
      title: 'Hotel Himalayan Crest',
      provider_name: 'Amadeus Hotel API',
      status: 'Pending confirmation',
      amount_paise: 420000,
      currency: 'INR',
      booked_by: ADMIN_ID,
      metadata: { supplierCode: 'amadeus' },
    };
    state.acceptInviteRpcResult = {
      data: { joined: true, alreadyMember: false, tripId: TRIP_ID, role: 'member' },
      error: null,
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('prevents last-admin demotion or self-leave (409), permits dual-admin handoff, and blocks open settlements without deleting financial records', async () => {
    // 1. Listing members works
    const listRes = await listMembers(new Request(`http://localhost/api/trips/${TRIP_ID}/members`), {
      params: Promise.resolve({ id: TRIP_ID }),
    });
    expect(listRes.status).toBe(200);

    // 2. Last admin cannot demote themselves -> 409
    const demoteLastRes = await patchMemberRole(
      new Request(`http://localhost/api/trips/${TRIP_ID}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberUserId: ADMIN_ID, role: 'member' }),
      }),
      { params: Promise.resolve({ id: TRIP_ID }) }
    );
    expect(demoteLastRes.status).toBe(409);

    // 3. Last admin cannot self-leave -> 409
    const leaveLastRes = await deleteMember(
      new Request(`http://localhost/api/trips/${TRIP_ID}/members`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: TRIP_ID }) }
    );
    expect(leaveLastRes.status).toBe(409);

    // 4. Promote second member to admin -> 200, then first admin CAN step down or leave
    const promoteRes = await patchMemberRole(
      new Request(`http://localhost/api/trips/${TRIP_ID}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberUserId: MEMBER_ID, role: 'admin' }),
      }),
      { params: Promise.resolve({ id: TRIP_ID }) }
    );
    expect(promoteRes.status).toBe(200);
    expect(state.tripMembers.find((m) => m.user_id === MEMBER_ID)?.role).toBe('admin');

    const demoteAfterPromoteRes = await patchMemberRole(
      new Request(`http://localhost/api/trips/${TRIP_ID}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberUserId: ADMIN_ID, role: 'member' }),
      }),
      { params: Promise.resolve({ id: TRIP_ID }) }
    );
    expect(demoteAfterPromoteRes.status).toBe(200);

    // 5. Block removal when member has an open in-flight settlement even if netBalance === 0 -> 409
    state.tripSettlements = [
      { id: 'st-open-1', from_user_id: ADMIN_ID, to_user_id: MEMBER_ID, amount: 500, status: 'pending' },
    ];
    const openSettlementBlocked = await deleteMember(
      new Request(`http://localhost/api/trips/${TRIP_ID}/members`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: TRIP_ID }) }
    );
    expect(openSettlementBlocked.status).toBe(409);

    // 6. Settling allows leaving without deleting financial records in expenses or settlements
    state.tripExpenses = [
      {
        id: 'exp-hist-1',
        paid_by: MEMBER_ID,
        total_amount: 1000,
        expense_splits: [
          { user_id: ADMIN_ID, amount_owed: 500, status: 'verified_paid' },
          { user_id: MEMBER_ID, amount_owed: 500, status: 'verified_paid' },
        ],
      },
    ];
    state.tripSettlements = [
      { id: 'st-open-1', from_user_id: ADMIN_ID, to_user_id: MEMBER_ID, amount: 500, status: 'verified_paid' },
    ];
    const leaveAllowed = await deleteMember(
      new Request(`http://localhost/api/trips/${TRIP_ID}/members`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: TRIP_ID }) }
    );
    expect(leaveAllowed.status).toBe(200);
    expect(state.tripExpenses.length).toBe(1);
    expect(state.tripSettlements.length).toBe(1);
  });

  it('validates trailing-slash invite URLs, expiry/duplicate/unauthorized RPC errors, UUID checks, and rate limits', async () => {
    // 1. Trailing slash invite link extracts TS-9988AA cleanly
    const resTrail = await acceptInvite(
      new Request('http://localhost/api/trips/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: 'https://tripsplitter-delta.vercel.app/join/ts-9988aa/' }),
      })
    );
    expect(resTrail.status).toBe(200);
    expect(state.lastAcceptCodePassed).toBe('TS-9988AA');

    // 2. Expired / already-accepted invite maps 22000 -> 409, unauthorized wrong-email maps 42501 -> 403
    state.acceptInviteRpcResult = { data: null, error: { code: '22000', message: 'Trip invitation has expired' } };
    const expiredRes = await acceptInvite(
      new Request('http://localhost/api/trips/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: 'TS-EXPIRED1' }),
      })
    );
    expect(expiredRes.status).toBe(409);

    state.acceptInviteRpcResult = {
      data: null,
      error: { code: '42501', message: 'This invitation is restricted to another email address' },
    };
    const wrongEmailRes = await acceptInvite(
      new Request('http://localhost/api/trips/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: 'TS-EMAIL1' }),
      })
    );
    expect(wrongEmailRes.status).toBe(403);

    // 3. Invalid tripId on GET /api/trips/invitations returns 400 cleanly
    const badUuidRes = await listInvites(new Request('http://localhost/api/trips/invitations?tripId=not-a-uuid'));
    expect(badUuidRes.status).toBe(400);

    // 4. Rate limit kicks in after >15 accept attempts in 60s for same user -> 429 + X-RateLimit-Remaining
    state.userId = '99999999-9999-4999-8999-999999999999';
    state.acceptInviteRpcResult = { data: { joined: true, tripId: TRIP_ID, role: 'member' }, error: null };
    let got429 = false;
    for (let i = 0; i < 18; i++) {
      const r = await acceptInvite(
        new Request('http://localhost/api/trips/invitations/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode: `TS-RL${i}` }),
        })
      );
      if (r.status === 429) {
        got429 = true;
        expect(r.headers.get('X-RateLimit-Remaining')).toBe('0');
        break;
      }
    }
    expect(got429).toBe(true);

    // Admin create invite works cleanly
    const createOk = await createInvite(
      new Request('http://localhost/api/trips/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: TRIP_ID, email: 'guest@example.com' }),
      })
    );
    expect(createOk.status).toBe(201);
  });

  it('normalizes webhook provider case-insensitively, retries failed events, blocks processed duplicates, and checks timestamps', async () => {
    const nowTs = String(Math.floor(Date.now() / 1000));
    const expiredTs = String(Math.floor(Date.now() / 1000) - 900);

    // 1. Expired timestamp (>5 min skew) -> 401
    const bodyOk = JSON.stringify({
      eventId: 'evt_phase9_retry_1',
      provider: 'Amadeus',
      bookingId: BOOKING_ID,
      eventType: 'booking.confirmed',
      providerConfirmationRef: 'AMAD9911ZZ',
      supplierPayload: { bookingId: BOOKING_ID, amountPaise: 420000, currency: 'INR' },
    });
    const sigOk = crypto.createHmac('sha256', 'amadeus_phase9_secret_abc').update(bodyOk).digest('hex');

    const staleRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': sigOk, 'x-webhook-timestamp': expiredTs },
        body: bodyOk,
      })
    );
    expect(staleRes.status).toBe(401);

    // 2. Simulate pre-existing FAILED event under lowercase provider 'amadeus'
    state.webhookEvents.push({
      id: 'evt-failed-1',
      provider: 'amadeus',
      event_id: 'evt_phase9_retry_1',
      processing_status: 'failed',
      retry_count: 0,
    });

    // Delivery with mixed case "Amadeus" MUST claim the failed retry cleanly and confirm booking
    const retryRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': sigOk, 'x-webhook-timestamp': nowTs },
        body: bodyOk,
      })
    );
    expect(retryRes.status).toBe(200);
    expect(state.webhookEvents[0].processing_status).toBe('processed');
    expect(state.webhookEvents[0].retry_count).toBe(1);
    expect(state.webhookHistoryInserts.length).toBe(1);

    // 3. Replaying same event with lowercase 'amadeus' MUST hit duplicateReplay: true (idempotent)
    const replayBodyLower = bodyOk.replace('"Amadeus"', '"amadeus"');
    const replaySigLower = crypto.createHmac('sha256', 'amadeus_phase9_secret_abc').update(replayBodyLower).digest('hex');
    const replayRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': replaySigLower, 'x-webhook-timestamp': nowTs },
        body: replayBodyLower,
      })
    );
    const replayJson = await replayRes.json();
    expect(replayRes.status).toBe(200);
    expect(replayJson.duplicateReplay).toBe(true);
    expect(state.webhookHistoryInserts.length).toBe(1);
  });

  it('verifies Phase 9 SQL migration closes last-admin, confirmed-booking delete, and notification insert gaps', () => {
    const sqlPath = path.join(
      process.cwd(),
      'supabase/migrations/20261127_phase9_audit_remediations.sql'
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toMatch(/CREATE CONSTRAINT TRIGGER trg_prevent_last_trip_admin_loss/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Trip members or creator can delete bookings" ON public\.bookings/i);
    expect(sql).toMatch(/status IN \('Draft', 'Cancelled', 'Failed'\)/i);
    expect(sql).toMatch(/CREATE POLICY "Users insert own notifications"/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.accept_trip_invitation\(TEXT\) TO authenticated/i);
  });
});

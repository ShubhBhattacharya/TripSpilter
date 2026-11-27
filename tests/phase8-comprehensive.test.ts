import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = {
  userId: '11111111-1111-4111-8111-111111111111',
  isMember: true,
  isAdmin: true,
  bookingRow: null as Record<string, unknown> | null,
  webhookExistingEvent: null as Record<string, unknown> | null,
  tripMembers: [
    { user_id: '11111111-1111-4111-8111-111111111111', role: 'admin' },
    { user_id: '22222222-2222-4222-8222-222222222222', role: 'member' },
  ] as Array<{ user_id: string; role: string }>,
  tripExpenses: [] as Array<Record<string, unknown>>,
  tripSettlements: [] as Array<Record<string, unknown>>,
  acceptInviteRpcResult: { data: { joined: true, tripId: '33333333-3333-4333-8333-333333333333', role: 'member' }, error: null } as {
    data: unknown;
    error: { code?: string; message?: string } | null;
  },
};

function makeClient() {
  const makeQuery = (table: string) => {
    const eqFilters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        eqFilters[col] = val;
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      update: () => chain,
      delete: () => chain,
      insert: () => chain,
      single: async () => {
        if (table === 'trip_invitations') {
          return {
            data: { id: 'inv-1', trip_id: eqFilters.trip_id || '33333333-3333-4333-8333-333333333333', invite_code: 'TS-ABCD1234' },
            error: null,
          };
        }
        return { data: state.bookingRow, error: null };
      },
      maybeSingle: async () => {
        if (table === 'booking_webhook_events') return { data: state.webhookExistingEvent, error: null };
        if (table === 'bookings') return { data: state.bookingRow, error: null };
        if (table === 'trip_members') {
          return state.isMember ? { data: { role: state.isAdmin ? 'admin' : 'member' }, error: null } : { data: null, error: null };
        }
        if (table === 'trips') return { data: { created_by: 'other-creator' }, error: null };
        return { data: null, error: null };
      },
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        if (table === 'trip_members') {
          resolve({ data: state.tripMembers, error: null });
          return;
        }
        if (table === 'expenses') {
          resolve({ data: state.tripExpenses, error: null });
          return;
        }
        if (table === 'settlements') {
          resolve({ data: state.tripSettlements, error: null });
          return;
        }
        resolve({ data: [], error: null });
      },
    };
    return chain;
  };

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: state.userId } }, error: null }),
    },
    from: (table: string) => makeQuery(table),
    rpc: async (fnName: string) => {
      if (fnName === 'accept_trip_invitation') return state.acceptInviteRpcResult;
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

import {
  doesWebhookProviderMatchBooking,
  resolveBookingWebhookSecret,
  validateSupplierWebhookPayloadConsistency,
} from '../src/lib/financial/webhook-security';
import { POST as bookingWebhook } from '../src/app/api/bookings/webhook/route';
import { POST as createInvite } from '../src/app/api/trips/invitations/route';
import { POST as acceptInvite } from '../src/app/api/trips/invitations/accept/route';
import { DELETE as removeTripMember } from '../src/app/api/trips/[id]/members/route';

describe('Phase 8 Security, Provider Binding, Complete RLS & Invitation Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-non-placeholder';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key';
    delete process.env.BOOKING_PROVIDER_WEBHOOK_SECRET;
    process.env.BOOKING_WEBHOOK_SECRET_AMADEUS = 'amadeus_specific_secret_999';
    process.env.BOOKING_WEBHOOK_SECRET_LITEAPI = 'liteapi_specific_secret_888';

    state.userId = '11111111-1111-4111-8111-111111111111';
    state.isMember = true;
    state.isAdmin = true;
    state.webhookExistingEvent = null;
    state.bookingRow = {
      id: '22222222-2222-4222-8222-222222222222',
      trip_id: '33333333-3333-4333-8333-333333333333',
      title: 'Manali Flight DEL-KUU',
      provider_name: 'Amadeus Flight API',
      status: 'Pending confirmation',
      amount_paise: 650000,
      currency: 'INR',
      booked_by: '11111111-1111-4111-8111-111111111111',
      metadata: { supplierCode: 'amadeus' },
    };
    state.tripExpenses = [];
    state.tripSettlements = [];
    state.acceptInviteRpcResult = {
      data: { joined: true, tripId: '33333333-3333-4333-8333-333333333333', role: 'member' },
      error: null,
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('strictly blocks blank, Direct / External Provider, and External Provider Redirect bookings from supplier webhooks', () => {
    expect(doesWebhookProviderMatchBooking('amadeus', 'Direct / External Provider').matched).toBe(false);
    expect(doesWebhookProviderMatchBooking('amadeus', 'External Provider Redirect').matched).toBe(false);
    expect(doesWebhookProviderMatchBooking('amadeus', '').matched).toBe(false);
    expect(doesWebhookProviderMatchBooking('amadeus', null).matched).toBe(false);
    expect(doesWebhookProviderMatchBooking('unknown_supplier', 'Amadeus Flight API').matched).toBe(false);
    expect(doesWebhookProviderMatchBooking('liteapi', 'Amadeus Flight API').matched).toBe(false);
    expect(doesWebhookProviderMatchBooking('amadeus', 'Amadeus Flight API').matched).toBe(true);
  });

  it('enforces per-provider webhook secrets, rejects tampered payload bookingId/amount/currency & rejects concurrent processing (409)', async () => {
    expect(resolveBookingWebhookSecret('amadeus').secret).toBe('amadeus_specific_secret_999');
    expect(resolveBookingWebhookSecret('liteapi').secret).toBe('liteapi_specific_secret_888');
    expect(resolveBookingWebhookSecret('hotelbeds').secret).toBeNull();

    const nowTs = String(Math.floor(Date.now() / 1000));

    // 1. Booking with "Direct / External Provider" cannot be confirmed even with valid HMAC signature
    state.bookingRow = {
      ...state.bookingRow,
      provider_name: 'Direct / External Provider',
      metadata: {},
    };
    const redirectAttemptBody = JSON.stringify({
      eventId: 'evt_bypass_attempt',
      provider: 'amadeus',
      bookingId: '22222222-2222-4222-8222-222222222222',
      eventType: 'booking.confirmed',
      providerConfirmationRef: 'AMAD8899XX',
      supplierPayload: { bookingId: '22222222-2222-4222-8222-222222222222', amountPaise: 650000, currency: 'INR' },
    });
    const amadeusSig = crypto
      .createHmac('sha256', 'amadeus_specific_secret_999')
      .update(redirectAttemptBody)
      .digest('hex');

    const redirectRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': amadeusSig, 'x-webhook-timestamp': nowTs },
        body: redirectAttemptBody,
      })
    );
    expect(redirectRes.status).toBe(403);

    // 2. Mismatched amountPaise in supplierPayload fails with 422
    state.bookingRow = {
      ...state.bookingRow,
      provider_name: 'Amadeus Flight API',
      metadata: { supplierCode: 'amadeus' },
    };
    const tamperedBody = JSON.stringify({
      eventId: 'evt_tamper_amt',
      provider: 'amadeus',
      bookingId: '22222222-2222-4222-8222-222222222222',
      eventType: 'booking.confirmed',
      providerConfirmationRef: 'AMAD8899XX',
      supplierPayload: { bookingId: '22222222-2222-4222-8222-222222222222', amountPaise: 100, currency: 'INR' },
    });
    const tamperedSig = crypto
      .createHmac('sha256', 'amadeus_specific_secret_999')
      .update(tamperedBody)
      .digest('hex');
    const tamperedRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': tamperedSig, 'x-webhook-timestamp': nowTs },
        body: tamperedBody,
      })
    );
    expect(tamperedRes.status).toBe(422);

    // 3. Concurrent in-flight delivery (processing_status = 'processing') returns 409
    state.webhookExistingEvent = { id: 'evt-lock-1', processing_status: 'processing', retry_count: 0 };
    const concurrentRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': amadeusSig, 'x-webhook-timestamp': nowTs },
        body: redirectAttemptBody,
      })
    );
    expect(concurrentRes.status).toBe(409);

    // 4. Unknown event type rejected cleanly (400)
    const unknownEvt = JSON.stringify({
      eventId: 'evt_unknown_1',
      provider: 'amadeus',
      bookingId: '22222222-2222-4222-8222-222222222222',
      eventType: 'booking.hacked',
      supplierPayload: { x: 1 },
    });
    expect(
      (
        await bookingWebhook(
          new Request('http://localhost/api/bookings/webhook', {
            method: 'POST',
            headers: {
              'x-booking-signature': crypto
                .createHmac('sha256', 'amadeus_specific_secret_999')
                .update(unknownEvt)
                .digest('hex'),
              'x-webhook-timestamp': nowTs,
            },
            body: unknownEvt,
          })
        )
      ).status
    ).toBe(400);

    // Pure consistency check unit assertions
    expect(
      validateSupplierWebhookPayloadConsistency({
        bookingId: 'b1',
        expectedAmountPaise: 1000,
        expectedCurrency: 'INR',
        supplierPayload: { currency: 'USD' },
      }).valid
    ).toBe(false);
  });

  it('Phase 8 migration fixes trip_members invite escalation and completes RLS policies across core tables', () => {
    const sqlPath = path.join(
      process.cwd(),
      'supabase/migrations/20261127000003_phase8_complete_rls_and_webhook_hardening.sql'
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toMatch(/DROP POLICY IF EXISTS "Trip creators or admins can add members" ON public\.trip_members/i);
    expect(sql).toMatch(/role = 'member'/i);
    expect(sql).toMatch(/lower\(inv\.email\) = lower\(COALESCE\(auth\.jwt\(\)->>'email', ''\)\)/i);
    expect(sql).toMatch(/status IN \('Draft', 'Pending confirmation', 'Cancelled', 'Refund pending'\)/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.accept_trip_invitation\(TEXT\) FROM PUBLIC, anon/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.accept_trip_invitation\(TEXT\) TO authenticated/i);
  });

  it('enforces trip admin permissions on invites, redeems invite codes, and blocks unsettled member removal (409)', async () => {
    // Non-admin blocked from generating invite code -> 403
    state.isAdmin = false;
    const forbiddenInvite = await createInvite(
      new Request('http://localhost/api/trips/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: '33333333-3333-4333-8333-333333333333' }),
      })
    );
    expect(forbiddenInvite.status).toBe(403);

    // Admin generates invite code -> 201
    state.isAdmin = true;
    const okInvite = await createInvite(
      new Request('http://localhost/api/trips/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: '33333333-3333-4333-8333-333333333333' }),
      })
    );
    expect(okInvite.status).toBe(201);

    // Accept invite link/code -> 200
    const acceptRes = await acceptInvite(
      new Request('http://localhost/api/trips/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: 'https://tripsplitter-delta.vercel.app/join?code=ts-abcd1234' }),
      })
    );
    expect(acceptRes.status).toBe(200);

    // Member with unsettled balance cannot be removed -> 409
    state.tripExpenses = [
      {
        id: 'exp-1',
        paid_by: '11111111-1111-4111-8111-111111111111',
        total_amount: 1000,
        expense_splits: [
          { user_id: '11111111-1111-4111-8111-111111111111', amount_owed: 500, status: 'verified_paid' },
          { user_id: '22222222-2222-4222-8222-222222222222', amount_owed: 500, status: 'pending' },
        ],
      },
    ];
    const blockedRemove = await removeTripMember(
      new Request('http://localhost/api/trips/33333333-3333-4333-8333-333333333333/members?userId=22222222-2222-4222-8222-222222222222', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: '33333333-3333-4333-8333-333333333333' }) }
    );
    expect(blockedRemove.status).toBe(409);

    // Settled member can be safely removed -> 200
    state.tripSettlements = [
      {
        id: 'set-1',
        from_user_id: '22222222-2222-4222-8222-222222222222',
        to_user_id: '11111111-1111-4111-8111-111111111111',
        amount: 500,
        status: 'verified_paid',
      },
    ];
    const allowedRemove = await removeTripMember(
      new Request('http://localhost/api/trips/33333333-3333-4333-8333-333333333333/members?userId=22222222-2222-4222-8222-222222222222', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: '33333333-3333-4333-8333-333333333333' }) }
    );
    expect(allowedRemove.status).toBe(200);
  });
});

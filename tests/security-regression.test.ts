import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = {
  userId: '11111111-1111-4111-8111-111111111111',
  isMember: true,
  isAdmin: false,
  bookingRow: null as Record<string, unknown> | null,
  bookingCasUpdated: true,
  orderRow: null as Record<string, unknown> | null,
  existingRefunds: [] as Array<Record<string, unknown>>,
  reserveRpcResult: { data: null, error: null } as { data: unknown; error: { code?: string; message?: string } | null },
  finalizeRpcResult: { data: null, error: null } as { data: unknown; error: { code?: string; message?: string } | null },
  finalizeRpcUsedAdminClient: false,
  webhookExistingEvent: null as Record<string, unknown> | null,
  webhookInsertError: null as { code?: string; message?: string } | null,
  webhookClaimRetryOk: true,
  processedRefundsForBooking: [] as Array<Record<string, unknown>>,
};

function makeClient(isAdminClient: boolean) {
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
      insert: async () => ({ error: state.webhookInsertError }),
      maybeSingle: async () => {
        if (table === 'booking_webhook_events' || table === 'payment_webhook_events') {
          if (eqFilters.processing_status === 'failed') {
            return state.webhookClaimRetryOk ? { data: { id: 'evt-retry-1' }, error: null } : { data: null, error: null };
          }
          return { data: state.webhookExistingEvent, error: null };
        }
        if (table === 'bookings') {
          if (!state.bookingRow) return { data: null, error: null };
          if (eqFilters.status && !state.bookingCasUpdated) return { data: null, error: null };
          return { data: state.bookingRow, error: null };
        }
        if (table === 'trip_members') {
          return state.isMember
            ? { data: { role: state.isAdmin ? 'admin' : 'member' }, error: null }
            : { data: null, error: null };
        }
        if (table === 'trips') {
          return { data: { created_by: 'other-creator' }, error: null };
        }
        if (table === 'payment_orders') {
          return { data: state.orderRow, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        if (table === 'payment_refunds') {
          const data =
            eqFilters.status === 'processed'
              ? state.processedRefundsForBooking
              : state.existingRefunds;
          resolve({ data, error: null });
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
      if (fnName === 'reserve_payment_refund') return state.reserveRpcResult;
      if (fnName === 'finalize_payment_refund') {
        state.finalizeRpcUsedAdminClient = isAdminClient;
        if (!isAdminClient) {
          return {
            data: null,
            error: { code: '42501', message: 'Forbidden: permission denied for function finalize_payment_refund' },
          };
        }
        return state.finalizeRpcResult;
      }
      return { data: null, error: null };
    },
  };
}

vi.mock('../src/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  createClient: () => makeClient(false),
}));

vi.mock('../src/lib/supabase/server', () => ({
  createClient: async () => makeClient(false),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeClient(true),
}));

import { PATCH as bookingPatch, GET as bookingGet } from '../src/app/api/bookings/[id]/route';
import { POST as bookingConfirm } from '../src/app/api/bookings/[id]/confirm/route';
import { POST as bookingWebhook } from '../src/app/api/bookings/webhook/route';
import { POST as paymentRefundPost, GET as paymentRefundGet } from '../src/app/api/payments/refund/route';
import { POST as paymentWebhook } from '../src/app/api/payments/webhook/route';

describe('Day 7 Critical Security Regression Suite (Bookings, Refunds, Webhooks & DB Policies)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-non-placeholder';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key';
    process.env.BOOKING_PROVIDER_WEBHOOK_SECRET = 'booking_webhook_secret_123';
    process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = 'razorpay_webhook_secret_123';
    process.env.PAYMENT_PROVIDER_API_KEY = 'rzp_test_key';
    process.env.PAYMENT_PROVIDER_API_SECRET = 'rzp_test_secret';

    state.userId = '11111111-1111-4111-8111-111111111111';
    state.isMember = true;
    state.isAdmin = false;
    state.bookingCasUpdated = true;
    state.finalizeRpcUsedAdminClient = false;
    state.webhookExistingEvent = null;
    state.webhookInsertError = null;
    state.webhookClaimRetryOk = true;
    state.bookingRow = {
      id: '22222222-2222-4222-8222-222222222222',
      trip_id: '33333333-3333-4333-8333-333333333333',
      title: 'Hotel Manali Stay',
      provider_name: 'Amadeus Flight API',
      status: 'Pending confirmation',
      booked_by: '11111111-1111-4111-8111-111111111111',
      payment_order_id: '44444444-4444-4444-8444-444444444444',
      amount_paise: 100000,
    };
    state.orderRow = {
      id: '44444444-4444-4444-8444-444444444444',
      user_id: '11111111-1111-4111-8111-111111111111',
      trip_id: '33333333-3333-4333-8333-333333333333',
      amount_paise: 100000,
      status: 'captured',
      provider: 'razorpay',
      provider_payment_id: 'pay_test_999',
      currency: 'INR',
    };
    state.existingRefunds = [];
    state.reserveRpcResult = {
      data: { isIdempotentReplay: false, refund: { id: '55555555-5555-4555-8555-555555555555' } },
      error: null,
    };
    state.finalizeRpcResult = {
      data: { id: '55555555-5555-4555-8555-555555555555', status: 'processed' },
      error: null,
    };
    state.processedRefundsForBooking = [];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('SQL migrations revoke finalize_payment_refund from authenticated and drop direct payment_refunds INSERT bypass', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20261127_day7_refund_webhook_hardening.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/DROP POLICY IF EXISTS "Users request own refunds" ON public\.payment_refunds/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.finalize_payment_refund\(.*\) FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.finalize_payment_refund\(.*\) TO service_role/i);
    expect(sql).toMatch(/v_jwt_role <> 'service_role'/i);
  });

  it('finalizes refunds exclusively via service_role admin client and fails closed when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const noKeyRes = await paymentRefundPost(
      new Request('http://localhost/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentOrderId: '44444444-4444-4444-8444-444444444444', amountInr: 500 }),
      })
    );
    expect(noKeyRes.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();

    // With service_role present, finalize_payment_refund MUST be called on trusted service_role client
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key';
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'rfnd_verified_1', payment_id: 'pay_test_999', amount: 50000, status: 'processed' }), {
        status: 200,
      })
    ) as unknown as typeof fetch;

    const okRes = await paymentRefundPost(
      new Request('http://localhost/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentOrderId: '44444444-4444-4444-8444-444444444444', amountInr: 500 }),
      })
    );
    expect(okRes.status).toBe(201);
    expect(state.finalizeRpcUsedAdminClient).toBe(true);
  });

  it('rejects provider refund response mismatches (wrong payment_id or amount) and flags reconciliation_required', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'rfnd_wrong_1', payment_id: 'pay_OTHER_USER', amount: 99900, status: 'processed' }), {
        status: 200,
      })
    ) as unknown as typeof fetch;

    const res = await paymentRefundPost(
      new Request('http://localhost/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentOrderId: '44444444-4444-4444-8444-444444444444', amountInr: 500 }),
      })
    );
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.reconciliationRequired).toBe(true);
  });

  it('rejects forged client-supplied booking confirmation fields & Confirmed by supplier status with 403', async () => {
    const req1 = new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Confirmed by supplier',
        verificationSource: 'provider_api',
        supplierPayload: { fake: true },
        providerConfirmationRef: 'FAKE9999',
      }),
    });
    expect(
      (await bookingPatch(req1, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) })).status
    ).toBe(403);

    const req2 = new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Confirmed by supplier' }),
    });
    expect(
      (await bookingPatch(req2, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) })).status
    ).toBe(403);

    const req3 = new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userApprovedTerms: true,
        bookingMode: 'provider_api',
        providerConfirmationRef: 'FORGED999',
      }),
    });
    expect(
      (await bookingConfirm(req3, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) })).status
    ).toBe(403);
  });

  it('rejects client-forged Refunded booking status & non-owner updates with 403 and enforces CAS race check (409)', async () => {
    state.bookingRow = { ...state.bookingRow, status: 'Cancelled' };
    expect(
      (
        await bookingPatch(
          new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Refunded' }),
          }),
          { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) }
        )
      ).status
    ).toBe(403);

    state.userId = '99999999-9999-4999-8999-999999999999';
    expect(
      (
        await bookingPatch(
          new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Cancelled' }),
          }),
          { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) }
        )
      ).status
    ).toBe(403);

    state.isMember = false;
    expect(
      (
        await bookingGet(new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222'), {
          params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }),
        })
      ).status
    ).toBe(403);

    state.userId = '11111111-1111-4111-8111-111111111111';
    state.isMember = true;
    state.bookingCasUpdated = false;
    expect(
      (
        await bookingPatch(
          new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Cancelled' }),
          }),
          { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) }
        )
      ).status
    ).toBe(409);
  });

  it('fails closed (503) when reserve_payment_refund RPC is missing and blocks over-refund / duplicates / cross-user refund history', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    state.reserveRpcResult = {
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.reserve_payment_refund' },
    };
    const missingRpcRes = await paymentRefundPost(
      new Request('http://localhost/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentOrderId: '44444444-4444-4444-8444-444444444444', amountInr: 500 }),
      })
    );
    expect(missingRpcRes.status).toBe(503);
    expect((await missingRpcRes.json()).status).toBe('blocked_missing_rpc');
    expect(fetchSpy).not.toHaveBeenCalled();

    // Concurrent / cumulative over-refund blocked -> 409
    state.reserveRpcResult = {
      data: null,
      error: { code: '22003', message: 'Cumulative refunds exceed captured order amount' },
    };
    const overRes = await paymentRefundPost(
      new Request('http://localhost/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentOrderId: '44444444-4444-4444-8444-444444444444', amountInr: 100 }),
      })
    );
    expect(overRes.status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Idempotent duplicate replay -> 200 X-Idempotent-Replay: true
    state.reserveRpcResult = {
      data: { isIdempotentReplay: true, refund: { id: '55555555-5555-4555-8555-555555555555', status: 'processed' } },
      error: null,
    };
    const idemRes = await paymentRefundPost(
      new Request('http://localhost/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-key-123' },
        body: JSON.stringify({ paymentOrderId: '44444444-4444-4444-8444-444444444444', amountInr: 500 }),
      })
    );
    expect(idemRes.status).toBe(200);
    expect(idemRes.headers.get('X-Idempotent-Replay')).toBe('true');

    // Cross-user refund history read blocked -> 403
    state.userId = '99999999-9999-4999-8999-999999999999';
    state.isMember = false;
    const histRes = await paymentRefundGet(
      new Request('http://localhost/api/payments/refund?paymentOrderId=44444444-4444-4444-8444-444444444444')
    );
    expect(histRes.status).toBe(403);
  });

  it('enforces booking webhook supplier identity matching, retries on failed events, and payment refund reconciliation', async () => {
    const secret = process.env.BOOKING_PROVIDER_WEBHOOK_SECRET!;
    const nowTs = String(Math.floor(Date.now() / 1000));

    // Mismatched provider ("liteapi" claiming update on "Amadeus Flight API" booking) -> 403
    const mismatchPayload = JSON.stringify({
      eventId: 'evt_mismatch_1',
      provider: 'liteapi',
      bookingId: '22222222-2222-4222-8222-222222222222',
      eventType: 'booking.confirmed',
      providerConfirmationRef: 'AMAD8899XX',
      supplierPayload: { pnr: 'AMAD8899XX' },
    });
    const mismatchSig = crypto.createHmac('sha256', secret).update(mismatchPayload).digest('hex');
    const mismatchRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': mismatchSig, 'x-webhook-timestamp': nowTs },
        body: mismatchPayload,
      })
    );
    expect(mismatchRes.status).toBe(403);

    // Processed event replay -> 200 duplicateReplay: true
    state.webhookExistingEvent = { id: 'evt-row-1', processing_status: 'processed', retry_count: 0 };
    const validPayload = JSON.stringify({
      eventId: 'evt_ok_1',
      provider: 'amadeus',
      bookingId: '22222222-2222-4222-8222-222222222222',
      eventType: 'booking.confirmed',
      providerConfirmationRef: 'AMAD8899XX',
      supplierPayload: { pnr: 'AMAD8899XX' },
    });
    const validSig = crypto.createHmac('sha256', secret).update(validPayload).digest('hex');
    const replayRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': validSig, 'x-webhook-timestamp': nowTs },
        body: validPayload,
      })
    );
    expect(replayRes.status).toBe(200);
    expect((await replayRes.json()).duplicateReplay).toBe(true);

    // Failed webhook event retries cleanly instead of being silently swallowed as duplicate
    state.webhookExistingEvent = { id: 'evt-row-2', processing_status: 'failed', retry_count: 1 };
    const retryRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': validSig, 'x-webhook-timestamp': nowTs },
        body: validPayload,
      })
    );
    expect(retryRes.status).toBe(200);
    expect((await retryRes.json()).verified).toBe(true);

    // Payment webhook rejects invalid signatures (401)
    const payBadSig = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': '0'.repeat(64) },
        body: JSON.stringify({ event: 'payment.captured' }),
      })
    );
    expect(payBadSig.status).toBe(401);
  });
});

import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = {
  userId: 'user-owner-1',
  isMember: true,
  isAdmin: false,
  bookingRow: null as Record<string, unknown> | null,
  bookingCasUpdated: true,
  orderRow: null as Record<string, unknown> | null,
  existingRefunds: [] as Array<Record<string, unknown>>,
  reserveRpcResult: { data: null, error: null } as { data: unknown; error: { code?: string; message?: string } | null },
  finalizeRpcResult: { data: null, error: null } as { data: unknown; error: { code?: string; message?: string } | null },
  webhookInsertError: null as { code?: string; message?: string } | null,
  processedRefundsForBooking: [] as Array<Record<string, unknown>>,
};

function makeQuery(table: string) {
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
}

const mockSupabaseClient = {
  auth: {
    getUser: async () => ({ data: { user: { id: state.userId } }, error: null }),
  },
  from: (table: string) => makeQuery(table),
  rpc: async (fnName: string) => {
    if (fnName === 'reserve_payment_refund') return state.reserveRpcResult;
    if (fnName === 'finalize_payment_refund') return state.finalizeRpcResult;
    return { data: null, error: null };
  },
};

vi.mock('../src/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  createClient: () => mockSupabaseClient,
}));

vi.mock('../src/lib/supabase/server', () => ({
  createClient: async () => mockSupabaseClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient,
}));

import { PATCH as bookingPatch, GET as bookingGet } from '../src/app/api/bookings/[id]/route';
import { POST as bookingConfirm } from '../src/app/api/bookings/[id]/confirm/route';
import { POST as bookingWebhook } from '../src/app/api/bookings/webhook/route';
import { POST as paymentRefundPost, GET as paymentRefundGet } from '../src/app/api/payments/refund/route';

describe('Phase 2–5 Security Regression Suite (Bookings, Refunds, Webhooks & IDOR)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-non-placeholder';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key';
    process.env.BOOKING_PROVIDER_WEBHOOK_SECRET = 'booking_webhook_secret_123';
    process.env.PAYMENT_PROVIDER_API_KEY = 'rzp_test_key';
    process.env.PAYMENT_PROVIDER_API_SECRET = 'rzp_test_secret';

    state.userId = '11111111-1111-4111-8111-111111111111';
    state.isMember = true;
    state.isAdmin = false;
    state.bookingCasUpdated = true;
    state.bookingRow = {
      id: '22222222-2222-4222-8222-222222222222',
      trip_id: '33333333-3333-4333-8333-333333333333',
      title: 'Hotel Manali Stay',
      status: 'Pending confirmation',
      booked_by: '11111111-1111-4111-8111-111111111111',
      payment_order_id: '44444444-4444-4444-8444-444444444444',
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
    state.webhookInsertError = null;
    state.processedRefundsForBooking = [];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
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
    const res1 = await bookingPatch(req1, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) });
    expect(res1.status).toBe(403);

    const req2 = new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Confirmed by supplier' }),
    });
    const res2 = await bookingPatch(req2, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) });
    expect(res2.status).toBe(403);

    const req3 = new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userApprovedTerms: true,
        bookingMode: 'provider_api',
        providerConfirmationRef: 'FORGED999',
      }),
    });
    const res3 = await bookingConfirm(req3, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) });
    expect(res3.status).toBe(403);
  });

  it('rejects client-forged Refunded booking status & non-owner updates with 403', async () => {
    state.bookingRow = { ...state.bookingRow, status: 'Cancelled' };
    const refundAttempt = new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Refunded' }),
    });
    const res = await bookingPatch(refundAttempt, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) });
    expect(res.status).toBe(403);

    // Non-owner / non-admin trip member blocked from modifying booking
    state.userId = '99999999-9999-4999-8999-999999999999';
    const cancelByOther = new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Cancelled' }),
    });
    const resOther = await bookingPatch(cancelByOther, {
      params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }),
    });
    expect(resOther.status).toBe(403);
  });

  it('enforces trip membership on booking history GET and detects concurrent CAS race with 409', async () => {
    state.isMember = false;
    const resUnauth = await bookingGet(new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222'), {
      params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }),
    });
    expect(resUnauth.status).toBe(403);

    state.isMember = true;
    state.bookingCasUpdated = false;
    const reqCas = new Request('http://localhost/api/bookings/22222222-2222-4222-8222-222222222222', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Cancelled' }),
    });
    const resCas = await bookingPatch(reqCas, { params: Promise.resolve({ id: '22222222-2222-4222-8222-222222222222' }) });
    expect(resCas.status).toBe(409);
  });

  it('fails closed (503) when reserve_payment_refund RPC is missing and never calls Razorpay', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    state.reserveRpcResult = {
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.reserve_payment_refund' },
    };

    const req = new Request('http://localhost/api/payments/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentOrderId: '44444444-4444-4444-8444-444444444444',
        amountInr: 500,
      }),
    });
    const res = await paymentRefundPost(req);
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe('blocked_missing_rpc');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks over-refunds (409 on lock conflict), handles duplicate idempotency keys, and surfaces DB reconciliation errors (502)', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    // 1. Concurrent / Cumulative cap rejection inside DB RPC -> 409, zero gateway calls
    state.reserveRpcResult = {
      data: null,
      error: { code: '22003', message: 'Cumulative refunds exceed captured order amount' },
    };
    const overReq = new Request('http://localhost/api/payments/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentOrderId: '44444444-4444-4444-8444-444444444444',
        amountInr: 100,
      }),
    });
    const overRes = await paymentRefundPost(overReq);
    expect(overRes.status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();

    // 2. Duplicate idempotency replay -> 200 X-Idempotent-Replay: true, zero gateway calls
    state.reserveRpcResult = {
      data: { isIdempotentReplay: true, refund: { id: '55555555-5555-4555-8555-555555555555', status: 'processed' } },
      error: null,
    };
    const idemReq = new Request('http://localhost/api/payments/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'idempotency-key': 'idem-key-123' },
      body: JSON.stringify({
        paymentOrderId: '44444444-4444-4444-8444-444444444444',
        amountInr: 500,
      }),
    });
    const idemRes = await paymentRefundPost(idemReq);
    expect(idemRes.status).toBe(200);
    expect(idemRes.headers.get('X-Idempotent-Replay')).toBe('true');
    expect(fetchSpy).not.toHaveBeenCalled();

    // 3. Provider succeeds + DB finalization fails -> 502 reconciliationRequired: true
    state.reserveRpcResult = {
      data: { isIdempotentReplay: false, refund: { id: '55555555-5555-4555-8555-555555555555' } },
      error: null,
    };
    state.finalizeRpcResult = {
      data: null,
      error: { code: '57014', message: 'database write timeout after gateway refund' },
    };
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'rfnd_live_abc', status: 'processed' }), { status: 200 })
    ) as unknown as typeof fetch;

    const mismatchReq = new Request('http://localhost/api/payments/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentOrderId: '44444444-4444-4444-8444-444444444444',
        amountInr: 500,
      }),
    });
    const mismatchRes = await paymentRefundPost(mismatchReq);
    const mismatchJson = await mismatchRes.json();
    expect(mismatchRes.status).toBe(502);
    expect(mismatchJson.reconciliationRequired).toBe(true);
    expect(mismatchJson.providerRefundId).toBe('rfnd_live_abc');
  });

  it('blocks unauthorized GET /api/payments/refund history reads across users/non-members (403)', async () => {
    state.userId = '99999999-9999-4999-8999-999999999999';
    state.isMember = false;
    const res = await paymentRefundGet(
      new Request('http://localhost/api/payments/refund?paymentOrderId=44444444-4444-4444-8444-444444444444')
    );
    expect(res.status).toBe(403);
  });

  it('rejects forged/expired supplier webhooks, handles replays, and blocks Refunded without reconciled refund', async () => {
    const secret = process.env.BOOKING_PROVIDER_WEBHOOK_SECRET!;
    const payload = JSON.stringify({
      eventId: 'evt_booking_1',
      provider: 'amadeus',
      bookingId: '22222222-2222-4222-8222-222222222222',
      eventType: 'booking.confirmed',
      providerConfirmationRef: 'AMAD8899XX',
      supplierPayload: { pnr: 'AMAD8899XX', confirmedAt: '2026-11-26T17:00:00Z' },
    });
    const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Invalid signature -> 401
    const badSigRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: {
          'x-booking-signature': '0'.repeat(64),
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body: payload,
      })
    );
    expect(badSigRes.status).toBe(401);

    // Expired timestamp -> 401
    const oldTs = String(Math.floor(Date.now() / 1000) - 900);
    const expiredRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: { 'x-booking-signature': validSig, 'x-webhook-timestamp': oldTs },
        body: payload,
      })
    );
    expect(expiredRes.status).toBe(401);

    // Replayed event_id -> duplicateReplay: true
    state.webhookInsertError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const replayRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: {
          'x-booking-signature': validSig,
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body: payload,
      })
    );
    const replayJson = await replayRes.json();
    expect(replayRes.status).toBe(200);
    expect(replayJson.duplicateReplay).toBe(true);

    // Booking webhook booking.refunded without reconciled processed payment refund -> 422
    state.webhookInsertError = null;
    state.bookingRow = { ...state.bookingRow, status: 'Cancelled' };
    state.processedRefundsForBooking = [];
    const refundEvt = JSON.stringify({
      eventId: 'evt_booking_refund_unreconciled',
      provider: 'razorpay',
      bookingId: '22222222-2222-4222-8222-222222222222',
      eventType: 'booking.refunded',
      supplierPayload: { reason: 'cancelled' },
    });
    const refundSig = crypto.createHmac('sha256', secret).update(refundEvt).digest('hex');
    const unreconciledRes = await bookingWebhook(
      new Request('http://localhost/api/bookings/webhook', {
        method: 'POST',
        headers: {
          'x-booking-signature': refundSig,
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body: refundEvt,
      })
    );
    expect(unreconciledRes.status).toBe(422);
  });
});

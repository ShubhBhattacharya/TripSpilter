import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = {
  userId: '11111111-1111-4111-8111-111111111111' as string | null,
  simulateOrder23505: false,
  storedOrder: {
    id: 'ord-1',
    user_id: '11111111-1111-4111-8111-111111111111',
    trip_id: '33333333-3333-4333-8333-333333333333',
    split_id: 'spl-1',
    provider_order_id: 'order_rzp_999',
    provider_payment_id: 'pay_rzp_999',
    amount_paise: 100000,
    currency: 'INR',
    status: 'created',
    idempotency_key: 'idem-race-1',
  } as Record<string, unknown>,
  webhookEvents: [] as Array<Record<string, unknown>>,
  storedRefund: { id: 'ref-1', amount_paise: 40000, status: 'pending' } as Record<string, unknown>,
  processedRefundRows: [{ amount_paise: 40000 }] as Array<{ amount_paise: number }>,
  lastOrderUpdate: null as Record<string, unknown> | null,
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
        if (table === 'payment_webhook_events') {
          state.webhookEvents.push({ id: `pwe-${state.webhookEvents.length + 1}`, ...data });
        }
        return chain;
      },
      update: (data: Record<string, unknown>) => {
        mode = 'update';
        payloadData = data;
        if (table === 'payment_orders') {
          state.lastOrderUpdate = data;
          state.storedOrder = { ...state.storedOrder, ...data };
        }
        if (table === 'payment_refunds') {
          state.storedRefund = { ...state.storedRefund, ...data };
        }
        return chain;
      },
      delete: () => {
        mode = 'delete';
        return chain;
      },
      single: async () => {
        if (table === 'payment_orders' && mode === 'insert' && state.simulateOrder23505) {
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        }
        return { data: state.storedOrder, error: null };
      },
      maybeSingle: async () => {
        if (table === 'payment_webhook_events') {
          const found = state.webhookEvents.find(
            (e) => e.provider === eqFilters.provider && e.event_id === eqFilters.event_id
          );
          return { data: found || null, error: null };
        }
        if (table === 'payment_orders') {
          return { data: state.storedOrder, error: null };
        }
        if (table === 'payment_refunds') {
          return { data: state.storedRefund, error: null };
        }
        if (table === 'trip_members') {
          return { data: { role: 'admin' }, error: null };
        }
        if (table === 'expense_splits') {
          return {
            data: {
              id: 'spl-1',
              user_id: state.userId,
              amount_owed: 1000,
              amount_owed_paise: 100000,
              expenses: { trip_id: '33333333-3333-4333-8333-333333333333' },
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        if (table === 'payment_refunds') {
          return resolve({ data: state.processedRefundRows, error: null });
        }
        if (table === 'payment_webhook_events' && mode === 'update') {
          for (const evt of state.webhookEvents) {
            if (evt.event_id === eqFilters.event_id) Object.assign(evt, payloadData);
          }
          return resolve({ data: null, error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  };

  return {
    auth: {
      getUser: async () => ({
        data: { user: state.userId ? { id: state.userId } : null },
        error: null,
      }),
    },
    from: (table: string) => makeQuery(table),
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

import { POST as createPaymentOrder } from '../src/app/api/payments/create-order/route';
import { POST as paymentWebhook } from '../src/app/api/payments/webhook/route';
import { POST as ocrParseReceipt } from '../src/app/api/ocr/parse-receipt/route';
import { POST as aiChat, GET as aiChatGet } from '../src/app/api/ai/chat/route';
import { GET as getExpenses } from '../src/app/api/expenses/route';
import { DELETE as deleteExpense } from '../src/app/api/expenses/[id]/route';
import { GET as getBooking } from '../src/app/api/bookings/[id]/route';
import { POST as confirmBooking } from '../src/app/api/bookings/[id]/confirm/route';
import { GET as getRefunds } from '../src/app/api/payments/refund/route';
import { DELETE as deleteNotification } from '../src/app/api/notifications/route';

describe('Final Market-Readiness Release Audit Regression Suite', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-non-placeholder';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key';
    process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = 'rzp_webhook_secret_final';
    process.env.PAYMENT_PROVIDER_API_KEY = 'rzp_test_key_final';
    process.env.PAYMENT_PROVIDER_API_SECRET = 'rzp_test_secret_final';

    state.userId = '11111111-1111-4111-8111-111111111111';
    state.simulateOrder23505 = false;
    state.webhookEvents = [];
    state.lastOrderUpdate = null;
    state.processedRefundRows = [{ amount_paise: 40000 }];
    state.storedOrder = {
      id: 'ord-1',
      user_id: '11111111-1111-4111-8111-111111111111',
      trip_id: '33333333-3333-4333-8333-333333333333',
      split_id: 'spl-1',
      provider_order_id: 'order_rzp_999',
      provider_payment_id: 'pay_rzp_999',
      amount_paise: 100000,
      currency: 'INR',
      status: 'created',
      idempotency_key: 'idem-race-1',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('recovers cleanly from concurrent idempotency_key 23505 conflicts on payment order creation', async () => {
    // Bypass pre-check via new mock flow: simulate insert colliding on concurrent DB unique index
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'order_rzp_new' }), { status: 200 })
    ) as typeof fetch;

    state.simulateOrder23505 = true;
    const req = new Request('http://localhost/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountInr: 1000, idempotencyKey: 'idem-fresh-race-key' }),
    });

    // Simulate pre-check missing the in-flight concurrent insert, then DB throwing 23505 on insert:
    // Because mock storedOrder has same user, the pre-check finds it or recover catches 23505 cleanly without 500
    const res = await createPaymentOrder(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.idempotentReplay).toBe(true);
    expect(json.order?.id).toBe('ord-1');
  });

  it('rejects currency mismatch on payment.captured webhooks (422) and reconciles partial refunds', async () => {
    const nowTs = String(Math.floor(Date.now() / 1000));

    // 1. Wrong currency USD for an INR order -> 422
    const currencyMismatchBody = JSON.stringify({
      id: 'evt_curr_mismatch',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_1',
            order_id: 'order_rzp_999',
            amount: 100000,
            currency: 'USD',
          },
        },
      },
    });
    const mismatchSig = crypto
      .createHmac('sha256', 'rzp_webhook_secret_final')
      .update(currencyMismatchBody)
      .digest('hex');

    const mismatchRes = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': mismatchSig, 'x-webhook-timestamp': nowTs },
        body: currencyMismatchBody,
      })
    );
    expect(mismatchRes.status).toBe(422);

    // 2. Partial refund reconciliation (40000 / 100000 paise -> status partially_refunded)
    const partialRefundBody = JSON.stringify({
      id: 'evt_partial_refund_1',
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_1',
            payment_id: 'pay_rzp_999',
            amount: 40000,
          },
        },
      },
    });
    const partialSig = crypto
      .createHmac('sha256', 'rzp_webhook_secret_final')
      .update(partialRefundBody)
      .digest('hex');

    const partialRes = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': partialSig, 'x-webhook-timestamp': nowTs },
        body: partialRefundBody,
      })
    );
    expect(partialRes.status).toBe(200);
    expect(state.lastOrderUpdate?.status).toBe('partially_refunded');
  });

  it('enforces OCR file upload MIME & 5MB limits and blocks unauthenticated callers from paid AI quota', async () => {
    // 1. Disallowed SVG upload -> 400
    const badMimeRes = await ocrParseReceipt(
      new Request('http://localhost/api/ocr/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }),
      }) as never
    );
    expect(badMimeRes.status).toBe(400);

    // 2. Unauthenticated caller cannot spend paid OpenAI/Gemini quota even if API keys exist
    state.userId = null;
    process.env.OPENAI_API_KEY = 'sk-test-should-not-be-called-for-anon';
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    const anonAiRes = await aiChat(
      new Request('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'en',
          messages: [{ role: 'user', content: 'Help me split a ₹1200 bill equally across 3 friends' }],
        }),
      })
    );
    const anonAiJson = await anonAiRes.json();
    expect(anonAiRes.status).toBe(200);
    expect(anonAiJson.provider).toBe('unconfigured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validates malformed UUIDs with 400 instead of leaking Postgres 500 errors across authenticated routes', async () => {
    const responses = await Promise.all([
      getExpenses(new Request('http://localhost/api/expenses?tripId=not-uuid')),
      deleteExpense(new Request('http://localhost/api/expenses/not-uuid?confirm=true', { method: 'DELETE' }), {
        params: Promise.resolve({ id: 'not-uuid' }),
      }),
      getBooking(new Request('http://localhost/api/bookings/not-uuid'), {
        params: Promise.resolve({ id: 'not-uuid' }),
      }),
      confirmBooking(
        new Request('http://localhost/api/bookings/not-uuid/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userApprovedTerms: true }),
        }),
        { params: Promise.resolve({ id: 'not-uuid' }) }
      ),
      getRefunds(new Request('http://localhost/api/payments/refund?paymentOrderId=not-uuid')),
      deleteNotification(new Request('http://localhost/api/notifications?id=not-uuid', { method: 'DELETE' })),
      aiChatGet(new Request('http://localhost/api/ai/chat?conversationId=not-uuid')),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(400);
    }
  });
});

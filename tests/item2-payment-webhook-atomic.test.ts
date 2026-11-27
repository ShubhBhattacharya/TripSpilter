import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface MockOrder {
  id: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  split_id: string | null;
  amount_paise: number;
  currency: string;
  status: string;
}

interface MockSplit {
  id: string;
  status: string;
  transaction_ref: string | null;
  paid_at: string | null;
}

interface MockEvent {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  processing_status: 'processing' | 'processed' | 'failed';
  retry_count: number;
  processing_started_at: string;
  processed_at: string;
  last_error: string | null;
}

const mockDb = {
  orders: new Map<string, MockOrder>(),
  splits: new Map<string, MockSplit>(),
  events: new Map<string, MockEvent>(),
  failMidTransaction: false,
  rpcCalled: false,
};

function resetMockDb() {
  mockDb.orders.clear();
  mockDb.splits.clear();
  mockDb.events.clear();
  mockDb.failMidTransaction = false;
  mockDb.rpcCalled = false;

  mockDb.orders.set('order_rzp_1', {
    id: 'ord-1',
    provider_order_id: 'order_rzp_1',
    provider_payment_id: null,
    split_id: 'spl-1',
    amount_paise: 100000,
    currency: 'INR',
    status: 'created',
  });
  mockDb.splits.set('spl-1', {
    id: 'spl-1',
    status: 'pending',
    transaction_ref: null,
    paid_at: null,
  });
}

function createTransactionalRpcMock() {
  return {
    rpc: async (fnName: string, args: Record<string, unknown>) => {
      if (fnName !== 'process_payment_webhook') {
        return { data: null, error: { message: `Unknown RPC ${fnName}` } };
      }
      mockDb.rpcCalled = true;

      // Snapshot for transactional rollback simulation
      const ordersSnapshot = structuredClone(Array.from(mockDb.orders.entries()));
      const splitsSnapshot = structuredClone(Array.from(mockDb.splits.entries()));
      const eventsSnapshot = structuredClone(Array.from(mockDb.events.entries()));

      try {
        const provider = String(args.p_provider || 'razorpay');
        const eventId = String(args.p_event_id);
        const eventType = String(args.p_event_type);
        const payload = args.p_payload as Record<string, unknown>;
        const staleSeconds = Number(args.p_stale_after_seconds ?? 300);

        const existing = mockDb.events.get(eventId);
        let reclaimedStale = false;
        let evt: MockEvent;

        if (existing) {
          if (existing.processing_status === 'processed') {
            return { data: { status: 'duplicate_replay', eventId }, error: null };
          }
          if (existing.processing_status === 'processing') {
            const ageMs = Date.now() - Date.parse(existing.processing_started_at);
            if (ageMs <= staleSeconds * 1000) {
              return { data: { status: 'in_progress', eventId }, error: null };
            }
            reclaimedStale = true;
          }
          evt = {
            ...existing,
            processing_status: 'processing',
            retry_count: existing.retry_count + 1,
            processing_started_at: new Date().toISOString(),
            last_error: null,
          };
          mockDb.events.set(eventId, evt);
        } else {
          evt = {
            id: `evt-${mockDb.events.size + 1}`,
            provider,
            event_id: eventId,
            event_type: eventType,
            processing_status: 'processing',
            retry_count: 0,
            processing_started_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            last_error: null,
          };
          mockDb.events.set(eventId, evt);
        }

        const paymentEntity = (
          payload.payload as {
            payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } };
          }
        )?.payment?.entity;

        if (paymentEntity?.order_id) {
          const order = mockDb.orders.get(paymentEntity.order_id);
          if (order && eventType === 'payment.captured') {
            const expectedCurr = order.currency.toUpperCase();
            const gotCurr = (paymentEntity.currency || '').toUpperCase();
            if (gotCurr && gotCurr !== expectedCurr) {
              const msg = `Captured payment currency (${gotCurr}) does not match order currency (${expectedCurr}).`;
              evt.processing_status = 'failed';
              evt.last_error = msg;
              return { data: { status: 'validation_error', httpStatus: 422, error: msg }, error: null };
            }
            if (typeof paymentEntity.amount === 'number' && paymentEntity.amount < order.amount_paise) {
              const msg = `Captured payment amount (${paymentEntity.amount} paise) is less than order amount (${order.amount_paise} paise).`;
              evt.processing_status = 'failed';
              evt.last_error = msg;
              return { data: { status: 'validation_error', httpStatus: 422, error: msg }, error: null };
            }
          }

          if (order) {
            const nextStatus =
              eventType === 'payment.captured'
                ? 'captured'
                : eventType === 'payment.failed'
                  ? 'failed'
                  : 'pending';
            order.status = nextStatus;
            order.provider_payment_id = paymentEntity.id || null;

            // Mid-transaction failure BEFORE or AFTER order update rolls back everything
            if (mockDb.failMidTransaction) {
              throw new Error('Simulated trigger failure on expense_splits');
            }

            if (order.split_id) {
              const split = mockDb.splits.get(order.split_id);
              if (split) {
                split.status = nextStatus === 'captured' ? 'verified_paid' : 'failed';
                split.transaction_ref = paymentEntity.id || null;
                split.paid_at = nextStatus === 'captured' ? new Date().toISOString() : null;
              }
            }
          }
        }

        evt.processing_status = 'processed';
        evt.processed_at = new Date().toISOString();

        return {
          data: { status: 'processed', eventId, reclaimedStale },
          error: null,
        };
      } catch (err) {
        // Full transaction rollback
        mockDb.orders = new Map(ordersSnapshot);
        mockDb.splits = new Map(splitsSnapshot);
        mockDb.events = new Map(eventsSnapshot);
        return {
          data: null,
          error: { message: err instanceof Error ? err.message : 'Transaction rolled back' },
        };
      }
    },
    from: () => {
      throw new Error('Route must use atomic process_payment_webhook RPC instead of piecemeal queries');
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => createTransactionalRpcMock(),
}));

import { POST as paymentWebhook } from '../src/app/api/payments/webhook/route';

function signBody(body: string, secret = 'test_webhook_secret_123'): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('Item 2: Atomic transactional payment webhook + 503 fail-closed + stale lock reclaim', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetMockDb();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-non-placeholder';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key';
    process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = 'test_webhook_secret_123';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defines process_payment_webhook RPC restricted to service_role with 5-minute stale reclaim', () => {
    const rpcMigration = path.resolve(
      process.cwd(),
      'supabase/migrations/20261128000002_payment_webhook_transaction_rpc.sql'
    );
    expect(fs.existsSync(rpcMigration)).toBe(true);
    const sql = fs.readFileSync(rpcMigration, 'utf8');
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.process_payment_webhook/i);
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.process_payment_webhook[\s\S]*TO\s+service_role/i);
    expect(sql).toMatch(/make_interval\s*\(\s*secs\s*=>/i);
  });

  it('returns 503 without verified field when service role key or Supabase config is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const body = JSON.stringify({ id: 'evt_missing_key', event: 'payment.captured' });
    const res = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': signBody(body),
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body,
      })
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).not.toHaveProperty('verified');
    expect(json.persisted).toBe(false);
  });

  it('returns 401 on invalid HMAC signature', async () => {
    const body = JSON.stringify({ id: 'evt_bad_sig', event: 'payment.captured' });
    const res = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': '0'.repeat(64) },
        body,
      })
    );
    expect(res.status).toBe(401);
  });

  it('returns 422 on payment amount or currency mismatch without altering order/split state', async () => {
    const underpaidBody = JSON.stringify({
      id: 'evt_underpaid',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_1', order_id: 'order_rzp_1', amount: 50000, currency: 'INR' } },
      },
    });
    const underRes = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': signBody(underpaidBody),
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body: underpaidBody,
      })
    );
    expect(underRes.status).toBe(422);
    expect(mockDb.orders.get('order_rzp_1')?.status).toBe('created');
    expect(mockDb.splits.get('spl-1')?.status).toBe('pending');

    const currencyBody = JSON.stringify({
      id: 'evt_bad_curr',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_2', order_id: 'order_rzp_1', amount: 100000, currency: 'USD' } },
      },
    });
    const currRes = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': signBody(currencyBody),
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body: currencyBody,
      })
    );
    expect(currRes.status).toBe(422);
  });

  it('returns duplicateReplay: true when replaying a processed event', async () => {
    const body = JSON.stringify({
      id: 'evt_ok_replay',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_ok_1', order_id: 'order_rzp_1', amount: 100000, currency: 'INR' } },
      },
    });
    const sig = signBody(body);
    const ts = String(Math.floor(Date.now() / 1000));

    const first = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig, 'x-webhook-timestamp': ts },
        body,
      })
    );
    expect(first.status).toBe(200);
    expect(mockDb.rpcCalled).toBe(true);
    expect(mockDb.orders.get('order_rzp_1')?.status).toBe('captured');
    expect(mockDb.splits.get('spl-1')?.status).toBe('verified_paid');

    const replay = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig, 'x-webhook-timestamp': ts },
        body,
      })
    );
    expect(replay.status).toBe(200);
    const replayJson = await replay.json();
    expect(replayJson.duplicateReplay).toBe(true);
  });

  it('rolls back order, split, and webhook event cleanly on mid-transaction failure and returns 500', async () => {
    mockDb.failMidTransaction = true;
    const body = JSON.stringify({
      id: 'evt_fail_mid_tx',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_fail_1', order_id: 'order_rzp_1', amount: 100000, currency: 'INR' } },
      },
    });
    const res = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': signBody(body),
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body,
      })
    );
    expect(res.status).toBe(500);
    // Zero partial state allowed
    expect(mockDb.orders.get('order_rzp_1')?.status).toBe('created');
    expect(mockDb.orders.get('order_rzp_1')?.provider_payment_id).toBeNull();
    expect(mockDb.splits.get('spl-1')?.status).toBe('pending');
    expect(mockDb.events.has('evt_fail_mid_tx')).toBe(false);
  });

  it('reclaims a stale processing row older than 5 minutes while returning 409 for active processing', async () => {
    const body = JSON.stringify({
      id: 'evt_stale_lock',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_stale_1', order_id: 'order_rzp_1', amount: 100000, currency: 'INR' } },
      },
    });
    const sig = signBody(body);
    const ts = String(Math.floor(Date.now() / 1000));

    // Active lock (2 minutes old) -> 409
    mockDb.events.set('evt_stale_lock', {
      id: 'evt-row-active',
      provider: 'razorpay',
      event_id: 'evt_stale_lock',
      event_type: 'payment.captured',
      processing_status: 'processing',
      retry_count: 0,
      processing_started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      processed_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      last_error: null,
    });
    const activeRes = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig, 'x-webhook-timestamp': ts },
        body,
      })
    );
    expect(activeRes.status).toBe(409);

    // Stale lock (6 minutes old) -> reclaimed & processed -> 200
    mockDb.events.set('evt_stale_lock', {
      id: 'evt-row-stale',
      provider: 'razorpay',
      event_id: 'evt_stale_lock',
      event_type: 'payment.captured',
      processing_status: 'processing',
      retry_count: 0,
      processing_started_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      processed_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      last_error: null,
    });
    const staleRes = await paymentWebhook(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': sig, 'x-webhook-timestamp': ts },
        body,
      })
    );
    expect(staleRes.status).toBe(200);
    const json = await staleRes.json();
    expect(json.reclaimedStale).toBe(true);
    expect(mockDb.events.get('evt_stale_lock')?.processing_status).toBe('processed');
    expect(mockDb.orders.get('order_rzp_1')?.status).toBe('captured');
    expect(mockDb.splits.get('spl-1')?.status).toBe('verified_paid');
  });
});

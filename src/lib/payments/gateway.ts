import crypto from 'node:crypto';

export interface CreateGatewayOrderInput {
  amountPaise: number;
  currency: string;
  receiptRef: string;
  notes?: Record<string, string>;
}

export interface CreateGatewayOrderResult {
  configured: boolean;
  provider: 'razorpay' | 'unconfigured';
  providerOrderId: string | null;
  status: 'created' | 'waiting_for_credentials';
  missingCredentials?: string[];
  disclaimer: string;
}

/**
 * Authorized Server-Side Payment Gateway Order Creation (Razorpay Standard Orders API).
 * Strictly distinguishes payment link/QR intent from server-verified payment settlement.
 */
export async function createServerPaymentOrder(
  input: CreateGatewayOrderInput
): Promise<CreateGatewayOrderResult> {
  const keyId = process.env.PAYMENT_PROVIDER_API_KEY?.trim();
  const keySecret = process.env.PAYMENT_PROVIDER_API_SECRET?.trim();

  if (!keyId || !keySecret) {
    return {
      configured: false,
      provider: 'unconfigured',
      providerOrderId: null,
      status: 'waiting_for_credentials',
      missingCredentials: [
        'PAYMENT_PROVIDER_API_KEY',
        'PAYMENT_PROVIDER_API_SECRET',
        'PAYMENT_PROVIDER_WEBHOOK_SECRET',
      ],
      disclaimer:
        'WAITING FOR PAYMENT PROVIDER CREDENTIALS: Live gateway checkout requires Razorpay API keys and webhook secret. UPI QR links alone never mark a payment as settled.',
    };
  }

  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receiptRef.slice(0, 40),
      notes: input.notes || {},
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Payment provider rejected order creation (HTTP ${res.status}).`);
  }

  const order = await res.json();
  return {
    configured: true,
    provider: 'razorpay',
    providerOrderId: String(order.id),
    status: 'created',
    disclaimer: 'Order initialized with Razorpay. Settlement confirms exclusively via verified webhook.',
  };
}

/**
 * Constant-time HMAC-SHA256 webhook signature verification.
 * Prevents spoofed callbacks or forged settlement confirmations.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined
): boolean {
  if (!signatureHeader || !webhookSecret || !rawBody) {
    return false;
  }

  const expectedHex = crypto
    .createHmac('sha256', webhookSecret.trim())
    .update(rawBody)
    .digest('hex');

  const provided = signatureHeader.trim();
  if (expectedHex.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expectedHex, 'utf8'), Buffer.from(provided, 'utf8'));
}

export function validateWebhookTimestamp(
  timestampHeader: string | null,
  maxSkewSeconds: number = 300,
  nowMs: number = Date.now()
): boolean {
  if (!timestampHeader) return false;
  const numeric = Number(timestampHeader);
  const parsedMs = Number.isFinite(numeric)
    ? numeric < 1e12
      ? numeric * 1000
      : numeric
    : Date.parse(timestampHeader);
  if (!Number.isFinite(parsedMs)) return false;
  return Math.abs(nowMs - parsedMs) <= maxSkewSeconds * 1000;
}

export interface CreateGatewayRefundInput {
  providerPaymentId: string;
  amountPaise: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface CreateGatewayRefundResult {
  configured: boolean;
  provider: 'razorpay' | 'unconfigured';
  providerRefundId: string | null;
  status: 'processed' | 'pending' | 'waiting_for_credentials';
  rawResponse?: Record<string, unknown>;
  missingCredentials?: string[];
  disclaimer: string;
}

/**
 * Authorized Server-Side Payment Refund Initiation (Razorpay Refunds API).
 * Returns waiting_for_credentials if provider keys are not configured.
 * Supports safe bounded retries ONLY when an explicit idempotencyKey is supplied.
 */
export async function createServerPaymentRefund(
  input: CreateGatewayRefundInput
): Promise<CreateGatewayRefundResult> {
  const keyId = process.env.PAYMENT_PROVIDER_API_KEY?.trim();
  const keySecret = process.env.PAYMENT_PROVIDER_API_SECRET?.trim();

  if (!keyId || !keySecret) {
    return {
      configured: false,
      provider: 'unconfigured',
      providerRefundId: null,
      status: 'waiting_for_credentials',
      missingCredentials: ['PAYMENT_PROVIDER_API_KEY', 'PAYMENT_PROVIDER_API_SECRET'],
      disclaimer:
        'WAITING FOR PAYMENT PROVIDER CREDENTIALS: Live gateway refund execution requires Razorpay API keys.',
    };
  }

  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const maxAttempts = input.idempotencyKey ? 2 : 1;
  let res: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    res = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.providerPaymentId)}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          ...(input.idempotencyKey ? { 'X-Idempotency-Key': input.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          amount: input.amountPaise,
          notes: {
            ...(input.reason ? { reason: input.reason.slice(0, 140) } : {}),
            ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey.slice(0, 80) } : {}),
          },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (res.ok || res.status < 500 || attempt === maxAttempts) break;
    await new Promise((r) => setTimeout(r, 350));
  }

  if (!res || !res.ok) {
    throw new Error(`Payment provider rejected refund request (HTTP ${res?.status ?? 'network_error'}).`);
  }

  const refund = (await res.json()) as Record<string, unknown>;
  return {
    configured: true,
    provider: 'razorpay',
    providerRefundId: String(refund.id || ''),
    status: refund.status === 'processed' ? 'processed' : 'pending',
    rawResponse: refund,
    disclaimer: 'Refund initiated with Razorpay. Final status reconciles via verified webhook.',
  };
}

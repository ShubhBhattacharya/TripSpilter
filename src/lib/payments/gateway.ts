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

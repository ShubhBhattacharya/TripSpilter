/**
 * Cryptographic & Identity Binding Helpers for Supplier Webhooks
 * Prevents direct/redirect/blank-provider bookings from bypassing supplier verification
 * and validates payload amounts, currencies & booking IDs before mutating state.
 */

export const ALLOWED_BOUND_SUPPLIERS = [
  'amadeus',
  'liteapi',
  'hotelbeds',
  'duffel',
  'razorpay',
  'stripe',
  'viator',
] as const;

export type BoundSupplierCode = (typeof ALLOWED_BOUND_SUPPLIERS)[number];

/**
 * Resolves a canonical supplier code strictly from stored DB provider fields.
 * Blank, "direct", "external provider", or unknown strings return null (fail closed).
 */
export function resolveBoundBookingSupplier(
  bookingProviderName: string | null | undefined,
  bookingMetadata?: Record<string, unknown> | null
): BoundSupplierCode | null {
  const metaCode = bookingMetadata?.supplierCode
    ? String(bookingMetadata.supplierCode).trim().toLowerCase()
    : '';

  if (metaCode && (ALLOWED_BOUND_SUPPLIERS as readonly string[]).includes(metaCode)) {
    return metaCode as BoundSupplierCode;
  }

  const normalized = (bookingProviderName || '').trim().toLowerCase();
  if (
    !normalized ||
    normalized.includes('direct') ||
    normalized.includes('external provider') ||
    normalized === 'other' ||
    normalized === 'unconfigured'
  ) {
    return null;
  }

  for (const supplier of ALLOWED_BOUND_SUPPLIERS) {
    if (normalized.includes(supplier)) {
      return supplier;
    }
  }

  return null;
}

/**
 * Resolves the provider-specific webhook secret from server environment.
 * Prefers BOOKING_WEBHOOK_SECRET_<PROVIDER>; falls back to BOOKING_PROVIDER_WEBHOOK_SECRET
 * only when no conflicting provider-specific secret override blocks it.
 */
export function resolveBookingWebhookSecret(provider: string): {
  secret: string | null;
  missingCredential: string;
} {
  const cleanProvider = provider.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const specificVar = cleanProvider ? `BOOKING_WEBHOOK_SECRET_${cleanProvider}` : '';
  const specificSecret = specificVar ? process.env[specificVar]?.trim() : undefined;
  if (specificSecret) {
    return { secret: specificSecret, missingCredential: specificVar };
  }

  const sharedSecret = process.env.BOOKING_PROVIDER_WEBHOOK_SECRET?.trim();
  if (sharedSecret) {
    return { secret: sharedSecret, missingCredential: 'BOOKING_PROVIDER_WEBHOOK_SECRET' };
  }

  return {
    secret: null,
    missingCredential: specificVar || 'BOOKING_PROVIDER_WEBHOOK_SECRET',
  };
}

/**
 * Checks that the incoming webhook's supplier matches the booking's stored supplier identity.
 * Strictly blocks unbound / direct / redirect bookings.
 */
export function doesWebhookProviderMatchBooking(
  webhookProvider: string,
  bookingProviderName: string | null | undefined,
  bookingMetadata?: Record<string, unknown> | null
): { matched: boolean; boundSupplier: BoundSupplierCode | null; reason?: string } {
  const wp = webhookProvider.trim().toLowerCase();
  if (!wp || !(ALLOWED_BOUND_SUPPLIERS as readonly string[]).includes(wp)) {
    return {
      matched: false,
      boundSupplier: null,
      reason: `Unsupported or unknown supplier code "${webhookProvider}".`,
    };
  }

  const boundSupplier = resolveBoundBookingSupplier(bookingProviderName, bookingMetadata);
  if (!boundSupplier) {
    return {
      matched: false,
      boundSupplier: null,
      reason:
        'Booking is not bound to an API-verified supplier (direct, external-redirect, or blank provider bookings cannot be confirmed via webhook).',
    };
  }

  if (boundSupplier !== wp) {
    return {
      matched: false,
      boundSupplier,
      reason: `Webhook provider "${wp}" does not match booking's bound supplier "${boundSupplier}".`,
    };
  }

  return { matched: true, boundSupplier };
}

/**
 * Validates optional bookingId, amount, and currency assertions inside supplierPayload
 * so tampered or cross-booking webhook payloads fail verification cleanly.
 */
export function validateSupplierWebhookPayloadConsistency(params: {
  bookingId: string;
  expectedAmountPaise: number;
  expectedCurrency: string;
  supplierPayload: Record<string, unknown>;
}): { valid: boolean; reason?: string } {
  const { bookingId, expectedAmountPaise, expectedCurrency, supplierPayload } = params;

  if (supplierPayload.bookingId !== undefined && String(supplierPayload.bookingId) !== bookingId) {
    return {
      valid: false,
      reason: `Payload bookingId "${String(supplierPayload.bookingId)}" does not match target booking "${bookingId}".`,
    };
  }

  if (typeof supplierPayload.amountPaise === 'number' && expectedAmountPaise > 0) {
    if (supplierPayload.amountPaise !== expectedAmountPaise) {
      return {
        valid: false,
        reason: `Payload amountPaise (${supplierPayload.amountPaise}) disagrees with booking (${expectedAmountPaise}).`,
      };
    }
  } else if (typeof supplierPayload.amount === 'number' && expectedAmountPaise > 0) {
    const payloadPaise = Math.round((supplierPayload.amount + Number.EPSILON) * 100);
    if (Math.abs(payloadPaise - expectedAmountPaise) > 1) {
      return {
        valid: false,
        reason: `Payload amount (${payloadPaise} paise) disagrees with booking (${expectedAmountPaise} paise).`,
      };
    }
  }

  if (supplierPayload.currency !== undefined) {
    const payloadCurrency = String(supplierPayload.currency).trim().toUpperCase();
    const expected = (expectedCurrency || 'INR').trim().toUpperCase();
    if (payloadCurrency && payloadCurrency !== expected) {
      return {
        valid: false,
        reason: `Payload currency "${payloadCurrency}" does not match booking currency "${expected}".`,
      };
    }
  }

  return { valid: true };
}

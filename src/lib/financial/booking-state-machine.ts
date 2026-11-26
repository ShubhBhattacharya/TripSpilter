/**
 * TripSplit Booking Lifecycle State Machine
 * Strictly separates user-initiated lifecycle changes from trusted server/webhook supplier transitions:
 * - User actions: Draft, Pending confirmation, Cancelled, Refund pending
 * - Trusted supplier/webhook actions: Confirmed by supplier, Failed, Refunded
 */

export type BookingLifecycleStatus =
  | 'Draft'
  | 'Pending confirmation'
  | 'Confirmed by supplier'
  | 'Failed'
  | 'Cancelled'
  | 'Refund pending'
  | 'Refunded';

export type BookingTransitionActor = 'user' | 'trusted_supplier_server';

export const USER_ALLOWED_TARGET_STATUSES: readonly BookingLifecycleStatus[] = [
  'Draft',
  'Pending confirmation',
  'Cancelled',
  'Refund pending',
] as const;

export const SUPPLIER_ONLY_TARGET_STATUSES: readonly BookingLifecycleStatus[] = [
  'Confirmed by supplier',
  'Refunded',
] as const;

const LEGACY_STATUS_MAP: Record<string, BookingLifecycleStatus> = {
  draft: 'Draft',
  'pending split': 'Pending confirmation',
  'pending confirmation': 'Pending confirmation',
  confirmed: 'Confirmed by supplier',
  'confirmed by supplier': 'Confirmed by supplier',
  settled: 'Confirmed by supplier',
  failed: 'Failed',
  cancelled: 'Cancelled',
  'refund pending': 'Refund pending',
  refunded: 'Refunded',
};

const ALLOWED_TRANSITIONS: Record<BookingLifecycleStatus, readonly BookingLifecycleStatus[]> = {
  Draft: ['Pending confirmation', 'Confirmed by supplier', 'Failed', 'Cancelled'],
  'Pending confirmation': ['Confirmed by supplier', 'Failed', 'Cancelled'],
  'Confirmed by supplier': ['Cancelled', 'Refund pending'],
  Failed: ['Draft', 'Pending confirmation', 'Cancelled'],
  Cancelled: ['Refund pending', 'Refunded'],
  'Refund pending': ['Refunded', 'Cancelled'],
  Refunded: [],
};

const SUPPLIER_REF_REGEX = /^(?!DRAFT-|MOCK-|FAKE-|TEST-)[A-Z0-9][A-Z0-9_-]{3,63}$/i;

export function isValidSupplierConfirmationRef(ref?: string | null): boolean {
  if (!ref) return false;
  return SUPPLIER_REF_REGEX.test(ref.trim());
}

export function normalizeBookingLifecycleStatus(status: string): BookingLifecycleStatus {
  const key = (status || '').trim().toLowerCase();
  return LEGACY_STATUS_MAP[key] || 'Draft';
}

export function validateBookingTransition(params: {
  currentStatus: string;
  targetStatus: BookingLifecycleStatus;
  actorType?: BookingTransitionActor;
  providerConfirmationRef?: string | null;
  hasVerifiedSupplierPayload?: boolean;
  refundReconciled?: boolean;
  isBookingOwnerOrAdmin: boolean;
}): { allowed: boolean; normalizedCurrent: BookingLifecycleStatus; error?: string } {
  const actorType: BookingTransitionActor = params.actorType || 'user';
  const normalizedCurrent = normalizeBookingLifecycleStatus(params.currentStatus);

  if (!params.isBookingOwnerOrAdmin && actorType !== 'trusted_supplier_server') {
    return {
      allowed: false,
      normalizedCurrent,
      error: 'Only the trip admin or booking creator can update booking lifecycle status.',
    };
  }

  // Strictly block normal users from self-confirming supplier bookings or marking refunded
  if (actorType === 'user' && SUPPLIER_ONLY_TARGET_STATUSES.includes(params.targetStatus)) {
    return {
      allowed: false,
      normalizedCurrent,
      error: `Forbidden: Users cannot directly set booking status to "${params.targetStatus}". Supplier confirmation and refund completion require an authenticated server/webhook verification.`,
    };
  }

  if (normalizedCurrent === params.targetStatus) {
    return { allowed: true, normalizedCurrent };
  }

  const allowedTargets = ALLOWED_TRANSITIONS[normalizedCurrent];
  if (!allowedTargets.includes(params.targetStatus)) {
    return {
      allowed: false,
      normalizedCurrent,
      error: `Invalid booking status transition: "${normalizedCurrent}" -> "${params.targetStatus}".`,
    };
  }

  if (params.targetStatus === 'Confirmed by supplier') {
    if (!isValidSupplierConfirmationRef(params.providerConfirmationRef)) {
      return {
        allowed: false,
        normalizedCurrent,
        error:
          'A valid supplier confirmation reference (non-draft PNR/reference >= 4 alphanumeric chars) is required for Confirmed by supplier.',
      };
    }
    if (!params.hasVerifiedSupplierPayload) {
      return {
        allowed: false,
        normalizedCurrent,
        error:
          'Confirmed by supplier requires a verified provider response or authenticated webhook payload.',
      };
    }
  }

  if (params.targetStatus === 'Refunded' && params.refundReconciled === false) {
    return {
      allowed: false,
      normalizedCurrent,
      error: 'Booking cannot transition to Refunded before payment provider refund reconciliation completes.',
    };
  }

  return { allowed: true, normalizedCurrent };
}

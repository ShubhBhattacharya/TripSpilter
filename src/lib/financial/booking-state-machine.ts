/**
 * TripSplit Booking Lifecycle State Machine
 * Strictly enforces honest supplier booking & refund transitions:
 * Draft -> Pending confirmation -> Confirmed by supplier / Failed -> Cancelled -> Refund pending -> Refunded
 */

export type BookingLifecycleStatus =
  | 'Draft'
  | 'Pending confirmation'
  | 'Confirmed by supplier'
  | 'Failed'
  | 'Cancelled'
  | 'Refund pending'
  | 'Refunded';

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
  Cancelled: ['Refund pending'],
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
  providerConfirmationRef?: string | null;
  hasVerifiedSupplierPayload?: boolean;
  hasSupplierConfirmationRef?: boolean; // Backward compat flag
  isBookingOwnerOrAdmin: boolean;
}): { allowed: boolean; normalizedCurrent: BookingLifecycleStatus; error?: string } {
  const normalizedCurrent = normalizeBookingLifecycleStatus(params.currentStatus);

  if (!params.isBookingOwnerOrAdmin) {
    return {
      allowed: false,
      normalizedCurrent,
      error: 'Only the trip admin or booking creator can update booking lifecycle status.',
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
    const refOk = params.providerConfirmationRef
      ? isValidSupplierConfirmationRef(params.providerConfirmationRef)
      : Boolean(params.hasSupplierConfirmationRef);
    if (!refOk) {
      return {
        allowed: false,
        normalizedCurrent,
        error:
          'A valid supplier confirmation reference (non-draft PNR/reference >= 4 alphanumeric chars) is required for Confirmed by supplier.',
      };
    }
    if (params.hasVerifiedSupplierPayload === false) {
      return {
        allowed: false,
        normalizedCurrent,
        error:
          'Confirmed by supplier requires a verified provider response or webhook payload; an API key alone cannot confirm bookings.',
      };
    }
  }

  return { allowed: true, normalizedCurrent };
}

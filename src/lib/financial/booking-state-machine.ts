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

export function normalizeBookingLifecycleStatus(status: string): BookingLifecycleStatus {
  const key = (status || '').trim().toLowerCase();
  return LEGACY_STATUS_MAP[key] || 'Draft';
}

export function validateBookingTransition(params: {
  currentStatus: string;
  targetStatus: BookingLifecycleStatus;
  hasSupplierConfirmationRef?: boolean;
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

  if (params.targetStatus === 'Confirmed by supplier' && !params.hasSupplierConfirmationRef) {
    return {
      allowed: false,
      normalizedCurrent,
      error: 'Supplier confirmation reference is required to mark booking as Confirmed by supplier.',
    };
  }

  return { allowed: true, normalizedCurrent };
}

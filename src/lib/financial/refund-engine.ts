/**
 * Deterministic Zero-Tolerance Refund Validation & Reconciliation Engine
 * Operates strictly in integer paise to prevent cumulative over-refunds or float drift.
 */

export type RefundRecordStatus =
  | 'pending'
  | 'processed'
  | 'failed'
  | 'waiting_for_credentials'
  | 'reconciliation_required';

export interface ExistingRefundRecord {
  id: string;
  amountPaise: number;
  status: string;
}

/**
 * Counts all active (`pending` + `processed`) refund reservations toward cumulative cap.
 * `failed` and `waiting_for_credentials` records do not lock captured funds.
 */
export function calculateReservedAndProcessedPaise(existingRefunds: ExistingRefundRecord[]): {
  processedPaise: number;
  pendingPaise: number;
  reservedTotalPaise: number;
} {
  let processedPaise = 0;
  let pendingPaise = 0;

  for (const r of existingRefunds) {
    const amt = Math.max(0, Math.round(Number(r.amountPaise) || 0));
    if (r.status === 'processed') {
      processedPaise += amt;
    } else if (r.status === 'pending' || r.status === 'reconciliation_required') {
      pendingPaise += amt;
    }
  }

  return {
    processedPaise,
    pendingPaise,
    reservedTotalPaise: processedPaise + pendingPaise,
  };
}

export function validateRefundRequest(params: {
  orderStatus: string;
  orderAmountPaise: number;
  requestedPaise: number;
  existingRefunds: ExistingRefundRecord[];
}): {
  allowed: boolean;
  remainingRefundablePaise: number;
  error?: string;
} {
  const { orderStatus, orderAmountPaise, requestedPaise, existingRefunds } = params;

  if (orderStatus !== 'captured' && orderStatus !== 'partially_refunded') {
    return {
      allowed: false,
      remainingRefundablePaise: 0,
      error: `Only captured or partially refunded orders can be refunded (current status: ${orderStatus}).`,
    };
  }

  if (!Number.isInteger(requestedPaise) || requestedPaise <= 0) {
    return {
      allowed: false,
      remainingRefundablePaise: Math.max(0, orderAmountPaise),
      error: 'Refund amount must be a positive integer in paise.',
    };
  }

  const { reservedTotalPaise } = calculateReservedAndProcessedPaise(existingRefunds);
  const remainingRefundablePaise = Math.max(0, orderAmountPaise - reservedTotalPaise);

  if (requestedPaise > remainingRefundablePaise) {
    return {
      allowed: false,
      remainingRefundablePaise,
      error: `Requested refund (₹${(requestedPaise / 100).toFixed(
        2
      )}) exceeds remaining refundable balance (₹${(remainingRefundablePaise / 100).toFixed(2)}).`,
    };
  }

  return { allowed: true, remainingRefundablePaise };
}

export function computeReconciledOrderStatus(params: {
  orderAmountPaise: number;
  processedRefundsPaise: number;
}): 'captured' | 'partially_refunded' | 'refunded' {
  if (params.processedRefundsPaise <= 0) return 'captured';
  if (params.processedRefundsPaise >= params.orderAmountPaise) return 'refunded';
  return 'partially_refunded';
}

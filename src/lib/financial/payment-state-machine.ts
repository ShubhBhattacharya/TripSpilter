/**
 * TripSplit Payment State Transition Machine
 * Enforces strict role-based state transitions for payment shares and settlements.
 *
 * Rules:
 * - A debtor can initiate payment or manually report payment (with UPI reference/UTR).
 * - A debtor can NEVER mark their own payment as "verified_paid".
 * - Only the creditor (payer) or a trip admin can verify receipt of funds ("verified_paid").
 * - Creditors or trip admins can reject unverified payment claims ("rejected").
 * - Arbitrary state jumping and cross-user tampering is strictly blocked.
 */

import { PaymentVerificationState } from './upi-engine';
export type { PaymentVerificationState };

export interface StateTransitionContext {
  currentStatus: PaymentVerificationState | string;
  targetStatus: PaymentVerificationState | string;
  isDebtor: boolean;
  isCreditor: boolean;
  isAdmin: boolean;
  transactionRef?: string | null;
}

export interface TransitionValidationResult {
  allowed: boolean;
  error?: string;
  sanitizedTargetStatus?: PaymentVerificationState;
  requiresTransactionRef?: boolean;
}

export const VALID_PAYMENT_STATES: readonly PaymentVerificationState[] = [
  'pending',
  'payment_initiated',
  'awaiting_confirmation',
  'manually_reported_paid',
  'verified_paid',
  'failed',
  'rejected',
] as const;

export function isValidPaymentState(state: string): state is PaymentVerificationState {
  return VALID_PAYMENT_STATES.includes(state as PaymentVerificationState);
}

/**
 * Validates whether a requested payment state transition is authorized and semantically valid.
 */
export function validatePaymentStateTransition(
  context: StateTransitionContext
): TransitionValidationResult {
  const { currentStatus, targetStatus, isDebtor, isCreditor, isAdmin, transactionRef: _transactionRef } = context;

  // 1. Normalize and validate state values
  if (!isValidPaymentState(currentStatus)) {
    return {
      allowed: false,
      error: `Invalid current payment status: "${currentStatus}"`,
    };
  }

  if (!isValidPaymentState(targetStatus)) {
    return {
      allowed: false,
      error: `Invalid target payment status: "${targetStatus}"`,
    };
  }

  // Idempotent state update
  if (currentStatus === targetStatus) {
    return {
      allowed: true,
      sanitizedTargetStatus: targetStatus,
    };
  }

  // Once verified, only an admin can reverse or re-open
  if (currentStatus === 'verified_paid') {
    if (!isAdmin) {
      return {
        allowed: false,
        error: 'Verified payments are immutable and cannot be altered except by a trip admin.',
      };
    }
  }

  // 2. Prevent Debtor from self-verifying payments
  if (targetStatus === 'verified_paid') {
    if (!isCreditor && !isAdmin) {
      return {
        allowed: false,
        error:
          'Unauthorized: Only the creditor (payer) or a trip admin can verify receipt of funds. Debtors cannot self-verify payments.',
      };
    }
  }

  // 3. Actions specific to Debtor (the one who owes money)
  if (isDebtor && !isCreditor && !isAdmin) {
    // Debtor opening UPI app
    if (targetStatus === 'payment_initiated') {
      if (currentStatus === 'pending' || currentStatus === 'rejected') {
        return {
          allowed: true,
          sanitizedTargetStatus: 'payment_initiated',
        };
      }
    }

    // Debtor self-reporting payment
    if (targetStatus === 'manually_reported_paid' || targetStatus === 'awaiting_confirmation') {
      if (
        currentStatus === 'pending' ||
        currentStatus === 'payment_initiated' ||
        currentStatus === 'rejected' ||
        currentStatus === 'failed'
      ) {
        return {
          allowed: true,
          sanitizedTargetStatus: 'manually_reported_paid',
        };
      }
    }

    // Debtor marking payment as failed
    if (targetStatus === 'failed') {
      if (currentStatus === 'payment_initiated') {
        return {
          allowed: true,
          sanitizedTargetStatus: 'failed',
        };
      }
    }

    return {
      allowed: false,
      error: `Unauthorized transition: Debtors cannot change status from "${currentStatus}" to "${targetStatus}".`,
    };
  }

  // 4. Actions for Creditor (the one who paid the bill / to whom money is owed) or Trip Admin
  if (isCreditor || isAdmin) {
    // Verifying payment
    if (targetStatus === 'verified_paid') {
      return {
        allowed: true,
        sanitizedTargetStatus: 'verified_paid',
      };
    }

    // Rejecting payment claim (e.g. money not received in bank)
    if (targetStatus === 'rejected') {
      if (
        currentStatus === 'manually_reported_paid' ||
        currentStatus === 'awaiting_confirmation' ||
        currentStatus === 'payment_initiated'
      ) {
        return {
          allowed: true,
          sanitizedTargetStatus: 'rejected',
        };
      }
    }

    // Reverting to pending
    if (targetStatus === 'pending') {
      return {
        allowed: true,
        sanitizedTargetStatus: 'pending',
      };
    }
  }

  // Neither debtor nor creditor nor admin
  return {
    allowed: false,
    error: 'Access denied: You do not have permission to modify this payment status.',
  };
}
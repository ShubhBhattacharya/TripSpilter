/**
 * TripSplit UPI Engine
 * Spec compliant with NPCI Unified Payments Interface Linking Specifications.
 */

export const UPI_VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export type PaymentVerificationState =
  | 'pending'
  | 'payment_initiated'
  | 'awaiting_confirmation'
  | 'manually_reported_paid'
  | 'verified_paid'
  | 'failed'
  | 'rejected';

export interface PaymentStateMeta {
  state: PaymentVerificationState;
  label: string;
  badgeColor: string;
  isConfirmed: boolean;
  isSelfReported: boolean;
  description: string;
}

export const PAYMENT_STATES_CONFIG: Record<PaymentVerificationState, PaymentStateMeta> = {
  pending: {
    state: 'pending',
    label: 'Pending',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    isConfirmed: false,
    isSelfReported: false,
    description: 'Payment has not been started yet.',
  },
  payment_initiated: {
    state: 'payment_initiated',
    label: 'App Opened',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    isConfirmed: false,
    isSelfReported: false,
    description: 'UPI app intent was opened on member device.',
  },
  awaiting_confirmation: {
    state: 'awaiting_confirmation',
    label: 'Awaiting Proof',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    isConfirmed: false,
    isSelfReported: false,
    description: 'Transaction reference submitted, awaiting peer acknowledgement.',
  },
  manually_reported_paid: {
    state: 'manually_reported_paid',
    label: 'Reported Paid (Manual)',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    isConfirmed: false,
    isSelfReported: true,
    description: 'Member marked as paid. Bank reconciliation not connected.',
  },
  verified_paid: {
    state: 'verified_paid',
    label: 'Verified Paid ✅',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    isConfirmed: true,
    isSelfReported: false,
    description: 'Confirmed by payee or bank transaction receipt.',
  },
  failed: {
    state: 'failed',
    label: 'Payment Failed',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    isConfirmed: false,
    isSelfReported: false,
    description: 'UPI payment attempt was cancelled or declined.',
  },
  rejected: {
    state: 'rejected',
    label: 'Rejected',
    badgeColor: 'bg-slate-700 text-slate-400 border-slate-600',
    isConfirmed: false,
    isSelfReported: false,
    description: 'Claimed payment was rejected by recipient.',
  },
};

export interface ParsedUpiPayload {
  isValid: boolean;
  payeeVpa?: string;
  payeeName?: string;
  amount?: number;
  transactionNote?: string;
  transactionRef?: string;
  rawPayload: string;
  error?: string;
}

/**
 * Parses raw UPI QR payloads (e.g. "upi://pay?pa=cafe@icici&pn=Cafe%201947&am=1000&cu=INR")
 */
export function parseUpiQrPayload(rawText: string): ParsedUpiPayload {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return { isValid: false, rawPayload: rawText, error: 'Empty QR string' };
  }

  // Handle case where text is a plain VPA (e.g. "name@okhdfcbank")
  if (UPI_VPA_REGEX.test(trimmed)) {
    return {
      isValid: true,
      payeeVpa: trimmed.toLowerCase(),
      payeeName: trimmed.split('@')[0],
      rawPayload: rawText,
    };
  }

  if (!trimmed.toLowerCase().startsWith('upi://pay')) {
    return {
      isValid: false,
      rawPayload: rawText,
      error: 'Not a valid NPCI UPI QR code (must start with upi://pay)',
    };
  }

  try {
    // Parse query params safely
    const queryPart = trimmed.includes('?') ? trimmed.split('?')[1] : '';
    const params = new URLSearchParams(queryPart);

    const pa = params.get('pa') || params.get('PA');
    const pn = params.get('pn') || params.get('PN');
    const am = params.get('am') || params.get('AM');
    const cu = params.get('cu') || params.get('CU') || 'INR';
    const tn = params.get('tn') || params.get('TN');
    const tr = params.get('tr') || params.get('TR');

    if (!pa || !UPI_VPA_REGEX.test(pa)) {
      return {
        isValid: false,
        rawPayload: rawText,
        error: `Invalid or missing Payee VPA: "${pa}"`,
      };
    }

    if (cu && cu.toUpperCase() !== 'INR') {
      return {
        isValid: false,
        rawPayload: rawText,
        error: `Invalid currency: "${cu}". UPI only supports INR.`,
      };
    }

    const parsedAmount = am ? parseFloat(am) : undefined;
    if (parsedAmount !== undefined && (isNaN(parsedAmount) || parsedAmount < 0)) {
      return {
        isValid: false,
        rawPayload: rawText,
        error: `Invalid amount in QR: "${am}"`,
      };
    }

    return {
      isValid: true,
      payeeVpa: pa.toLowerCase(),
      payeeName: pn ? decodeURIComponent(pn) : pa.split('@')[0],
      amount: parsedAmount,
      transactionNote: tn ? decodeURIComponent(tn) : undefined,
      transactionRef: tr ? decodeURIComponent(tr) : undefined,
      rawPayload: rawText,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to parse UPI QR code';
    return {
      isValid: false,
      rawPayload: rawText,
      error: errorMsg,
    };
  }
}

/**
 * Builds a strict, validated NPCI UPI Deep Link URI.
 */
export function buildVerifiedUpiUri(params: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  transactionNote?: string;
  transactionRef?: string;
}): string {
  const cleanVpa = params.payeeVpa.trim().toLowerCase();
  if (!UPI_VPA_REGEX.test(cleanVpa)) {
    throw new Error(`Invalid UPI VPA address: "${cleanVpa}"`);
  }

  if (params.amount <= 0) {
    throw new Error(`Payment amount must be greater than zero. Received: ${params.amount}`);
  }

  const cleanName = encodeURIComponent(params.payeeName.trim().slice(0, 100));
  const formattedAmount = params.amount.toFixed(2);
  const cleanNote = encodeURIComponent((params.transactionNote || 'TripSplit Payment').slice(0, 80));

  let uri = `upi://pay?pa=${cleanVpa}&pn=${cleanName}&am=${formattedAmount}&cu=INR&tn=${cleanNote}`;

  if (params.transactionRef) {
    uri += `&tr=${encodeURIComponent(params.transactionRef.slice(0, 50))}`;
  }

  return uri;
}

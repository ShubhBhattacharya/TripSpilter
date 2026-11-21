/**
 * Utility for Indian UPI URI Generation and Indian Number Formatting
 */

export function generateUpiUri({
  payeeVpa,
  payeeName,
  amount,
  transactionNote = 'TripSplit UPI Payment',
  transactionRef,
}: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  transactionNote?: string;
  transactionRef?: string;
}): string {
  const cleanVpa = payeeVpa.trim();
  const cleanName = encodeURIComponent(payeeName.trim());
  const cleanNote = encodeURIComponent(transactionNote.trim());
  const formattedAmount = amount.toFixed(2);

  let uri = `upi://pay?pa=${cleanVpa}&pn=${cleanName}&am=${formattedAmount}&cu=INR&tn=${cleanNote}`;
  if (transactionRef) {
    uri += `&tr=${encodeURIComponent(transactionRef)}`;
  }
  return uri;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactInr(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)} L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}k`;
  }
  return `₹${amount}`;
}

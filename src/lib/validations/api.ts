import { z } from 'zod';

// Indian UPI Virtual Payment Address (VPA) regex validation
// Examples: rahul@okhdfcbank, 9876543210@paytm, merchant.store@icici
export const upiIdRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

// Common string sanitization (prevent XSS / control characters)
const sanitizeString = (str: string) => str.replace(/[<>]/g, '').trim();

export const createTripSchema = z.object({
  title: z
    .string()
    .min(2, 'Trip title must be at least 2 characters')
    .max(100, 'Trip title cannot exceed 100 characters')
    .transform(sanitizeString),
  destination: z
    .string()
    .min(2, 'Destination must be at least 2 characters')
    .max(120, 'Destination cannot exceed 120 characters')
    .transform(sanitizeString),
  startDate: z
    .string()
    .min(4, 'Start date is required')
    .transform(sanitizeString),
  endDate: z
    .string()
    .min(4, 'End date is required')
    .transform(sanitizeString),
  budget: z
    .number({ message: 'Budget must be a valid number' })
    .min(0, 'Budget cannot be negative')
    .max(100000000, 'Budget exceeds maximum limit'),
  coverImage: z
    .string()
    .url('Cover image must be a valid URL')
    .optional()
    .default(
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80'
    ),
});

export const splitMemberShareSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amountOwed: z
    .number({ message: 'Amount must be a number' })
    .min(0, 'Share amount cannot be negative'),
});

export const createExpenseSchema = z.object({
  tripId: z.string().min(1, 'Trip ID is required'),
  vendorName: z
    .string()
    .min(1, 'Vendor name is required')
    .max(100, 'Vendor name too long')
    .transform(sanitizeString),
  vendorUpiId: z
    .string()
    .regex(upiIdRegex, 'Invalid Indian UPI ID format (e.g. name@okhdfcbank or merchant@paytm)'),
  totalAmount: z
    .number({ message: 'Total amount must be a number' })
    .positive('Total bill amount must be greater than zero')
    .max(10000000, 'Amount exceeds single transaction limit'),
  splitType: z.enum(['EQUAL', 'EXACT', 'ITEMIZED']).default('EQUAL'),
  notes: z
    .string()
    .max(250, 'Notes cannot exceed 250 characters')
    .optional()
    .transform((val) => (val ? sanitizeString(val) : undefined)),
  splits: z
    .array(splitMemberShareSchema)
    .min(1, 'At least one member split is required'),
});

export const updateSplitStatusSchema = z.object({
  status: z.enum(['pending', 'paid']),
  transactionRef: z
    .string()
    .max(100)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : undefined)),
});

export const generateUpiLinkSchema = z.object({
  payeeVpa: z
    .string()
    .regex(upiIdRegex, 'Invalid payee UPI ID format'),
  payeeName: z
    .string()
    .min(1, 'Payee name is required')
    .max(100)
    .transform(sanitizeString),
  amount: z
    .number({ message: 'Amount must be a number' })
    .positive('Payment amount must be greater than zero')
    .max(1000000, 'UPI transaction limit is ₹10,00,000 per transaction'),
  transactionNote: z
    .string()
    .max(80, 'Transaction note must not exceed 80 characters for UPI standards')
    .optional()
    .default('TripSplit Direct Payment'),
  transactionRef: z
    .string()
    .max(50)
    .optional(),
});

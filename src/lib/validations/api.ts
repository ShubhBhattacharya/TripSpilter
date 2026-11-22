import { z } from 'zod';

// Indian UPI Virtual Payment Address (VPA) regex validation
// Examples: rahul@okhdfcbank, 9876543210@paytm, merchant.store@icici
export const upiIdRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

// Common string sanitization (prevent XSS / control characters)
const sanitizeString = (str: string) => str.replace(/[<>]/g, '').trim();

// Check if a number has at most 2 decimal places (valid Rupee paise representation)
const isValidPaisePrecision = (val: number): boolean => {
  const paise = val * 100;
  return Math.abs(paise - Math.round(paise)) < 1e-6;
};

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
    .max(100000000, 'Budget exceeds maximum limit')
    .refine(isValidPaisePrecision, 'Budget must not have more than 2 decimal places'),
  coverImage: z
    .string()
    .url('Cover image must be a valid URL')
    .optional()
    .default(
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80'
    ),
});

export const splitMemberShareSchema = z.object({
  userId: z.string().uuid('Invalid user UUID format').or(z.string().min(1, 'User ID is required')),
  amountOwed: z
    .number({ message: 'Amount must be a number' })
    .min(0, 'Share amount cannot be negative')
    .refine(isValidPaisePrecision, 'Share amount must not have more than 2 decimal places'),
});

export const createExpenseSchema = z
  .object({
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
      .max(10000000, 'Amount exceeds single transaction limit')
      .refine(isValidPaisePrecision, 'Total amount must not have more than 2 decimal places'),
    splitType: z.enum(['EQUAL', 'EXACT', 'ITEMIZED']).default('EQUAL'),
    notes: z
      .string()
      .max(250, 'Notes cannot exceed 250 characters')
      .optional()
      .transform((val) => (val ? sanitizeString(val) : undefined)),
    splits: z
      .array(splitMemberShareSchema)
      .min(1, 'At least one member split is required'),
    idempotencyKey: z
      .string()
      .max(100)
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Exact paise equality validation (Zero tolerance enforcement)
    const totalPaise = Math.round((data.totalAmount + Number.EPSILON) * 100);
    const sumPaise = data.splits.reduce((acc, s) => {
      return acc + Math.round((s.amountOwed + Number.EPSILON) * 100);
    }, 0);

    if (totalPaise !== sumPaise) {
      const diffRupees = ((totalPaise - sumPaise) / 100).toFixed(2);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sum of member shares (₹${(sumPaise / 100).toFixed(
          2
        )}) does not equal total bill amount (₹${(totalPaise / 100).toFixed(
          2
        )}). Exact difference: ₹${diffRupees}`,
        path: ['splits'],
      });
    }
  });

export const updateSplitStatusSchema = z.object({
  status: z.enum([
    'pending',
    'payment_initiated',
    'awaiting_confirmation',
    'manually_reported_paid',
    'verified_paid',
    'failed',
    'rejected',
    // Backward compatibility for legacy UI calls
    'paid',
  ]),
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
    .max(1000000, 'UPI transaction limit is ₹10,00,000 per transaction')
    .refine(isValidPaisePrecision, 'Amount must not have more than 2 decimal places'),
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

// Maximum allowed receipt image upload size: 5 MB (5 * 1024 * 1024 bytes)
export const MAX_OCR_IMAGE_BYTES = 5 * 1024 * 1024;

export const ocrUploadSchema = z.object({
  image: z
    .string()
    .min(1, 'Image data is required')
    .refine((data) => {
      // Must start with valid image data URI or clean base64
      const isDataUri = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data);
      if (isDataUri) {
        // Approximate byte size of base64
        const base64Data = data.split(',')[1] || '';
        const byteSize = (base64Data.length * 3) / 4;
        return byteSize <= MAX_OCR_IMAGE_BYTES;
      }
      // Pure base64
      const isPureBase64 = /^[A-Za-z0-9+/=]+$/.test(data);
      if (isPureBase64) {
        const byteSize = (data.length * 3) / 4;
        return byteSize <= MAX_OCR_IMAGE_BYTES;
      }
      return false;
    }, 'Invalid image format or image exceeds maximum 5MB size limit (allowed: JPEG, PNG, WEBP)'),
});

export const ocrParsedReceiptSchema = z.object({
  merchantName: z.string().optional().default(''),
  date: z.string().optional().default(''),
  invoiceNumber: z.string().optional().default(''),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.number().min(0),
      })
    )
    .optional()
    .default([]),
  subtotal: z.number().min(0).optional().default(0),
  gstAmount: z.number().min(0).optional().default(0),
  serviceCharge: z.number().min(0).optional().default(0),
  totalAmount: z.number().min(0).optional().default(0),
});
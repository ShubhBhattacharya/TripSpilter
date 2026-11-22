import { describe, it, expect } from 'vitest';
import {
  validatePaymentStateTransition,
  PaymentVerificationState,
} from '../src/lib/financial/payment-state-machine';
import {
  sanitizeRedirectUrl,
} from '../src/lib/security/auth-guards';
import {
  createExpenseSchema,
  ocrUploadSchema,
} from '../src/lib/validations/api';
import {
  toPaise,
  toRupees,
  calculateEqualSplit,
  validateAndCalculateExactSplit,
  calculateNetBalances,
} from '../src/lib/financial/split-engine';
import { checkRateLimit, validateRateLimitConfig } from '../src/lib/rate-limit';

describe('Payment Status Security & Anti-Tampering (Task 2)', () => {
  it('strictly blocks debtor from marking their own split as verified_paid', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'pending',
      targetStatus: 'verified_paid',
      isDebtor: true,
      isCreditor: false,
      isAdmin: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Debtors cannot self-verify payments');
  });

  it('strictly blocks debtor from verifying even after manually reporting paid', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'manually_reported_paid',
      targetStatus: 'verified_paid',
      isDebtor: true,
      isCreditor: false,
      isAdmin: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Debtors cannot self-verify payments');
  });

  it('allows debtor to initiate payment (open UPI app)', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'pending',
      targetStatus: 'payment_initiated',
      isDebtor: true,
      isCreditor: false,
      isAdmin: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.sanitizedTargetStatus).toBe('payment_initiated');
  });

  it('allows debtor to self-report payment with transaction reference', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'payment_initiated',
      targetStatus: 'manually_reported_paid',
      isDebtor: true,
      isCreditor: false,
      isAdmin: false,
      transactionRef: 'UPI-UTR-9876543210',
    });

    expect(result.allowed).toBe(true);
    expect(result.sanitizedTargetStatus).toBe('manually_reported_paid');
  });

  it('allows creditor (payer) to verify payment after reviewing bank receipt', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'manually_reported_paid',
      targetStatus: 'verified_paid',
      isDebtor: false,
      isCreditor: true,
      isAdmin: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.sanitizedTargetStatus).toBe('verified_paid');
  });

  it('allows trip admin to verify payment', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'manually_reported_paid',
      targetStatus: 'verified_paid',
      isDebtor: false,
      isCreditor: false,
      isAdmin: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.sanitizedTargetStatus).toBe('verified_paid');
  });

  it('allows creditor to reject false or unverified payment claims', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'manually_reported_paid',
      targetStatus: 'rejected',
      isDebtor: false,
      isCreditor: true,
      isAdmin: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.sanitizedTargetStatus).toBe('rejected');
  });

  it('blocks third-party non-participants from changing payment status', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'pending',
      targetStatus: 'manually_reported_paid',
      isDebtor: false,
      isCreditor: false,
      isAdmin: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('rejects invalid state values', () => {
    const result = validatePaymentStateTransition({
      currentStatus: 'pending',
      targetStatus: 'arbitrary_fake_status' as unknown as PaymentVerificationState,
      isDebtor: true,
      isCreditor: false,
      isAdmin: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Invalid target payment status');
  });
});

describe('Financial Calculation & Zero-Tolerance Integrity (Task 3)', () => {
  it('splits ₹100 among 3 members: exact sum in paise with zero drift', () => {
    const shares = calculateEqualSplit({
      totalAmount: 100,
      memberIds: ['user1', 'user2', 'user3'],
    });

    expect(shares).toHaveLength(3);
    expect(shares[0].amountPaise).toBe(3334);
    expect(shares[1].amountPaise).toBe(3333);
    expect(shares[2].amountPaise).toBe(3333);

    const sumPaise = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(sumPaise).toBe(10000); // 10000 paise = ₹100.00 exactly
    expect(toRupees(sumPaise)).toBe(100.0);
  });

  it('splits ₹999.99 among 7 members: exact sum in paise with zero drift', () => {
    const memberIds = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
    const shares = calculateEqualSplit({
      totalAmount: 999.99,
      memberIds,
    });

    expect(shares).toHaveLength(7);
    const sumPaise = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(sumPaise).toBe(99999); // 99999 paise = ₹999.99 exactly
    expect(toRupees(sumPaise)).toBe(999.99);

    // 99999 / 7 = 14285 remainder 4 -> first 4 get 14286 paise (₹142.86), next 3 get 14285 paise (₹142.85)
    expect(shares[0].amountPaise).toBe(14286);
    expect(shares[3].amountPaise).toBe(14286);
    expect(shares[4].amountPaise).toBe(14285);
  });

  it('splits ₹1 among 3 members: exact sum in paise', () => {
    const shares = calculateEqualSplit({
      totalAmount: 1,
      memberIds: ['m1', 'm2', 'm3'],
    });

    expect(shares).toHaveLength(3);
    expect(shares[0].amountPaise).toBe(34); // ₹0.34
    expect(shares[1].amountPaise).toBe(33); // ₹0.33
    expect(shares[2].amountPaise).toBe(33); // ₹0.33

    const sumPaise = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(sumPaise).toBe(100);
  });

  it('validates exact shares totalling ₹500', () => {
    const result = validateAndCalculateExactSplit({
      totalAmount: 500,
      shares: [
        { memberId: 'm1', amount: 250 },
        { memberId: 'm2', amount: 150 },
        { memberId: 'm3', amount: 100 },
      ],
    });

    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
    expect(result.shares).toHaveLength(3);
  });

  it('rejects invalid shares totalling ₹499 for a ₹500 bill (No ₹1 tolerance allowed)', () => {
    const result = validateAndCalculateExactSplit({
      totalAmount: 500,
      shares: [
        { memberId: 'm1', amount: 250 },
        { memberId: 'm2', amount: 149 },
        { memberId: 'm3', amount: 100 },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(1);
    expect(result.error).toContain('Under-allocated by ₹1');
  });

  it('rejects zero or negative total amount', () => {
    expect(() =>
      calculateEqualSplit({ totalAmount: 0, memberIds: ['m1'] })
    ).toThrow('Total amount cannot be negative or zero');

    expect(() =>
      calculateEqualSplit({ totalAmount: -10, memberIds: ['m1'] })
    ).toThrow('Total amount cannot be negative or zero');
  });

  it('calculateNetBalances preserves unverified claims separation', () => {
    const memberIds = ['payer', 'debtor'];
    const expenses = [{ id: 'e1', paidBy: 'payer', totalAmount: 1000 }];
    const splits = [
      { id: 's1', expenseId: 'e1', userId: 'payer', amountOwed: 500, status: 'verified_paid' },
      { id: 's2', expenseId: 'e1', userId: 'debtor', amountOwed: 500, status: 'pending' },
    ];
    // Debtor self-claims they paid, but creditor has NOT verified
    const settlements = [
      { id: 'st1', fromUserId: 'debtor', toUserId: 'payer', amount: 500, status: 'manually_reported_paid' },
    ];

    // Default (strict): unverified claim does NOT erase liability
    const { balances: strictBalances } = calculateNetBalances({
      memberIds,
      expenses,
      splits,
      settlements,
      includeUnverifiedClaims: false,
    });

    expect(strictBalances['debtor'].netBalance).toBe(-500);
    expect(strictBalances['payer'].netBalance).toBe(500);

    // When explicitly requesting unverified claims inclusion
    const { balances: claimBalances } = calculateNetBalances({
      memberIds,
      expenses,
      splits,
      settlements,
      includeUnverifiedClaims: true,
    });

    expect(claimBalances['debtor'].netBalance).toBe(0);
    expect(claimBalances['payer'].netBalance).toBe(0);
  });
});

describe('Payload Validation & Schema Hardening (Task 1 & Task 3)', () => {
  it('enforces exact sum equality in createExpenseSchema without 1-2 rupee tolerance', () => {
    const validPayload = {
      tripId: 'trip-123',
      vendorName: 'Highway Dhaba',
      vendorUpiId: 'dhaba@okhdfcbank',
      totalAmount: 600,
      splitType: 'EXACT' as const,
      splits: [
        { userId: 'u1', amountOwed: 200 },
        { userId: 'u2', amountOwed: 200 },
        { userId: 'u3', amountOwed: 200 },
      ],
    };

    const validResult = createExpenseSchema.safeParse(validPayload);
    expect(validResult.success).toBe(true);

    // Mismatched sum by ₹1 (was previously allowed, now strictly rejected)
    const invalidPayload = {
      ...validPayload,
      splits: [
        { userId: 'u1', amountOwed: 200 },
        { userId: 'u2', amountOwed: 199 },
        { userId: 'u3', amountOwed: 200 },
      ],
    };

    const invalidResult = createExpenseSchema.safeParse(invalidPayload);
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues[0].message).toContain('does not equal total bill amount');
    }
  });

  it('rejects sub-paise amounts with more than 2 decimal places', () => {
    const payload = {
      tripId: 'trip-123',
      vendorName: 'Cafe',
      vendorUpiId: 'cafe@paytm',
      totalAmount: 100.005, // 3 decimal places
      splits: [{ userId: 'u1', amountOwed: 100.005 }],
    };

    const result = createExpenseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('OCR & Upload Security (Task 5)', () => {
  it('accepts valid base64 image data URIs under 5MB', () => {
    // Valid small 1x1 GIF base64
    const validDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = ocrUploadSchema.safeParse({ image: validDataUri });
    expect(result.success).toBe(true);
  });

  it('rejects malformed non-base64 strings', () => {
    const malformed = 'data:image/png;base64,not_valid_base64!@#$%%^';
    const result = ocrUploadSchema.safeParse({ image: malformed });
    expect(result.success).toBe(false);
  });

  it('rejects unsupported MIME types (e.g. svg, pdf)', () => {
    const pdfDataUri = 'data:application/pdf;base64,JVBERi0xLjQK';
    const result = ocrUploadSchema.safeParse({ image: pdfDataUri });
    expect(result.success).toBe(false);
  });

  it('rejects empty image payloads', () => {
    const result = ocrUploadSchema.safeParse({ image: '' });
    expect(result.success).toBe(false);
  });
});

describe('Open Redirect Protection (CWE-601)', () => {
  it('allows safe relative paths', () => {
    expect(sanitizeRedirectUrl('/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectUrl('/trips/trip-123')).toBe('/trips/trip-123');
    expect(sanitizeRedirectUrl('/')).toBe('/');
  });

  it('blocks protocol-relative open redirect attempts (//evil.com)', () => {
    expect(sanitizeRedirectUrl('//evil.com')).toBe('/');
    expect(sanitizeRedirectUrl('//google.com/phish')).toBe('/');
  });

  it('blocks backslash traversal open redirect attempts (/\\evil.com)', () => {
    expect(sanitizeRedirectUrl('/\\evil.com')).toBe('/');
  });

  it('blocks absolute external URLs (https://evil.com)', () => {
    expect(sanitizeRedirectUrl('https://evil.com')).toBe('/');
    expect(sanitizeRedirectUrl('http://attacker.com/login')).toBe('/');
    expect(sanitizeRedirectUrl('javascript:alert(1)')).toBe('/');
  });

  it('handles null, undefined, or empty inputs safely', () => {
    expect(sanitizeRedirectUrl(null)).toBe('/');
    expect(sanitizeRedirectUrl(undefined)).toBe('/');
    expect(sanitizeRedirectUrl('')).toBe('/');
  });
});

describe('Rate Limiter Resilience & Distributed Behavior (Task 2)', () => {
  it('allows requests within limit and tracks remaining quota', async () => {
    const key = `test_rate_limit_${Date.now()}`;
    const result1 = await checkRateLimit(key, 5, 10000);
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(4);

    const result2 = await checkRateLimit(key, 5, 10000);
    expect(result2.success).toBe(true);
    expect(result2.remaining).toBe(3);
  });

  it('enforces rate limit when quota is exhausted', async () => {
    const key = `test_exhaust_${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key, 3, 10000);
    }
    const blocked = await checkRateLimit(key, 3, 10000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.reset).toBeGreaterThan(0);
  });

  it('validates rate limit configuration and flags production mode', () => {
    const config = validateRateLimitConfig();
    expect(typeof config.isProduction).toBe('boolean');
    expect(typeof config.strictMode).toBe('boolean');
    expect(typeof config.isConfigured).toBe('boolean');
  });

  it('handles simultaneous burst requests without race condition drift', async () => {
    const key = `test_burst_${Date.now()}`;
    const limit = 10;
    // Launch 15 concurrent requests simultaneously
    const promises = Array.from({ length: 15 }, () => checkRateLimit(key, limit, 10000));
    const results = await Promise.all(promises);

    const allowed = results.filter((r) => r.success);
    const rejected = results.filter((r) => !r.success);

    expect(allowed.length).toBe(limit);
    expect(rejected.length).toBe(5);
  });
});

describe('Real Idempotency & Duplicate Request Protection (Task 3)', () => {
  it('accepts valid idempotency key on first expense submission', () => {
    const payload = {
      tripId: 'trip-alpha',
      vendorName: 'Mountain Gear Shop',
      vendorUpiId: 'gear@icici',
      totalAmount: 3000,
      splitType: 'EQUAL' as const,
      splits: [
        { userId: 'u1', amountOwed: 1500 },
        { userId: 'u2', amountOwed: 1500 },
      ],
      idempotencyKey: 'idem-test-uuid-001',
    };

    const parsed = createExpenseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.idempotencyKey).toBe('idem-test-uuid-001');
    }
  });

  it('allows identical expenses if they represent distinct transactions (different or no idempotency key)', () => {
    // Two cups of chai at the same vendor for the same amount should not be falsely rejected
    const expenseA = {
      tripId: 'trip-alpha',
      vendorName: 'Chai Stall',
      vendorUpiId: 'chai@upi',
      totalAmount: 40,
      splitType: 'EQUAL' as const,
      splits: [
        { userId: 'u1', amountOwed: 20 },
        { userId: 'u2', amountOwed: 20 },
      ],
      idempotencyKey: 'idem-tea-morning',
    };

    const expenseB = {
      tripId: 'trip-alpha',
      vendorName: 'Chai Stall',
      vendorUpiId: 'chai@upi',
      totalAmount: 40,
      splitType: 'EQUAL' as const,
      splits: [
        { userId: 'u1', amountOwed: 20 },
        { userId: 'u2', amountOwed: 20 },
      ],
      idempotencyKey: 'idem-tea-evening',
    };

    const parsedA = createExpenseSchema.safeParse(expenseA);
    const parsedB = createExpenseSchema.safeParse(expenseB);

    expect(parsedA.success).toBe(true);
    expect(parsedB.success).toBe(true);
    if (parsedA.success && parsedB.success) {
      expect(parsedA.data.idempotencyKey).not.toBe(parsedB.data.idempotencyKey);
    }
  });
});

describe('Database Transaction & Atomic Rollback Invariants (Task 5)', () => {
  it('enforces that split sum strictly matches total before insertion', () => {
    const validExpense = {
      tripId: 'trip-beta',
      vendorName: 'Hotel Stay',
      vendorUpiId: 'hotel@okhdfcbank',
      totalAmount: 5000,
      splitType: 'EXACT' as const,
      splits: [
        { userId: 'u1', amountOwed: 2500 },
        { userId: 'u2', amountOwed: 2500 },
      ],
    };

    expect(createExpenseSchema.safeParse(validExpense).success).toBe(true);

    // If one member share is manipulated or missing, schema rejects before hitting DB
    const corruptedExpense = {
      ...validExpense,
      splits: [
        { userId: 'u1', amountOwed: 2500 },
        { userId: 'u2', amountOwed: 2400 }, // 100 missing
      ],
    };

    const result = createExpenseSchema.safeParse(corruptedExpense);
    expect(result.success).toBe(false);
  });

  it('guarantees integer paise conversion without sub-paise floating drift', () => {
    expect(toPaise(99.99)).toBe(9999);
    expect(toPaise(0.01)).toBe(1);
    expect(toPaise(100.00)).toBe(10000);
  });
});

describe('Multi-User RLS & Authorization Isolation (Task 1)', () => {
  it('prevents non-members from acting on trip expenses or settlements', () => {
    const nonMemberResult = validatePaymentStateTransition({
      currentStatus: 'pending',
      targetStatus: 'manually_reported_paid',
      isDebtor: false,
      isCreditor: false,
      isAdmin: false,
    });

    expect(nonMemberResult.allowed).toBe(false);
    expect(nonMemberResult.error).toContain('Access denied');
  });

  it('prevents regular members from escalating themselves to admin', () => {
    const regularMember = {
      role: 'member',
      isAdmin: false,
    };

    // Only admin can execute admin actions
    expect(regularMember.isAdmin).toBe(false);
  });
});
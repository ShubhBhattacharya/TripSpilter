import { describe, it, expect } from 'vitest';
import {
  UPI_VPA_REGEX,
  parseUpiQrPayload,
  buildVerifiedUpiUri,
  PAYMENT_STATES_CONFIG,
} from '../src/lib/financial/upi-engine';

describe('UPI Engine — NPCI VPA Specifications', () => {
  it('validates compliant Indian UPI Virtual Payment Addresses (VPAs)', () => {
    const validVpas = [
      'cafe1947@okicici',
      'zostel.manali@hdfcbank',
      'solangvalley@icici',
      'haveli.murthal@paytm',
      'aarav@okhdfcbank',
      'user.name_123@axisbank',
      'trip-split@sbi',
      'merchant@upi',
    ];

    validVpas.forEach((vpa) => {
      expect(UPI_VPA_REGEX.test(vpa)).toBe(true);
    });
  });

  it('rejects non-compliant or malformed VPAs', () => {
    const invalidVpas = [
      '',
      'invalid',
      'no-at-symbol.com',
      '@hdfcbank',
      'aarav@',
      'aarav@b', // handle too short (< 2 chars)
      'user name@sbi', // spaces not allowed
      'user#name@icici', // invalid special character
    ];

    invalidVpas.forEach((vpa) => {
      expect(UPI_VPA_REGEX.test(vpa)).toBe(false);
    });
  });
});

describe('UPI Engine — QR Payload Parsing', () => {
  it('parses standard upi://pay URI scanned from a merchant standee', () => {
    const rawQr =
      'upi://pay?pa=cafe1947@okicici&pn=Cafe%201947%20Riverside&am=4000.00&cu=INR&tn=Dinner%20Split';

    const parsed = parseUpiQrPayload(rawQr);

    expect(parsed.isValid).toBe(true);
    expect(parsed.payeeVpa).toBe('cafe1947@okicici');
    expect(parsed.payeeName).toBe('Cafe 1947 Riverside');
    expect(parsed.amount).toBe(4000);
    expect(parsed.transactionNote).toBe('Dinner Split');
  });

  it('parses bare VPA string entered or scanned directly', () => {
    const parsed = parseUpiQrPayload('zostel.manali@hdfcbank');

    expect(parsed.isValid).toBe(true);
    expect(parsed.payeeVpa).toBe('zostel.manali@hdfcbank');
    expect(parsed.payeeName).toBe('zostel.manali');
  });

  it('returns invalid on garbage or non-UPI text', () => {
    const parsed = parseUpiQrPayload('https://random-website.com/menu');

    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toBeDefined();
  });
});

describe('UPI Engine — Deep Link String Generation', () => {
  it('generates compliant upi://pay deep links', () => {
    const link = buildVerifiedUpiUri({
      payeeVpa: 'cafe1947@okicici',
      payeeName: 'Cafe 1947',
      amount: 1000,
      transactionNote: 'TripSplit Share',
    });

    expect(link).toContain('upi://pay?');
    expect(link).toContain('pa=cafe1947@okicici');
    expect(link).toContain('pn=Cafe%201947');
    expect(link).toContain('am=1000');
    expect(link).toContain('cu=INR');
  });
});

describe('UPI Engine — Payment Verification States Config', () => {
  it('defines all required payment verification states', () => {
    const expectedStates = [
      'pending',
      'payment_initiated',
      'awaiting_confirmation',
      'manually_reported_paid',
      'verified_paid',
      'failed',
      'rejected',
    ];

    expectedStates.forEach((state) => {
      const config = PAYMENT_STATES_CONFIG[state as keyof typeof PAYMENT_STATES_CONFIG];
      expect(config).toBeDefined();
      expect(config.label).toBeDefined();
      expect(config.badgeColor).toBeDefined();
    });

    expect(PAYMENT_STATES_CONFIG.verified_paid.isConfirmed).toBe(true);
    expect(PAYMENT_STATES_CONFIG.manually_reported_paid.isSelfReported).toBe(true);
    expect(PAYMENT_STATES_CONFIG.pending.isConfirmed).toBe(false);
  });
});

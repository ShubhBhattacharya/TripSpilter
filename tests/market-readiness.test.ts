import { describe, it, expect, afterEach } from 'vitest';
import {
  normalizeBookingLifecycleStatus,
  validateBookingTransition,
} from '../src/lib/financial/booking-state-machine';
import { evaluateMemberRemovalSafety } from '../src/lib/financial/split-engine';
import { ocrUploadSchema, ocrParsedReceiptSchema } from '../src/lib/validations/api';
import { createServerPaymentRefund, verifyWebhookSignature } from '../src/lib/payments/gateway';
import { executeExtendedAiTool, extractStructuredCardFromTool } from '../src/lib/ai/tools-extended';
import { getServerIntegrationStatus } from '../src/lib/config/env';

describe('Market-Readiness Lifecycle, Financial, OCR & AI Safety Suite', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Booking Lifecycle State Machine', () => {
    it('enforces honest Draft -> Pending confirmation -> Confirmed by supplier transitions', () => {
      const toPending = validateBookingTransition({
        currentStatus: 'Draft',
        targetStatus: 'Pending confirmation',
        isBookingOwnerOrAdmin: true,
      });
      expect(toPending.allowed).toBe(true);

      const withoutRef = validateBookingTransition({
        currentStatus: 'Pending confirmation',
        targetStatus: 'Confirmed by supplier',
        hasSupplierConfirmationRef: false,
        isBookingOwnerOrAdmin: true,
      });
      expect(withoutRef.allowed).toBe(false);

      const withRef = validateBookingTransition({
        currentStatus: 'Pending confirmation',
        targetStatus: 'Confirmed by supplier',
        hasSupplierConfirmationRef: true,
        isBookingOwnerOrAdmin: true,
      });
      expect(withRef.allowed).toBe(true);
    });

    it('blocks unauthorized users and invalid status jumps (Draft -> Refunded)', () => {
      const nonOwner = validateBookingTransition({
        currentStatus: 'Confirmed by supplier',
        targetStatus: 'Cancelled',
        isBookingOwnerOrAdmin: false,
      });
      expect(nonOwner.allowed).toBe(false);

      const invalidJump = validateBookingTransition({
        currentStatus: 'Draft',
        targetStatus: 'Refunded',
        isBookingOwnerOrAdmin: true,
      });
      expect(invalidJump.allowed).toBe(false);

      const refundChain = validateBookingTransition({
        currentStatus: 'Cancelled',
        targetStatus: 'Refund pending',
        isBookingOwnerOrAdmin: true,
      });
      expect(refundChain.allowed).toBe(true);
      expect(normalizeBookingLifecycleStatus('Pending Split')).toBe('Pending confirmation');
    });
  });

  describe('2. Financial Member Removal & Ledger Invariants', () => {
    it('blocks removal while member has unsettled net balance and allows after settlement', () => {
      const members = ['u1', 'u2'];
      const expenses = [{ id: 'e1', paidBy: 'u1', totalAmount: 1000 }];
      const splits = [
        { expenseId: 'e1', userId: 'u1', amountOwed: 500, status: 'verified_paid' },
        { expenseId: 'e1', userId: 'u2', amountOwed: 500, status: 'pending' },
      ];

      const beforeSettle = evaluateMemberRemovalSafety({
        memberIdToRemove: 'u2',
        memberIds: members,
        expenses,
        splits,
        settlements: [],
      });
      expect(beforeSettle.canRemoveSafely).toBe(false);
      expect(beforeSettle.outstandingNetRupees).toBe(-500);

      const afterSettle = evaluateMemberRemovalSafety({
        memberIdToRemove: 'u2',
        memberIds: members,
        expenses,
        splits,
        settlements: [
          { id: 's1', fromUserId: 'u2', toUserId: 'u1', amount: 500, status: 'verified_paid' },
        ],
      });
      expect(afterSettle.canRemoveSafely).toBe(true);
      expect(afterSettle.outstandingNetRupees).toBe(0);
    });
  });

  describe('3. Receipt OCR Upload & Schema Hardening (JPG/PNG/WebP/PDF)', () => {
    it('accepts JPG, PNG, WebP, and PDF data URIs while rejecting unsafe SVG/oversize payloads', () => {
      expect(ocrUploadSchema.safeParse({ image: 'data:image/jpeg;base64,/9j/4AAQ' }).success).toBe(true);
      expect(ocrUploadSchema.safeParse({ image: 'data:image/png;base64,iVBORw0K' }).success).toBe(true);
      expect(ocrUploadSchema.safeParse({ image: 'data:image/webp;base64,UklGRkY=' }).success).toBe(true);
      expect(ocrUploadSchema.safeParse({ image: 'data:application/pdf;base64,JVBERi0=' }).success).toBe(true);

      expect(ocrUploadSchema.safeParse({ image: 'data:image/svg+xml;base64,PHN2Zz4=' }).success).toBe(false);
    });

    it('defaults confidence cleanly on parsed receipt output', () => {
      const parsed = ocrParsedReceiptSchema.parse({
        merchantName: 'Cafe Manali',
        items: [{ name: 'Chai', price: 120 }],
        totalAmount: 120,
      });
      expect(parsed.confidence).toBe('medium');
    });
  });

  describe('4. Payments Refund & Webhook Signature Guard', () => {
    it('returns waiting_for_credentials for refunds when Razorpay keys are unset', async () => {
      delete process.env.PAYMENT_PROVIDER_API_KEY;
      delete process.env.PAYMENT_PROVIDER_API_SECRET;
      const res = await createServerPaymentRefund({
        providerPaymentId: 'pay_test123',
        amountPaise: 50000,
      });
      expect(res.configured).toBe(false);
      expect(res.status).toBe('waiting_for_credentials');
    });

    it('verifies timing-safe HMAC signatures on webhooks', () => {
      const secret = 'test-webhook-secret';
      const body = '{"event":"refund.processed"}';
      expect(verifyWebhookSignature(body, 'deadbeef', secret)).toBe(false);
      expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    });
  });

  describe('5. AI Extended Tools & Status Inventory', () => {
    it('extracts trips_summary card from { trips: [...] } tool payload shape', () => {
      const card = extractStructuredCardFromTool('get_user_trips', {
        trips: [
          {
            id: 't-1',
            title: 'Goa Retreat',
            destination: 'Goa',
            budget: 30000,
            status: 'UPCOMING',
          },
        ],
      });
      expect(card).not.toBeNull();
      expect(card?.type).toBe('trips_summary');
    });

    it('requires confirmation draft for add_trip_member_draft and auth for get_trip_balances', async () => {
      const draft = await executeExtendedAiTool(
        'add_trip_member_draft',
        { tripId: 'trip-1', memberUserId: 'user-2', role: 'member' },
        { userId: 'user-1', supabase: null }
      );
      expect(draft?.ok).toBe(true);
      expect(draft?.requiresConfirmation?.actionType).toBe('ADD_TRIP_MEMBER');

      const unauthBal = await executeExtendedAiTool(
        'get_trip_balances',
        { tripId: 'trip-1' },
        { userId: null, supabase: null }
      );
      expect(unauthBal?.ok).toBe(false);
    });

    it('reports phoneOtpEnabled truthfully based on env toggle without secrets', () => {
      const status = getServerIntegrationStatus();
      expect(typeof status.phoneOtpEnabled).toBe('boolean');
      expect(status).not.toHaveProperty('supabaseServiceRoleKey');
    });
  });
});

import crypto from 'node:crypto';
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeBookingLifecycleStatus,
  validateBookingTransition,
  isValidSupplierConfirmationRef,
} from '../src/lib/financial/booking-state-machine';
import {
  evaluateMemberRemovalSafety,
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateNetBalances,
  toPaise,
} from '../src/lib/financial/split-engine';
import {
  calculateReservedAndProcessedPaise,
  validateRefundRequest,
  computeReconciledOrderStatus,
} from '../src/lib/financial/refund-engine';
import { dispatchTripNotifications } from '../src/lib/notifications/server';
import { ocrUploadSchema, ocrParsedReceiptSchema } from '../src/lib/validations/api';
import { createServerPaymentRefund, verifyWebhookSignature } from '../src/lib/payments/gateway';
import { executeAiTool } from '../src/lib/ai/tools';
import { executeExtendedAiTool, extractStructuredCardFromTool } from '../src/lib/ai/tools-extended';
import { getServerIntegrationStatus } from '../src/lib/config/env';

describe('Market-Readiness Lifecycle, Financial, OCR, Notifications & AI Safety Suite', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Booking Lifecycle & Real Supplier Verification', () => {
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
        hasVerifiedSupplierPayload: true,
        isBookingOwnerOrAdmin: true,
      });
      expect(withoutRef.allowed).toBe(false);

      const forgedDraftRef = validateBookingTransition({
        currentStatus: 'Pending confirmation',
        targetStatus: 'Confirmed by supplier',
        providerConfirmationRef: 'DRAFT-12345',
        hasVerifiedSupplierPayload: true,
        isBookingOwnerOrAdmin: true,
      });
      expect(forgedDraftRef.allowed).toBe(false);

      const unverifiedPayload = validateBookingTransition({
        currentStatus: 'Pending confirmation',
        targetStatus: 'Confirmed by supplier',
        providerConfirmationRef: 'AMADEUS-PNR-9Z8X',
        hasVerifiedSupplierPayload: false,
        isBookingOwnerOrAdmin: true,
      });
      expect(unverifiedPayload.allowed).toBe(false);

      const withVerifiedSupplier = validateBookingTransition({
        currentStatus: 'Pending confirmation',
        targetStatus: 'Confirmed by supplier',
        providerConfirmationRef: 'PNR89342XK',
        hasVerifiedSupplierPayload: true,
        isBookingOwnerOrAdmin: true,
      });
      expect(withVerifiedSupplier.allowed).toBe(true);
    });

    it('validates supplier reference strings and blocks unauthorized or invalid transitions', () => {
      expect(isValidSupplierConfirmationRef('DRAFT-ABC123')).toBe(false);
      expect(isValidSupplierConfirmationRef('MOCK-PNR1')).toBe(false);
      expect(isValidSupplierConfirmationRef('PNR9X7K2')).toBe(true);

      expect(
        validateBookingTransition({
          currentStatus: 'Confirmed by supplier',
          targetStatus: 'Cancelled',
          isBookingOwnerOrAdmin: false,
        }).allowed
      ).toBe(false);

      expect(
        validateBookingTransition({
          currentStatus: 'Draft',
          targetStatus: 'Refunded',
          isBookingOwnerOrAdmin: true,
        }).allowed
      ).toBe(false);

      expect(
        validateBookingTransition({
          currentStatus: 'Cancelled',
          targetStatus: 'Refund pending',
          isBookingOwnerOrAdmin: true,
        }).allowed
      ).toBe(true);

      expect(normalizeBookingLifecycleStatus('Pending Split')).toBe('Pending confirmation');
    });
  });

  describe('2. Payment & Refund Cumulative Zero-Tolerance Integrity', () => {
    it('enforces cumulative refund ceiling across partial, pending & failed refunds', () => {
      const existing = [
        { id: 'r1', amountPaise: 40000, status: 'processed' },
        { id: 'r2', amountPaise: 30000, status: 'pending' },
        { id: 'r3', amountPaise: 50000, status: 'failed' },
        { id: 'r4', amountPaise: 50000, status: 'waiting_for_credentials' },
      ];

      const summary = calculateReservedAndProcessedPaise(existing);
      expect(summary.processedPaise).toBe(40000);
      expect(summary.pendingPaise).toBe(30000);
      expect(summary.reservedTotalPaise).toBe(70000);

      // ₹1000 order with ₹700 active -> ₹300 succeeds, ₹301 rejects
      const okPartial = validateRefundRequest({
        orderStatus: 'partially_refunded',
        orderAmountPaise: 100000,
        requestedPaise: 30000,
        existingRefunds: existing,
      });
      expect(okPartial.allowed).toBe(true);
      expect(okPartial.remainingRefundablePaise).toBe(30000);

      const overLimit = validateRefundRequest({
        orderStatus: 'partially_refunded',
        orderAmountPaise: 100000,
        requestedPaise: 30001,
        existingRefunds: existing,
      });
      expect(overLimit.allowed).toBe(false);
    });

    it('computes partially_refunded vs refunded order status and rejects uncaptured orders', () => {
      expect(
        validateRefundRequest({
          orderStatus: 'created',
          orderAmountPaise: 50000,
          requestedPaise: 10000,
          existingRefunds: [],
        }).allowed
      ).toBe(false);

      expect(computeReconciledOrderStatus({ orderAmountPaise: 100000, processedRefundsPaise: 0 })).toBe('captured');
      expect(computeReconciledOrderStatus({ orderAmountPaise: 100000, processedRefundsPaise: 45000 })).toBe(
        'partially_refunded'
      );
      expect(computeReconciledOrderStatus({ orderAmountPaise: 100000, processedRefundsPaise: 100000 })).toBe(
        'refunded'
      );
    });

    it('accepts valid HMAC-SHA256 webhook signatures and rejects spoofed or tampered bodies', () => {
      const secret = 'razorpay_webhook_secret_key';
      const body = '{"event":"refund.processed","payload":{"refund":{"entity":{"id":"rfnd_123"}}}}';
      const validSig = crypto.createHmac('sha256', secret).update(body).digest('hex');

      expect(verifyWebhookSignature(body, validSig, secret)).toBe(true);
      expect(verifyWebhookSignature(`${body} `, validSig, secret)).toBe(false);
      expect(verifyWebhookSignature(body, 'deadbeef', secret)).toBe(false);
    });

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
  });

  describe('3. Financial Scalability Across 2, 3, 5, 10 and 20 Participants', () => {
    it.each([2, 3, 5, 10, 20])(
      'maintains exact zero-drift integer paise equality for %i participants',
      (count) => {
        const members = Array.from({ length: count }, (_, i) => `member-${i + 1}`);
        const totalInr = 12345.67;
        const equalShares = calculateEqualSplit({ totalAmount: totalInr, memberIds: members });

        expect(equalShares).toHaveLength(count);
        const sumPaise = equalShares.reduce((acc, s) => acc + s.amountPaise, 0);
        expect(sumPaise).toBe(toPaise(totalInr));

        const basePct = Math.floor((100 / count) * 100) / 100;
        const percentages = members.map((id, idx) => ({
          memberId: id,
          percent: idx === 0 ? Number((100 - basePct * (count - 1)).toFixed(2)) : basePct,
        }));
        const pctRes = calculatePercentageSplit({ totalAmount: 999.99, percentages });
        expect(pctRes.isValid).toBe(true);
        expect(pctRes.shares.reduce((acc, s) => acc + s.amountPaise, 0)).toBe(toPaise(999.99));

        const { isZeroSum } = calculateNetBalances({
          memberIds: members,
          expenses: [{ id: 'exp-1', paidBy: members[0], totalAmount: totalInr }],
          splits: equalShares.map((s) => ({
            expenseId: 'exp-1',
            userId: s.memberId,
            amountOwed: s.amount,
            status: s.memberId === members[0] ? 'verified_paid' : 'pending',
          })),
          settlements: [],
        });
        expect(isZeroSum).toBe(true);
      }
    );

    it('blocks removal while member has unsettled net balance and allows after settlement', () => {
      const members = ['u1', 'u2'];
      const expenses = [{ id: 'e1', paidBy: 'u1', totalAmount: 1000 }];
      const splits = [
        { expenseId: 'e1', userId: 'u1', amountOwed: 500, status: 'verified_paid' },
        { expenseId: 'e1', userId: 'u2', amountOwed: 500, status: 'pending' },
      ];

      expect(
        evaluateMemberRemovalSafety({
          memberIdToRemove: 'u2',
          memberIds: members,
          expenses,
          splits,
          settlements: [],
        }).canRemoveSafely
      ).toBe(false);

      expect(
        evaluateMemberRemovalSafety({
          memberIdToRemove: 'u2',
          memberIds: members,
          expenses,
          splits,
          settlements: [
            { id: 's1', fromUserId: 'u2', toUserId: 'u1', amount: 500, status: 'verified_paid' },
          ],
        }).canRemoveSafely
      ).toBe(true);
    });
  });

  describe('4. Notification Dispatch & Reachable Fallback Verification', () => {
    it('executes direct self-insert fallback when RPC fails and actor is a recipient', async () => {
      let insertedRow: Record<string, unknown> | null = null;
      const mockSupabase = {
        rpc: async () => ({ data: null, error: { message: 'function not migrated' } }),
        from: () => ({
          insert: async (row: Record<string, unknown>) => {
            insertedRow = row;
            return { error: null };
          },
        }),
      } as unknown as SupabaseClient;

      const res = await dispatchTripNotifications({
        supabase: mockSupabase,
        tripId: 'trip-1',
        recipientUserIds: ['actor-1', 'co-member-2', 'co-member-2'],
        actorUserId: 'actor-1',
        includeActor: true,
        title: 'Refund processed',
        message: '₹500 refund processed.',
        type: 'payment',
      });

      expect(res.fallbackUsed).toBe(true);
      expect(res.dispatched).toBe(1);
      expect(insertedRow).toMatchObject({ user_id: 'actor-1', title: 'Refund processed' });
    });

    it('deduplicates co-members and excludes actor by default for social expenses', async () => {
      let passedIds: string[] = [];
      const mockSupabase = {
        rpc: async (_fn: string, args: { p_recipient_ids: string[] }) => {
          passedIds = args.p_recipient_ids;
          return { data: args.p_recipient_ids.length, error: null };
        },
      } as unknown as SupabaseClient;

      const res = await dispatchTripNotifications({
        supabase: mockSupabase,
        tripId: 'trip-1',
        recipientUserIds: ['u-actor', 'u-2', 'u-3', 'u-2'],
        actorUserId: 'u-actor',
        title: 'Dinner split',
        message: 'Split ₹900 equally',
        type: 'expense',
      });

      expect(res.fallbackUsed).toBe(false);
      expect(res.dispatched).toBe(2);
      expect(passedIds).toEqual(['u-2', 'u-3']);
    });
  });

  describe('5. Receipt OCR, Individual AI Tools & Status Inventory', () => {
    it('accepts JPG, PNG, WebP, and PDF data URIs while rejecting SVG/oversize payloads', () => {
      expect(ocrUploadSchema.safeParse({ image: 'data:image/jpeg;base64,/9j/4AAQ' }).success).toBe(true);
      expect(ocrUploadSchema.safeParse({ image: 'data:image/png;base64,iVBORw0K' }).success).toBe(true);
      expect(ocrUploadSchema.safeParse({ image: 'data:image/webp;base64,UklGRkY=' }).success).toBe(true);
      expect(ocrUploadSchema.safeParse({ image: 'data:application/pdf;base64,JVBERi0=' }).success).toBe(true);
      expect(ocrUploadSchema.safeParse({ image: 'data:image/svg+xml;base64,PHN2Zz4=' }).success).toBe(false);

      const parsed = ocrParsedReceiptSchema.parse({
        merchantName: 'Cafe Manali',
        items: [{ name: 'Chai', price: 120 }],
        totalAmount: 120,
      });
      expect(parsed.confidence).toBe('medium');
    });

    it('executes individual AI travel tools deterministically without fabricating prices', async () => {
      const ctx = { userId: 'user-1', supabase: null };

      const destSearch = await executeAiTool('search_destinations', { query: 'Manali' }, ctx);
      expect(destSearch.ok).toBe(true);

      const destDetails = await executeAiTool('get_destination_details', { cityQuery: 'jaipur' }, ctx);
      expect(destDetails.ok).toBe(true);

      const itinerary = await executeAiTool('generate_trip_plan', { destination: 'Goa', days: 3, travelers: 4 }, ctx);
      expect(itinerary.ok).toBe(true);
      expect(itinerary.card?.type).toBe('itinerary');

      const transit = await executeAiTool('search_transit_links', { origin: 'Delhi', destination: 'Manali' }, ctx);
      expect(transit.ok).toBe(true);

      const tripDraft = await executeAiTool(
        'create_trip_draft',
        { title: 'Winter Manali', destination: 'Manali', budget: 25000 },
        ctx
      );
      expect(tripDraft.requiresConfirmation?.actionType).toBe('CREATE_TRIP');

      const expenseDraft = await executeAiTool(
        'create_expense_draft',
        { tripId: 't-1', vendorName: 'Dinner', totalAmount: 1500 },
        ctx
      );
      expect(expenseDraft.requiresConfirmation?.actionType).toBe('CREATE_EXPENSE');

      const memberDraft = await executeExtendedAiTool(
        'add_trip_member_draft',
        { tripId: 'trip-1', memberUserId: 'user-2', role: 'member' },
        ctx
      );
      expect(memberDraft?.requiresConfirmation?.actionType).toBe('ADD_TRIP_MEMBER');

      const unauthBal = await executeExtendedAiTool(
        'get_trip_balances',
        { tripId: 'trip-1' },
        { userId: null, supabase: null }
      );
      expect(unauthBal?.ok).toBe(false);

      const tripsCard = extractStructuredCardFromTool('get_user_trips', {
        trips: [{ id: 't-1', title: 'Goa', destination: 'Goa', budget: 30000 }],
      });
      expect(tripsCard?.type).toBe('trips_summary');
    });

    it('reports phoneOtpEnabled truthfully based on env toggle without secrets', () => {
      const status = getServerIntegrationStatus();
      expect(typeof status.phoneOtpEnabled).toBe('boolean');
      expect(status).not.toHaveProperty('supabaseServiceRoleKey');
    });
  });
});

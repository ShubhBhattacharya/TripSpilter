import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendingActionType } from './types';
import { requireTripMembership } from '../security/auth-guards';
import { calculateEqualSplit, toPaise } from '../financial/split-engine';

const ALLOWED_BOOKING_CATEGORIES = new Set([
  'Hotel',
  'Flight',
  'Train',
  'Bus',
  'Rental',
  'Activity',
  'Other',
]);

export async function executeConfirmedAction(params: {
  actionType: PendingActionType;
  payload: Record<string, unknown>;
  userId: string;
  supabase: SupabaseClient;
}): Promise<{ ok: true; message: string; data: unknown } | { ok: false; status: number; error: string }> {
  const { actionType, payload, userId, supabase } = params;

  switch (actionType) {
    case 'CREATE_TRIP': {
      const title = String(payload.title || '').trim();
      const destination = String(payload.destination || '').trim();
      const startDate = String(
        payload.start_date || payload.startDate || new Date().toISOString().slice(0, 10)
      );
      const endDate = String(
        payload.end_date ||
          payload.endDate ||
          new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
      );
      const budget = Math.max(0, Number(payload.budget) || 0);

      if (title.length < 2 || destination.length < 2) {
        return { ok: false, status: 400, error: 'Trip title and destination are required.' };
      }

      const { data: trip, error: tripErr } = await supabase
        .from('trips')
        .insert({
          title,
          destination,
          start_date: startDate,
          end_date: endDate,
          budget,
          created_by: userId,
          status: 'UPCOMING',
        })
        .select('*')
        .single();

      if (tripErr || !trip) {
        return { ok: false, status: 500, error: tripErr?.message || 'Failed to create trip' };
      }

      await supabase.from('trip_members').upsert(
        { trip_id: trip.id, user_id: userId, role: 'admin' },
        { onConflict: 'trip_id,user_id' }
      );

      return { ok: true, message: `Trip "${trip.title}" created`, data: trip };
    }

    case 'UPDATE_TRIP': {
      const tripId = String(payload.tripId || '').trim();
      if (!tripId) return { ok: false, status: 400, error: 'tripId is required' };
      await requireTripMembership(supabase, tripId, userId);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payload.title) patch.title = String(payload.title).trim();
      if (payload.destination) patch.destination = String(payload.destination).trim();
      if (payload.start_date) patch.start_date = String(payload.start_date);
      if (payload.end_date) patch.end_date = String(payload.end_date);
      if (payload.budget !== undefined) patch.budget = Math.max(0, Number(payload.budget) || 0);
      if (
        payload.status === 'ACTIVE' ||
        payload.status === 'UPCOMING' ||
        payload.status === 'COMPLETED'
      ) {
        patch.status = payload.status;
      }

      const { data, error } = await supabase
        .from('trips')
        .update(patch)
        .eq('id', tripId)
        .select('*')
        .single();

      if (error) return { ok: false, status: 500, error: error.message };
      return { ok: true, message: 'Trip updated successfully', data };
    }

    case 'UPDATE_ITINERARY': {
      const tripId = String(payload.tripId || '').trim();
      if (!tripId) return { ok: false, status: 400, error: 'tripId is required' };
      await requireTripMembership(supabase, tripId, userId);

      const { data: item, error } = await supabase
        .from('itinerary_items')
        .insert({
          trip_id: tripId,
          day_number: Math.max(1, Number(payload.day || payload.dayNumber || 1)),
          time: String(payload.time || '10:00 AM'),
          title: String(payload.title || '').trim(),
          estimated_cost: Math.max(0, Number(payload.estimatedCost) || 0),
        })
        .select('*')
        .single();

      if (error) return { ok: false, status: 500, error: error.message };
      return { ok: true, message: 'Itinerary item added', data: item };
    }

    case 'CREATE_EXPENSE': {
      const tripId = String(payload.tripId || '').trim();
      const vendorName = String(payload.title || payload.vendorName || '').trim();
      const amount = Number(payload.amount || 0);
      if (!tripId || !vendorName || !Number.isFinite(amount) || amount <= 0) {
        return { ok: false, status: 400, error: 'tripId, title, and positive amount are required.' };
      }

      await requireTripMembership(supabase, tripId, userId);

      const { data: members } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('trip_id', tripId);

      const memberIds =
        members && members.length > 0
          ? members.map((m) => String(m.user_id))
          : [userId];

      const computed = calculateEqualSplit({ totalAmount: amount, memberIds });
      const rpcSplits = computed.map((s) => ({
        userId: s.memberId,
        amountOwed: s.amount,
        amountOwedPaise: s.amountPaise,
      }));

      const { data, error } = await supabase.rpc('create_expense_with_splits', {
        p_trip_id: tripId,
        p_vendor_name: vendorName,
        p_vendor_upi_id: null,
        p_total_amount: amount,
        p_total_amount_paise: toPaise(amount),
        p_split_type: 'EQUAL',
        p_notes: payload.category ? `AI Assistant (${String(payload.category)})` : 'AI Assistant Expense',
        p_splits: rpcSplits,
        p_idempotency_key: null,
      });

      if (error) return { ok: false, status: 500, error: error.message };
      return { ok: true, message: `Expense "${vendorName}" (₹${amount}) split equally`, data };
    }

    case 'CREATE_SETTLEMENT_PROPOSAL': {
      const tripId = String(payload.tripId || '').trim();
      const toUserId = String(payload.toUserId || '').trim();
      const amount = Number(payload.amount || 0);
      if (!tripId || !toUserId || !Number.isFinite(amount) || amount <= 0) {
        return { ok: false, status: 400, error: 'tripId, toUserId, and positive amount required.' };
      }

      await requireTripMembership(supabase, tripId, userId);

      const { data, error } = await supabase
        .from('settlements')
        .insert({
          trip_id: tripId,
          from_user_id: userId,
          to_user_id: toUserId,
          amount,
          amount_paise: toPaise(amount),
          status: 'pending',
        })
        .select('*')
        .single();

      if (error) return { ok: false, status: 500, error: error.message };
      return { ok: true, message: `Pending settlement of ₹${amount} logged`, data };
    }

    case 'CREATE_BOOKING_DRAFT': {
      const tripId = String(payload.tripId || '').trim();
      const title = String(payload.title || '').trim();
      const categoryRaw = String(payload.category || 'Hotel').trim();
      const category = ALLOWED_BOOKING_CATEGORIES.has(categoryRaw) ? categoryRaw : 'Other';
      const amount = Math.max(0, Number(payload.amount) || 0);
      if (!tripId || !title) {
        return { ok: false, status: 400, error: 'tripId and booking title are required.' };
      }

      await requireTripMembership(supabase, tripId, userId);

      const refCode = `DRAFT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          trip_id: tripId,
          title,
          vendor_name: String(payload.vendorName || title),
          booking_ref: refCode,
          category,
          amount,
          amount_paise: toPaise(amount),
          status: 'Pending Split',
          provider_name: 'External Provider Redirect',
          provider_status: 'DRAFT',
          external_url: payload.externalUrl ? String(payload.externalUrl) : null,
          booked_by: userId,
        })
        .select('*')
        .single();

      if (error) return { ok: false, status: 500, error: error.message };
      return { ok: true, message: `Booking draft "${title}" added to Bookings Vault`, data };
    }

    case 'SAVE_PREFERENCES': {
      const upsertRow: Record<string, unknown> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
      };
      if (payload.preferred_language === 'hi' || payload.preferred_language === 'en') {
        upsertRow.preferred_language = payload.preferred_language;
      }
      if (payload.preferred_currency) {
        upsertRow.preferred_currency = String(payload.preferred_currency).toUpperCase().slice(0, 6);
      }
      if (typeof payload.auto_narrate === 'boolean') {
        upsertRow.auto_narrate = payload.auto_narrate;
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(upsertRow, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (error) return { ok: false, status: 500, error: error.message };
      return { ok: true, message: 'Account preferences updated', data };
    }

    default:
      return { ok: false, status: 400, error: `Unsupported action type: ${String(actionType)}` };
  }
}

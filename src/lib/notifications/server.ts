import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationCategory =
  | 'expense'
  | 'settlement'
  | 'booking'
  | 'payment'
  | 'invite'
  | 'ai_action'
  | 'system';

/**
 * Persists notifications non-blockingly for trip members (using safe SECURITY DEFINER RPC
 * or fallback direct insert for the current user when migration RPC is not yet applied).
 */
export async function dispatchTripNotifications(params: {
  supabase: SupabaseClient;
  tripId: string | null;
  recipientUserIds: string[];
  title: string;
  message: string;
  type: NotificationCategory;
  link?: string;
  actorUserId?: string;
  includeActor?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<{ dispatched: number; fallbackUsed: boolean }> {
  const uniqueRecipients = Array.from(
    new Set(
      params.recipientUserIds.filter(
        (id) => Boolean(id) && (params.includeActor === true || id !== params.actorUserId)
      )
    )
  );
  if (uniqueRecipients.length === 0) {
    return { dispatched: 0, fallbackUsed: false };
  }

  const link = params.link || (params.tripId ? `/trips/${params.tripId}` : '/notifications');

  try {
    const { data, error } = await params.supabase.rpc('dispatch_trip_notification', {
      p_trip_id: params.tripId,
      p_recipient_ids: uniqueRecipients,
      p_title: params.title.slice(0, 140),
      p_message: params.message.slice(0, 500),
      p_type: params.type,
      p_link: link,
      p_metadata: params.metadata || {},
    });

    if (!error) {
      return { dispatched: typeof data === 'number' ? data : uniqueRecipients.length, fallbackUsed: false };
    }

    // Reachable fallback when RPC migration isn't applied yet: insert self-scoped row under RLS (user_id = auth.uid())
    if (params.actorUserId && params.recipientUserIds.includes(params.actorUserId)) {
      const { error: fallbackErr } = await params.supabase.from('notifications').insert({
        user_id: params.actorUserId,
        title: params.title.slice(0, 140),
        message: params.message.slice(0, 500),
        link,
        read: false,
      });
      return { dispatched: fallbackErr ? 0 : 1, fallbackUsed: true };
    }

    return { dispatched: 0, fallbackUsed: true };
  } catch {
    // Notifications should never abort verified financial mutations
    return { dispatched: 0, fallbackUsed: false };
  }
}

/**
 * Records an immutable audit entry in public.activity_logs non-blockingly.
 */
export async function recordTripActivity(params: {
  supabase: SupabaseClient;
  tripId: string;
  userId: string;
  actionType: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await params.supabase.from('activity_logs').insert({
      trip_id: params.tripId,
      user_id: params.userId,
      action_type: params.actionType,
      description: params.description.slice(0, 400),
      metadata: params.metadata || {},
    });
  } catch {
    // Keep mutations reliable even if optional audit schema lags
  }
}

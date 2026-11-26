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
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const uniqueRecipients = Array.from(
    new Set(params.recipientUserIds.filter((id) => Boolean(id) && id !== params.actorUserId))
  );
  if (uniqueRecipients.length === 0) return;

  try {
    const { error } = await params.supabase.rpc('dispatch_trip_notification', {
      p_trip_id: params.tripId,
      p_recipient_ids: uniqueRecipients,
      p_title: params.title.slice(0, 140),
      p_message: params.message.slice(0, 500),
      p_type: params.type,
      p_link: params.link || (params.tripId ? `/trips/${params.tripId}` : '/notifications'),
      p_metadata: params.metadata || {},
    });

    if (error && params.actorUserId && uniqueRecipients.includes(params.actorUserId)) {
      await params.supabase.from('notifications').insert({
        user_id: params.actorUserId,
        title: params.title.slice(0, 140),
        message: params.message.slice(0, 500),
        link: params.link || '/notifications',
        read: false,
      });
    }
  } catch {
    // Notifications should never abort verified financial mutations
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

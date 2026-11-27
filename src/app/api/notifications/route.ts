import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/client';
import { requireAuthenticatedUser, UnauthorizedError } from '../../../lib/security/auth-guards';

const markReadSchema = z.object({
  id: z.string().uuid().optional(),
  markAll: z.boolean().optional(),
});

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ notifications: [], configured: false });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = data || [];
    const unreadCount = rows.filter((r) => !r.read).length;
    return NextResponse.json({ notifications: rows, unreadCount, configured: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ updated: 0, configured: false });
  }

  try {
    const body = await request.json();
    const parsed = markReadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    let query = supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
    if (parsed.data.id && !parsed.data.markAll) {
      query = query.eq('id', parsed.data.id);
    }
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Unable to update notifications' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ deleted: 0, configured: false });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const clearRead = url.searchParams.get('clearRead') === 'true';

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    let query = supabase.from('notifications').delete().eq('user_id', user.id);
    if (id) {
      if (!z.string().uuid().safeParse(id).success) {
        return NextResponse.json({ error: 'Invalid notification id UUID' }, { status: 400 });
      }
      query = query.eq('id', id);
    } else if (clearRead) {
      query = query.eq('read', true);
    } else {
      return NextResponse.json({ error: 'Provide ?id=<uuid> or ?clearRead=true' }, { status: 400 });
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Unable to delete notifications' }, { status: 500 });
  }
}

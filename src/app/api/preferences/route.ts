import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/client';
import { requireAuthenticatedUser, UnauthorizedError } from '../../../lib/security/auth-guards';

const prefSchema = z.object({
  preferred_language: z.enum(['hi', 'en']).optional(),
  preferred_currency: z.string().min(3).max(5).optional(),
  auto_narrate: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
});

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ configured: false, preferences: null });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ configured: true, preferences: data });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Unable to load preferences' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Preferences persistence requires Supabase configuration' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const parsed = prefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid preferences' }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: user.id,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ preferences: data });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

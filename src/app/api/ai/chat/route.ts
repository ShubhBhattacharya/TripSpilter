import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { invokeCentralAICompanion } from '../../../../lib/ai/provider';
import { requireAuthenticatedUser, UnauthorizedError } from '../../../../lib/security/auth-guards';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../../lib/rate-limit';

const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  language: z.enum(['hi', 'en']).optional().default('en'),
  preferredProvider: z.enum(['openai', 'gemini', 'auto']).optional().default('auto'),
  currentPath: z.string().max(120).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(3000),
      })
    )
    .min(1)
    .max(30),
});

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ conversations: [], configured: false });
  }

  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);

    const convId = new URL(request.url).searchParams.get('conversationId');
    if (convId) {
      const { data: messages, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', convId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ messages: messages || [] });
    }

    const { data: conversations, error } = await supabase
      .from('ai_conversations')
      .select('id, title, trip_id, provider, model, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ conversations: conversations || [] });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Unable to load AI history' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid chat request' },
        { status: 400 }
      );
    }

    let userId: string | null = null;
    let supabaseClient = null;
    if (isSupabaseConfigured) {
      supabaseClient = await createClient();
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      userId = user?.id || null;
    }

    const rateLimit = await checkRateLimit(
      getClientIdentifier('ai_chat', request, userId),
      userId ? 25 : 8,
      60000
    );
    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Retry in ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    const aiResponse = await invokeCentralAICompanion(
      {
        messages: parsed.data.messages,
        language: parsed.data.language,
        preferredProvider: parsed.data.preferredProvider,
        tripId: parsed.data.tripId,
        currentPath: parsed.data.currentPath,
        allowPaidLlm: Boolean(userId || !isSupabaseConfigured),
      },
      { userId, supabase: supabaseClient }
    );

    let savedConversationId = parsed.data.conversationId || null;
    if (userId && supabaseClient) {
      const latestUserMessage = parsed.data.messages[parsed.data.messages.length - 1];
      if (!savedConversationId) {
        const { data: conv } = await supabaseClient
          .from('ai_conversations')
          .insert({
            user_id: userId,
            trip_id: parsed.data.tripId || null,
            title: latestUserMessage.content.slice(0, 60),
            provider: aiResponse.provider,
            model: aiResponse.model,
          })
          .select('id')
          .single();
        savedConversationId = conv?.id || null;
      }

      if (savedConversationId) {
        await supabaseClient.from('ai_messages').insert([
          {
            conversation_id: savedConversationId,
            user_id: userId,
            role: 'user',
            content: latestUserMessage.content,
          },
          {
            conversation_id: savedConversationId,
            user_id: userId,
            role: 'assistant',
            content: aiResponse.reply,
            tool_calls: aiResponse.toolExecutions,
            pending_action: aiResponse.pendingConfirmations[0] || null,
          },
        ]);
      }
    }

    return NextResponse.json(
      {
        conversationId: savedConversationId,
        ...aiResponse,
      },
      { headers }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'AI chat service error' }, { status: 500 });
  }
}

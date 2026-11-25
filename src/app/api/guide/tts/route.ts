import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import {
  checkRateLimit,
  getClientIdentifier,
  applyRateLimitHeaders,
} from '../../../../lib/rate-limit';

export const runtime = 'nodejs';

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(2500),
  language: z.enum(['hi', 'en']).default('hi'),
});

/**
 * Server-side TTS provider route.
 * Protected against anonymous paid TTS quota abuse:
 * - Enforces sliding-window rate limits per user / IP.
 * - Requires authenticated Supabase session before billing OpenAI `tts-1` when auth is enabled.
 * - Returns `{ configured: false }` cleanly when unconfigured or guest so browser SpeechSynthesis handles playback.
 */
export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    if (isSupabaseConfigured) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    const rateLimit = await checkRateLimit(
      getClientIdentifier('guide_tts', req, userId),
      userId ? 20 : 10,
      60000
    );
    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `TTS rate limit exceeded. Wait ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    const body = await req.json();
    const parsed = ttsRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid TTS payload' },
        { status: 400, headers }
      );
    }

    // Never allow anonymous unauthenticated requests to drain paid OpenAI TTS credits
    if (isSupabaseConfigured && !userId) {
      return NextResponse.json(
        {
          configured: false,
          provider: 'browser-speech-synthesis',
          requiresAuthForServerTts: true,
        },
        { headers }
      );
    }

    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    if (!openAiKey) {
      return NextResponse.json(
        {
          configured: false,
          provider: 'browser-speech-synthesis',
        },
        { headers }
      );
    }

    const { text, language } = parsed.data;
    const voice = language === 'hi' ? 'nova' : 'alloy';

    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'mp3',
        speed: language === 'hi' ? 0.96 : 1.0,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!ttsResponse.ok) {
      return NextResponse.json(
        {
          configured: false,
          provider: 'browser-speech-synthesis',
          fallbackReason: 'Upstream TTS unavailable',
        },
        { headers }
      );
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('Cache-Control', 'no-store');
    headers.set('X-TTS-Provider', 'openai-tts-1');

    return new NextResponse(audioBuffer, {
      status: 200,
      headers,
    });
  } catch {
    return NextResponse.json({
      configured: false,
      provider: 'browser-speech-synthesis',
    });
  }
}

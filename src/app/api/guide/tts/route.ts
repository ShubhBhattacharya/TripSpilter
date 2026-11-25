import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(2500),
  language: z.enum(['hi', 'en']).default('hi'),
});

/**
 * Server-side TTS provider route.
 * Uses OpenAI TTS (`tts-1`) when `OPENAI_API_KEY` is configured on the server.
 * When no server TTS credential is set, returns `{ configured: false }` cleanly
 * so the client falls back seamlessly to Web SpeechSynthesis without HTTP errors.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ttsRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid TTS payload' },
        { status: 400 }
      );
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      return NextResponse.json({
        configured: false,
        provider: 'browser-speech-synthesis',
      });
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
      return NextResponse.json({
        configured: false,
        provider: 'browser-speech-synthesis',
        fallbackReason: 'Upstream TTS unavailable',
      });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-TTS-Provider': 'openai-tts-1',
      },
    });
  } catch {
    return NextResponse.json({
      configured: false,
      provider: 'browser-speech-synthesis',
    });
  }
}

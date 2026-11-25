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

const explainSchema = z.object({
  cityId: z.string().min(1).max(80),
  cityName: z.string().min(1).max(120),
  state: z.string().min(1).max(80),
  region: z.string().max(40).optional(),
  tagline: z.string().max(240).optional(),
  cityDescription: z.string().max(600).optional(),
  spotName: z.string().min(1).max(120),
  spotSubtitle: z.string().max(200).optional(),
  spotDescription: z.string().max(600).optional(),
  spotCategory: z.string().max(60).optional(),
  bestTime: z.string().max(80).optional(),
  duration: z.string().max(80).optional(),
  cost: z.number().min(0).max(1000000).optional(),
  wikiTitle: z.string().max(150).optional(),
  nearbySpots: z.array(z.string().max(120)).max(10).optional(),
  language: z.enum(['hi', 'en']).default('hi'),
  question: z.string().max(400).optional(),
});

type ExplainInput = z.infer<typeof explainSchema>;

async function fetchWikipediaSummary(wikiTitle?: string, language: 'hi' | 'en' = 'en'): Promise<string | null> {
  if (!wikiTitle) return null;
  const hosts = language === 'hi' ? ['hi.wikipedia.org', 'en.wikipedia.org'] : ['en.wikipedia.org'];
  for (const host of hosts) {
    try {
      const url = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TripSplitTravelGuide/1.0' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const extract = typeof data?.extract === 'string' ? data.extract.trim() : '';
      if (!extract) continue;
      return extract.split(/(?<=[।.!?])\s+/).slice(0, 2).join(' ');
    } catch {
      continue;
    }
  }
  return null;
}

async function generateWithLLM(
  input: ExplainInput,
  wikiFact: string | null
): Promise<string | null> {
  const {
    cityName,
    state,
    spotName,
    spotSubtitle,
    spotCategory,
    bestTime,
    duration,
    cost,
    nearbySpots,
    language,
    question,
  } = input;

  const systemInstruction =
    language === 'hi'
      ? 'You are an expert, friendly Indian travel guide speaking aloud to travelers. Respond ONLY in clear, natural spoken Devanagari Hindi (हिंदी लिपि में), conversational and warm, around 3 to 5 sentences (60-95 words). Never use markdown, bullet points, or asterisks because your output goes directly to Text-to-Speech. Never invent historical dates or unverified facts.'
      : 'You are an expert, friendly Indian travel guide speaking aloud to travelers. Respond ONLY in clear, natural spoken English, warm and informative, around 3 to 5 sentences (60-95 words). Never use markdown, bullet points, or asterisks because your output goes directly to Text-to-Speech. Never invent historical dates or unverified facts.';

  const contextBlock = [
    `Destination: ${cityName} (${state})`,
    `Spot: ${spotName} (${spotSubtitle || spotCategory || 'Landmark'})`,
    bestTime ? `Best visiting time: ${bestTime}` : '',
    duration ? `Recommended visit duration: ${duration}` : '',
    typeof cost === 'number' ? `Approx entry/pass fee: ${cost > 0 ? `₹${cost}` : 'Free'}` : '',
    nearbySpots?.length ? `Nearby attractions: ${nearbySpots.join(', ')}` : '',
    wikiFact ? `Verified background fact: ${wikiFact}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = question
    ? `Traveler question: "${question}"\n\nAnswer this question directly in ${
        language === 'hi' ? 'Devanagari Hindi' : 'English'
      } based on the verified location details below:\n${contextBlock}`
    : `Give an engaging spoken tour introduction for travelers arriving at ${spotName} in ${cityName}. Cover its cultural significance, what makes it famous, best time to visit, and nearby spots from this verified context:\n${contextBlock}`;

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 240,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch {
      // Fall through safely
    }
  }

  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY)?.trim();
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 240 },
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      }
    } catch {
      // Fall through cleanly
    }
  }

  return null;
}

function hasDevanagari(text: string | null): boolean {
  return Boolean(text && /[\u0900-\u097F]/.test(text));
}

function buildVerifiedFallbackExplanation(
  input: ExplainInput,
  wikiFact: string | null
): string {
  const shortCity = input.cityName.split(',')[0].trim();
  const nearby = (input.nearbySpots || []).filter((n) => n !== input.spotName).slice(0, 2);
  const hindiWikiFact = hasDevanagari(wikiFact) ? wikiFact : null;
  const feeTextHi =
    typeof input.cost === 'number' && input.cost > 0
      ? `यहाँ प्रवेश या गतिविधि शुल्क लगभग ${input.cost} रुपये है।`
      : 'यहाँ प्रवेश निशुल्क है।';
  const feeTextEn =
    typeof input.cost === 'number' && input.cost > 0
      ? `Entry or pass cost here is around ₹${input.cost}.`
      : 'Entry here is free.';

  if (input.question) {
    const q = input.question.toLowerCase();
    const isHistory = /itihaas|history|historical|kab|built|purana|when|story|mahatva|special|khas|इतिहास|खास|कब/.test(q);
    const isTime = /time|season|kab jana|best time|mausam|weather|ghanta|duration|समय|मौसम/.test(q);
    const isCost = /price|cost|ticket|fee|paisa|rupaye|kharcha|budget|खर्च|शुल्क/.test(q);
    const isNearby = /near|paas|aaspas|around|next|other|आसपास|पास/.test(q);

    if (input.language === 'hi') {
      if (isTime) {
        return `${input.spotName} घूमने का सबसे अच्छा समय ${input.bestTime || 'सुबह या शाम'} माना जाता है। यहाँ आराम से घूमने के लिए लगभग ${input.duration || 'दो घंटे'} का समय रखें। ${input.tagline ? `${shortCity} अपनी खूबसूरती के लिए प्रसिद्ध है।` : ''}`;
      }
      if (isCost) {
        return `${input.spotName}, ${shortCity} के लिए ${feeTextHi} आप चाहें तो इसे सीधे अपनी ट्रिप इटिनरेरी में जोड़कर सभी दोस्तों के बीच बराबर बाँट सकते हैं।`;
      }
      if (isNearby && nearby.length > 0) {
        return `${input.spotName} के आसपास आप ${nearby.join(' और ')} भी आसानी से घूम सकते हैं। ये सभी स्थान ${shortCity} की मुख्य दर्शनीय जगहों में शामिल हैं।`;
      }
      if (isHistory) {
        return `${input.spotName}, ${shortCity} (${input.state}) का एक प्रमुख और सांस्कृतिक रूप से महत्वपूर्ण स्थल है। ${hindiWikiFact ? `${hindiWikiFact} ` : ''}${input.spotSubtitle ? `इसे ${input.spotSubtitle} के रूप में भी जाना जाता है। ` : ''}${nearby.length > 0 ? `पास ही ${nearby.join(' और ')} भी देखने लायक हैं।` : ''}`;
      }
      return `${input.spotName}, ${shortCity} में स्थित एक बेहद प्रसिद्ध दर्शनीय स्थल है। यहाँ घूमने का बढ़िया समय ${input.bestTime || 'सुबह'} है, और ${feeTextHi}`;
    } else {
      if (isTime) {
        return `The best time to visit ${input.spotName} in ${shortCity} is ${input.bestTime || 'morning or late afternoon'}. Plan to spend around ${input.duration || 'two hours'} here to enjoy the atmosphere comfortably.`;
      }
      if (isCost) {
        return `For ${input.spotName} in ${shortCity}, ${feeTextEn} You can add it directly to your TripSplit itinerary to divide expenses evenly with your group.`;
      }
      if (isNearby && nearby.length > 0) {
        return `Near ${input.spotName}, you can also explore ${nearby.join(' and ')}. These spots sit comfortably within ${shortCity}'s main sightseeing route.`;
      }
      return `${input.spotName} is one of ${shortCity}'s signature landmarks in ${input.state}${input.spotSubtitle ? `, celebrated as ${input.spotSubtitle}` : ''}. ${wikiFact ? `${wikiFact} ` : ''}The ideal time to visit is ${input.bestTime || 'during the day'}, and ${feeTextEn.toLowerCase()}`;
    }
  }

  if (input.language === 'hi') {
    const parts = [
      `नमस्ते! ${shortCity}, ${input.state} के ${input.spotName} में आपका स्वागत है।`,
      hindiWikiFact
        ? `${hindiWikiFact}`
        : `यह स्थान ${shortCity} की समृद्ध संस्कृति, स्थानीय परंपराओं और सुंदर प्राकृतिक दृश्य के लिए बेहद प्रसिद्ध है।`,
      `यहाँ घूमने का सबसे अच्छा समय ${input.bestTime || 'सुबह'} है, और सामान्यतः ${input.duration || 'दो घंटे'} का समय पर्याप्त रहता है।`,
      nearby.length > 0
        ? `${feeTextHi} इसके बाद आप पास ही ${nearby.join(' और ')} भी देख सकते हैं।`
        : feeTextHi,
    ];
    return parts.filter(Boolean).join(' ');
  }

  const enParts = [
    `Welcome to ${input.spotName} in ${shortCity}, ${input.state}!`,
    input.spotSubtitle
      ? `This iconic ${input.spotCategory?.toLowerCase() || 'landmark'} is renowned for ${input.spotSubtitle}.`
      : `This landmark showcases the rich heritage and local culture of ${shortCity}.`,
    wikiFact ? `${wikiFact}` : '',
    `The best time to visit is ${input.bestTime || 'morning'}, and you should set aside about ${input.duration || 'two hours'} to take it all in.`,
    nearby.length > 0
      ? `${feeTextEn} Nearby, be sure to explore ${nearby.join(' and ')} as well.`
      : feeTextEn,
  ];
  return enParts.filter(Boolean).join(' ');
}

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

    // Strict rate limiting against anonymous or burst abuse
    const rateLimit = await checkRateLimit(
      getClientIdentifier('guide_explain', req, userId),
      userId ? 30 : 12,
      60000
    );
    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    const body = await req.json();
    const parsed = explainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid guide explanation request' },
        { status: 400, headers }
      );
    }

    const input = parsed.data;
    const wikiFact = await fetchWikipediaSummary(input.wikiTitle || input.spotName, input.language);

    // Protect paid OpenAI/Gemini API credits from unauthenticated scraping when auth is enabled
    const allowPaidLlm = !isSupabaseConfigured || Boolean(userId);
    const llmText = allowPaidLlm ? await generateWithLLM(input, wikiFact) : null;

    if (llmText) {
      return NextResponse.json(
        {
          explanation: llmText,
          language: input.language,
          source: process.env.OPENAI_API_KEY ? 'openai' : 'gemini',
          groundedWithWikipedia: Boolean(wikiFact),
        },
        { headers }
      );
    }

    const fallbackText = buildVerifiedFallbackExplanation(input, wikiFact);
    return NextResponse.json(
      {
        explanation: fallbackText,
        language: input.language,
        source: wikiFact ? 'wikipedia-grounded' : 'verified-metadata',
        groundedWithWikipedia: Boolean(wikiFact),
        ...(isSupabaseConfigured && !userId ? { paidAiGatedForGuests: true } : {}),
      },
      { headers }
    );
  } catch {
    return NextResponse.json(
      { error: 'Unable to generate tour guide explanation right now.' },
      { status: 500 }
    );
  }
}

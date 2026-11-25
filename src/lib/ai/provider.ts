import { AI_TOOL_DECLARATIONS, executeAiTool, PendingConfirmationAction, ToolExecutionContext } from './tools';

export type AIProviderName = 'openai' | 'gemini' | 'unconfigured';

export interface ChatTurnMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AICompanionRequest {
  messages: ChatTurnMessage[];
  language?: 'hi' | 'en';
  preferredProvider?: 'openai' | 'gemini' | 'auto';
  tripId?: string;
}

export interface AICompanionResponse {
  reply: string;
  provider: AIProviderName;
  model: string;
  fallbackUsed: boolean;
  toolExecutions: Array<{ tool: string; ok: boolean }>;
  pendingConfirmations: PendingConfirmationAction[];
  missingCredentials?: string[];
}

const SYSTEM_PROMPT = `You are TripSplit AI, an intelligent, honest Indian and international travel companion supporting both English and Hindi (Devanagari).
Rules you MUST always follow:
1. NEVER fabricate live hotel rates, flight fares, booking confirmations, or payment success. If a travel tool returns waiting_for_credentials, clearly say "Live data currently unavailable — waiting for provider API credentials" instead of making up prices.
2. Financial calculations must come from deterministic backend tools, never guesses.
3. For sensitive mutations (creating trips, modifying expenses, updating itineraries), always prepare a draft tool call (create_trip_draft, create_expense_draft, update_itinerary_draft) and explicitly ask the user to confirm. Never claim an action is saved until the user confirms.
4. Detect user's language (Hindi/Hinglish/English) or follow the requested language parameter cleanly.`;

function getConfiguredProviders(preferred: 'openai' | 'gemini' | 'auto'): Array<'openai' | 'gemini'> {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasGemini = Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY)?.trim());

  const envPref = (process.env.AI_PROVIDER || preferred || 'auto').toLowerCase();
  const order: Array<'openai' | 'gemini'> = [];

  if (envPref === 'gemini') {
    if (hasGemini) order.push('gemini');
    if (hasOpenAI) order.push('openai');
  } else {
    if (hasOpenAI) order.push('openai');
    if (hasGemini) order.push('gemini');
  }
  return order;
}

async function runOpenAICompanion(
  req: AICompanionRequest,
  ctx: ToolExecutionContext
): Promise<AICompanionResponse> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.AI_MODEL?.startsWith('gpt') ? process.env.AI_MODEL : 'gpt-4o-mini';

  const tools = AI_TOOL_DECLARATIONS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const history: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}\nPreferred response language: ${
        req.language === 'hi' ? 'Hindi (Devanagari or easy conversational Hindi matching user)' : 'English'
      }.${req.tripId ? `\nActive Trip Context ID: ${req.tripId}` : ''}`,
    },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const toolExecutions: Array<{ tool: string; ok: boolean }> = [];
  const pendingConfirmations: PendingConfirmationAction[] = [];

  // Allow up to 3 tool-call rounds
  for (let round = 0; round < 3; round++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: history,
        tools,
        tool_choice: 'auto',
      }),
      signal: AbortSignal.timeout(18000),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API HTTP ${res.status}`);
    }

    const json = await res.json();
    const message = json.choices?.[0]?.message;
    if (!message) throw new Error('Empty response from OpenAI');

    const calls = message.tool_calls;
    if (!calls || calls.length === 0) {
      return {
        reply: message.content || 'Done.',
        provider: 'openai',
        model,
        fallbackUsed: false,
        toolExecutions,
        pendingConfirmations,
      };
    }

    history.push(message);
    for (const call of calls) {
      const fnName = call.function?.name;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }

      const result = await executeAiTool(fnName, parsedArgs, ctx);
      toolExecutions.push({ tool: fnName, ok: result.ok });
      if (result.requiresConfirmation) {
        pendingConfirmations.push(result.requiresConfirmation);
      }

      history.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: 'I gathered your travel details. Please let me know if you want to refine anything or confirm any draft above.',
    provider: 'openai',
    model,
    fallbackUsed: false,
    toolExecutions,
    pendingConfirmations,
  };
}

async function runGeminiCompanion(
  req: AICompanionRequest,
  ctx: ToolExecutionContext
): Promise<AICompanionResponse> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY)!;
  const model = process.env.AI_MODEL?.startsWith('gemini') ? process.env.AI_MODEL : 'gemini-2.0-flash';

  const contents: Array<Record<string, unknown>> = req.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const functionDeclarations = AI_TOOL_DECLARATIONS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const toolExecutions: Array<{ tool: string; ok: boolean }> = [];
  const pendingConfirmations: PendingConfirmationAction[] = [];

  for (let round = 0; round < 3; round++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `${SYSTEM_PROMPT}\nPreferred language: ${
                  req.language === 'hi' ? 'Hindi' : 'English'
                }.${req.tripId ? ` Active Trip ID: ${req.tripId}` : ''}`,
              },
            ],
          },
          contents,
          tools: [{ functionDeclarations }],
          generationConfig: { temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(18000),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API HTTP ${res.status}`);
    }

    const json = await res.json();
    const parts = json.candidates?.[0]?.content?.parts || [];
    const fnCallPart = parts.find((p: { functionCall?: unknown }) => Boolean(p.functionCall));

    if (!fnCallPart) {
      const text = parts
        .filter((p: { text?: string }) => typeof p.text === 'string')
        .map((p: { text: string }) => p.text)
        .join('\n')
        .trim();
      return {
        reply: text || 'Done.',
        provider: 'gemini',
        model,
        fallbackUsed: false,
        toolExecutions,
        pendingConfirmations,
      };
    }

    const call = fnCallPart.functionCall as { name: string; args?: Record<string, unknown> };
    contents.push({ role: 'model', parts });

    const result = await executeAiTool(call.name, call.args || {}, ctx);
    toolExecutions.push({ tool: call.name, ok: result.ok });
    if (result.requiresConfirmation) {
      pendingConfirmations.push(result.requiresConfirmation);
    }

    contents.push({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: call.name,
            response: result,
          },
        },
      ],
    });
  }

  return {
    reply: 'Completed tool checks for your travel query.',
    provider: 'gemini',
    model,
    fallbackUsed: false,
    toolExecutions,
    pendingConfirmations,
  };
}

/**
 * Central AI Travel Companion entrypoint with automatic provider selection,
 * fallback across OpenAI and Gemini, tool calling, and honest credential reporting.
 */
export async function invokeCentralAICompanion(
  req: AICompanionRequest,
  ctx: ToolExecutionContext
): Promise<AICompanionResponse> {
  const preferred = req.preferredProvider || 'auto';
  const providers = getConfiguredProviders(preferred);

  if (providers.length === 0) {
    // Still execute read-only weather/currency/destination lookup if user asks a clear query, while disclosing missing AI keys
    return {
      reply:
        req.language === 'hi'
          ? 'AI ट्रैवल असिस्टेंट (OpenAI / Gemini) अभी कॉन्फ़िगर नहीं है। सर्वर पर OPENAI_API_KEY या GEMINI_API_KEY जोड़ने के बाद मैं पूरी बातचीत, स्मार्ट ट्रिप प्लानिंग और लाइव टूल्स चला सकूँगा।'
          : 'The AI Travel Companion is waiting for AI API credentials (`OPENAI_API_KEY` or `GEMINI_API_KEY` on the server). Configure either key to activate full conversational trip planning and multi-tool orchestration.',
      provider: 'unconfigured',
      model: 'none',
      fallbackUsed: false,
      toolExecutions: [],
      pendingConfirmations: [],
      missingCredentials: ['OPENAI_API_KEY', 'GEMINI_API_KEY'],
    };
  }

  let lastError: string | null = null;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    try {
      const response =
        p === 'openai'
          ? await runOpenAICompanion(req, ctx)
          : await runGeminiCompanion(req, ctx);
      response.fallbackUsed = i > 0;
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Provider call failed';
    }
  }

  return {
    reply:
      req.language === 'hi'
        ? 'अभी AI सेवा अस्थायी रूप से उपलब्ध नहीं है। कृपया थोड़ी देर बाद पुनः प्रयास करें।'
        : `AI service temporarily unavailable (${lastError || 'upstream error'}). Please try again shortly.`,
    provider: 'unconfigured',
    model: 'error-fallback',
    fallbackUsed: true,
    toolExecutions: [],
    pendingConfirmations: [],
  };
}

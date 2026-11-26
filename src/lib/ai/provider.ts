import { AI_TOOL_DECLARATIONS, executeAiTool, PendingConfirmationAction, ToolExecutionContext } from './tools';
import type {
  AIProviderName,
  AICompanionRequest,
  AICompanionResponse,
  ChatTurnMessage,
  StructuredCard,
} from './types';
import { runUnconfiguredFallbackOrchestrator } from './fallback-orchestrator';

export type {
  AIProviderName,
  AICompanionRequest,
  AICompanionResponse,
  ChatTurnMessage,
  StructuredCard,
};

const SYSTEM_PROMPT = `You are TripSplit AI, an intelligent, honest Indian and international travel companion supporting both English and Hindi (Devanagari).
Rules you MUST always follow:
1. NEVER fabricate live hotel rates, flight fares, booking confirmations, or payment success. If a travel tool returns waiting_for_credentials, clearly say "Live data currently unavailable — waiting for provider API credentials" instead of making up prices.
2. Financial calculations must come from deterministic backend tools, never guesses.
3. For sensitive mutations (creating trips, modifying expenses, updating itineraries), always prepare a draft tool call (create_trip_draft, create_expense_draft, update_itinerary_draft) and explicitly ask the user to confirm. Never claim an action is saved until the user confirms.
4. Detect user's language (Hindi/Hinglish/English) or follow the requested language parameter cleanly.`;

async function fetchWithAiRetry(
  url: string,
  init: RequestInit,
  maxRetries = 1
): Promise<Response> {
  let attempt = 0;
  let lastResponse: Response | null = null;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(18000),
      });
      if (res.ok || (res.status !== 429 && res.status < 500)) {
        return res;
      }
      lastResponse = res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    attempt++;
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  return lastResponse!;
}

async function logAiUsageTelemetry(params: {
  ctx: ToolExecutionContext;
  provider: AIProviderName;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  status: 'success' | 'fallback' | 'timeout' | 'error';
}): Promise<void> {
  if (!params.ctx.userId || !params.ctx.supabase) return;
  // Rough indicative blended cost rate per 1K tokens in INR for budget observability
  const costInr = Number(
    (((params.promptTokens * 0.00015 + params.completionTokens * 0.0006) / 1000) * 85).toFixed(4)
  );
  try {
    await params.ctx.supabase.from('ai_usage_logs').insert({
      user_id: params.ctx.userId,
      provider: params.provider,
      model: params.model,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      estimated_cost_inr: costInr,
      latency_ms: Math.max(0, Math.round(params.latencyMs)),
      status: params.status,
    });
  } catch {
    // Telemetry should never disrupt user responses
  }
}

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
      }.${req.tripId ? `\nActive Trip Context ID: ${req.tripId}` : ''}${
        req.currentPath ? `\nUser is currently viewing page: ${req.currentPath}` : ''
      }`,
    },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const toolExecutions: Array<{ tool: string; ok: boolean }> = [];
  const pendingConfirmations: PendingConfirmationAction[] = [];
  const structuredCards: StructuredCard[] = [];

  // Allow up to 3 tool-call rounds with bounded retry & latency tracking
  const startedAt = Date.now();
  let promptTokens = 0;
  let completionTokens = 0;

  for (let round = 0; round < 3; round++) {
    const res = await fetchWithAiRetry('https://api.openai.com/v1/chat/completions', {
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
    });

    if (!res.ok) {
      throw new Error(`OpenAI API HTTP ${res.status}`);
    }

    const json = await res.json();
    promptTokens += Number(json.usage?.prompt_tokens || 0);
    completionTokens += Number(json.usage?.completion_tokens || 0);
    const message = json.choices?.[0]?.message;
    if (!message) throw new Error('Empty response from OpenAI');

    const calls = message.tool_calls;
    if (!calls || calls.length === 0) {
      void logAiUsageTelemetry({
        ctx,
        provider: 'openai',
        model,
        promptTokens,
        completionTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });
      return {
        reply: message.content || 'Done.',
        provider: 'openai',
        model,
        fallbackUsed: false,
        toolExecutions,
        pendingConfirmations,
        structuredCards,
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
      if (result.card) {
        structuredCards.push(result.card);
      }
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
    structuredCards,
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
  const structuredCards: StructuredCard[] = [];

  const startedAt = Date.now();
  let promptTokens = 0;
  let completionTokens = 0;

  for (let round = 0; round < 3; round++) {
    const res = await fetchWithAiRetry(
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
                }.${req.tripId ? ` Active Trip ID: ${req.tripId}` : ''}${
                  req.currentPath ? ` Page: ${req.currentPath}` : ''
                }`,
              },
            ],
          },
          contents,
          tools: [{ functionDeclarations }],
          generationConfig: { temperature: 0.3 },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API HTTP ${res.status}`);
    }

    const json = await res.json();
    promptTokens += Number(json.usageMetadata?.promptTokenCount || 0);
    completionTokens += Number(json.usageMetadata?.candidatesTokenCount || 0);
    const parts = json.candidates?.[0]?.content?.parts || [];
    const fnCallPart = parts.find((p: { functionCall?: unknown }) => Boolean(p.functionCall));

    if (!fnCallPart) {
      void logAiUsageTelemetry({
        ctx,
        provider: 'gemini',
        model,
        promptTokens,
        completionTokens,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });
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
        structuredCards,
      };
    }

    const call = fnCallPart.functionCall as { name: string; args?: Record<string, unknown> };
    contents.push({ role: 'model', parts });

    const result = await executeAiTool(call.name, call.args || {}, ctx);
    toolExecutions.push({ tool: call.name, ok: result.ok });
    if (result.card) {
      structuredCards.push(result.card);
    }
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
    structuredCards,
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

  if (providers.length === 0 || req.allowPaidLlm === false) {
    return runUnconfiguredFallbackOrchestrator(req, ctx, executeAiTool);
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
    structuredCards: [],
  };
}

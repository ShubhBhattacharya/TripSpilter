import type {
  AICompanionRequest,
  AICompanionResponse,
  PendingConfirmationAction,
  StructuredCard,
} from './types';
import type { ExtendedToolContext, ExtendedToolResult } from './tools-extended';
import { findBestDestination } from './travel-planner';

export type AiToolRunner = (
  toolName: string,
  args: Record<string, unknown>,
  ctx: ExtendedToolContext
) => Promise<ExtendedToolResult>;

function extractNumberMatch(text: string, regex: RegExp): number | undefined {
  const m = text.match(regex);
  if (!m?.[1]) return undefined;
  const parsed = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function extractRouteCities(text: string): { origin: string; destination: string } | null {
  const match = text.match(/\bfrom\s+([a-z\s]{2,24}?)\s+to\s+([a-z\s]{2,24}?)(?:\s|$|\?|\.|,)/i);
  if (match) {
    return { origin: match[1].trim(), destination: match[2].trim() };
  }
  const arrowMatch = text.match(/([a-z\s]{2,20}?)\s*(?:->|to|se)\s*([a-z\s]{2,20}?)(?:\s|$|\?|\.|,)/i);
  if (arrowMatch) {
    const o = findBestDestination(arrowMatch[1]);
    const d = findBestDestination(arrowMatch[2]);
    if (o && d) return { origin: o.name, destination: d.name };
  }
  return null;
}

export async function runUnconfiguredFallbackOrchestrator(
  req: AICompanionRequest,
  ctx: ExtendedToolContext,
  runTool: AiToolRunner
): Promise<AICompanionResponse> {
  const latestUserText =
    [...req.messages].reverse().find((m) => m.role === 'user')?.content?.trim() || '';
  const lower = latestUserText.toLowerCase();
  const isHindi = req.language === 'hi' || /[\u0900-\u097F]/.test(latestUserText) || /\b(kaisa|banao|kharcha|mausam|kitna|batao|yatra|safar|kaise)\b/i.test(lower);

  const toolExecutions: Array<{ tool: string; ok: boolean }> = [];
  const pendingConfirmations: PendingConfirmationAction[] = [];
  const structuredCards: StructuredCard[] = [];
  const notes: string[] = [];

  const matchedDest = findBestDestination(latestUserText);
  const targetCity = matchedDest?.name || 'Manali, Himachal Pradesh';
  const targetCityShort = matchedDest ? matchedDest.name.split(',')[0].trim() : 'Manali';
  const days = Math.min(7, Math.max(1, extractNumberMatch(lower, /(\d+)\s*[-\s]*(?:day|days|din)/i) || 3));
  const travelers = Math.min(20, Math.max(1, extractNumberMatch(lower, /(\d+)\s*(?:people|persons|travelers|travellers|guests|friends|log|pax)/i) || 2));

  const exec = async (name: string, args: Record<string, unknown>) => {
    const res = await runTool(name, args, ctx);
    toolExecutions.push({ tool: name, ok: res.ok });
    if (res.card) structuredCards.push(res.card);
    if (res.requiresConfirmation) pendingConfirmations.push(res.requiresConfirmation);
    return res;
  };

  // 1. Currency conversion intent
  const fxMatch = lower.match(/\b(\d+(?:\.\d+)?)?\s*(usd|eur|gbp|aed|sgd|jpy|inr|aud|cad)\s+(?:to|in)\s+(inr|usd|eur|gbp|aed|sgd|jpy|aud|cad)\b/i);
  if (fxMatch || /\b(currency|exchange rate|fx|dollar to rupee)\b/i.test(lower)) {
    const amount = fxMatch?.[1] ? Number(fxMatch[1]) : extractNumberMatch(lower, /([\d,.]+)\s*(?:usd|eur|inr)/i) || 100;
    const from = (fxMatch?.[2] || 'USD').toUpperCase();
    const to = (fxMatch?.[3] || 'INR').toUpperCase();
    const res = await exec('convert_currency', { amount, from, to });
    const env = res.data as { data?: { convertedAmount?: number; rate?: number }; source?: string } | undefined;
    if (env?.data?.convertedAmount) {
      notes.push(
        isHindi
          ? `Indicative FX rate (${env.source}): ${amount} ${from} ≈ ${env.data.convertedAmount} ${to} (1 ${from} = ${env.data.rate} ${to}).`
          : `Indicative FX rate (${env.source}): ${amount} ${from} ≈ ${env.data.convertedAmount} ${to} (rate ${env.data.rate}).`
      );
    }
  }

  // 2. Weather intent
  if (/\b(weather|mausam|temp|temperature|rain|barish|climate|forecast|cold|snow)\b/i.test(lower)) {
    const res = await exec('get_weather', { city: targetCityShort });
    const env = res.data as { data?: { temperatureC?: number; windKmh?: number; city?: string } } | undefined;
    if (env?.data) {
      notes.push(
        isHindi
          ? `${env.data.city || targetCityShort} ka current weather: ${env.data.temperatureC}°C, wind ${env.data.windKmh} km/h (Open-Meteo public feed).`
          : `Current indicative weather for ${env.data.city || targetCityShort}: ${env.data.temperatureC}°C with ${env.data.windKmh} km/h wind.`
      );
    }
  }

  // 3. Route / distance intent
  const routeCities = extractRouteCities(latestUserText);
  if (routeCities || /\b(route|distance|km|how far|kitni door|drive time)\b/i.test(lower)) {
    const origin = routeCities?.origin || 'Delhi';
    const destination = routeCities?.destination || targetCityShort;
    const res = await exec('calculate_route', { origin, destination });
    const env = res.data as { data?: { distanceKm?: number; durationMinutes?: number; origin?: string; destination?: string } } | undefined;
    if (env?.data) {
      notes.push(
        `Estimated road route ${env.data.origin} → ${env.data.destination}: ~${env.data.distanceKm} km (~${Math.round((env.data.durationMinutes || 0) / 60 * 10) / 10} hrs).`
      );
    }
  }

  // 4. Hotels & Flights & Transit links
  if (/\b(hotel|hotels|stay|stays|resort|hostel|room|accommodation)\b/i.test(lower)) {
    const today = new Date().toISOString().slice(0, 10);
    await exec('search_hotels', {
      city: targetCityShort,
      checkIn: today,
      checkOut: today,
      guests: travelers,
    });
    notes.push(
      `Hotel rates require a configured hotel supplier API key (HOTEL_PROVIDER_API_KEY) — no prices have been fabricated.`
    );
  }

  if (/\b(flight|flights|airline|fly|airport|airfare)\b/i.test(lower)) {
    const today = new Date().toISOString().slice(0, 10);
    await exec('search_flights', {
      origin: 'DEL',
      destination: targetCityShort,
      departureDate: today,
      passengers: travelers,
    });
    notes.push(
      `Flight inventory requires live Amadeus credentials (FLIGHT_PROVIDER_API_KEY/SECRET) — zero fabricated fares shown.`
    );
  }

  if (/\b(train|trains|irctc|rail|bus|buses|volvo|cab|taxi|metro|transit|kaise jaye|how to reach|how to go)\b/i.test(lower)) {
    await exec('search_transit_links', {
      origin: routeCities?.origin || 'New Delhi',
      destination: routeCities?.destination || targetCityShort,
    });
    notes.push(`Provided verified external transit links for ${targetCityShort} ("Continue to provider to book").`);
  }

  // 5. Safety & Emergency Helplines
  if (/\b(safety|safe|emergency|helpline|police|hospital|packing|tips)\b/i.test(lower)) {
    await exec('get_travel_safety', {
      destination: matchedDest ? targetCityShort : undefined,
      language: isHindi ? 'hi' : 'en',
    });
    notes.push(`Included verified Indian emergency & tourist helpline directory (112, 1363, 139, 1091).`);
  }

  // 6. Bookings Vault / User Trips
  if (/\b(my booking|bookings|vault)\b/i.test(lower)) {
    const res = await exec('get_user_bookings', { tripId: req.tripId });
    if (!res.ok) {
      notes.push(res.error || 'Sign in to inspect your private Bookings Vault.');
    } else {
      notes.push('Loaded saved items from your Bookings Vault.');
    }
  }

  if (/\b(my trip|my trips|balance|balances|settlement|settlements|who owes)\b/i.test(lower)) {
    const res = await exec('get_user_trips', {});
    if (!res.ok) {
      notes.push(res.error || 'Sign in to view your saved trips, group expenses, and settlement balances.');
    } else {
      notes.push('Loaded your TripSplit trips and budgets.');
    }
  }

  // 7. Explicit Create Trip Draft / Expense Draft / Save Preferences
  if (/\b(create|save|make|new|start|banao)\b.*\b(trip|plan|journey|yatra)\b/i.test(lower)) {
    const parsedBudget =
      extractNumberMatch(lower, /(?:rs\.?|₹|inr|budget(?:\s+of)?)\s*([\d,]+)/i) ||
      (matchedDest ? matchedDest.startingPrice * days * travelers : 15000);
    const today = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const draftRes = await exec('create_trip_draft', {
      title: `${targetCityShort} ${days}-Day Trip`,
      destination: targetCity,
      start_date: today,
      end_date: endDate,
      budget: parsedBudget,
    });
    if (draftRes.ok) {
      notes.push(`Prepared a trip draft card — review and click "Approve & Execute" to save it to your account.`);
    } else {
      notes.push(draftRes.error || 'Sign in to save this trip directly to your TripSplit database.');
    }
  }

  if (/\b(add|log|create|split)\b.*\b(expense|bill|kharcha|payment)\b/i.test(lower)) {
    const amount = extractNumberMatch(lower, /(?:rs\.?|₹|inr|of)\s*([\d,]+)/i) || 0;
    if (req.tripId && amount > 0) {
      const expRes = await exec('create_expense_draft', {
        tripId: req.tripId,
        title: `Travel Expense (${targetCityShort})`,
        amount,
        category: 'Food & Dining',
      });
      if (expRes.ok) {
        notes.push(`Prepared an expense confirmation card for ₹${amount.toLocaleString('en-IN')}.`);
      } else {
        notes.push(expRes.error || 'Sign in to save group expenses.');
      }
    } else {
      notes.push(
        isHindi
          ? 'Expense split karne ke liye active Trip select karein aur amount batayein (e.g. "Add expense ₹1200 Dinner"), ya /qr-split page use karein.'
          : 'Open a specific trip (or pass a tripId) and include an amount to create an expense draft, or use Quick QR Split (`/qr-split`).'
      );
    }
  }

  // 8. Itinerary / Destination Planning (or default helpful discovery card)
  const wantsItinerary = /\b(plan|itinerary|days|day|schedule|visit|things to do|guide|spots|explore|suggest)\b/i.test(lower) || Boolean(matchedDest && notes.length === 0);
  if (wantsItinerary) {
    const planRes = await exec('generate_trip_plan', {
      destination: targetCityShort,
      days,
      travelers,
      language: isHindi ? 'hi' : 'en',
    });
    const planData = planRes.data as { budgetEstimateInr?: number; destinationName?: string } | undefined;
    if (planData) {
      notes.unshift(
        isHindi
          ? `${planData.destinationName} ke liye ${days}-din ka catalog itinerary (${travelers} travelers) taiyar hai (~₹${(planData.budgetEstimateInr || 0).toLocaleString('en-IN')} baseline estimate).`
          : `Here is a ${days}-day ${planData.destinationName} plan for ${travelers} travelers (~₹${(planData.budgetEstimateInr || 0).toLocaleString('en-IN')} catalog estimate).`
      );
    }
    if (!structuredCards.some((c) => c.type === 'weather')) {
      await exec('get_weather', { city: targetCityShort });
    }
  } else if (structuredCards.length === 0 && notes.length === 0) {
    await exec('search_destinations', { query: '' });
    notes.push(
      isHindi
        ? `Main aapki TripSplit AI Travel Agent hoon (${req.currentPath || '/'}). Aap itinerary plan, Mausam, USD→INR rate, 60 destinations, safety helplines, ya group expense splitting pooch sakte hain.`
        : `I'm your TripSplit AI Travel Agent (aware of ${req.currentPath || 'this page'}). Ask me to build a day-by-day itinerary, check live weather, convert currencies, inspect destinations, check emergency helplines, or manage trips & expenses.`
    );
  }

  const guestAuthMode = req.allowPaidLlm === false;
  const keyDisclosure = guestAuthMode
    ? isHindi
      ? '\n\n[Guest Mode: Itinerary, weather, currency, aur safety tools active hain. Private trip actions aur conversational LLM ke liye Sign In karein.]'
      : '\n\n[Guest Mode: Catalog planner, live weather, FX conversion, and safety tools are active. Sign in to unlock private trip persistence & full conversational AI.]'
    : isHindi
      ? '\n\n[Mode Notice: OPENAI_API_KEY aur GEMINI_API_KEY configured nahi hain — response verified catalog tools, Open-Meteo weather, aur Frankfurter FX adapters se aaya hai.]'
      : '\n\n[Mode Notice: Generative LLM mode requires OPENAI_API_KEY or GEMINI_API_KEY; this answer was assembled deterministically from verified TripSplit tools & live public adapters.]';

  return {
    reply: `${notes.join(' ')}${keyDisclosure}`,
    provider: 'unconfigured',
    model: guestAuthMode ? 'guest-deterministic' : 'none',
    fallbackUsed: false,
    toolExecutions,
    pendingConfirmations,
    structuredCards,
    missingCredentials: guestAuthMode ? [] : ['OPENAI_API_KEY', 'GEMINI_API_KEY'],
  };
}

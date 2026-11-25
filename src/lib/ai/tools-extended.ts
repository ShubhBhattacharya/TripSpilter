import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendingConfirmationAction, StructuredCard } from './types';
import {
  buildDestinationItineraryPlan,
  buildTransitLinksCard,
  buildTravelSafetyCard,
} from './travel-planner';
import { getWeatherForLocation } from '../providers/travel-providers';

export interface ExtendedToolResult {
  ok: boolean;
  data?: unknown;
  card?: StructuredCard;
  error?: string;
  requiresConfirmation?: PendingConfirmationAction;
}

export interface ExtendedToolContext {
  userId: string | null;
  supabase: SupabaseClient | null;
}

export const EXTENDED_AI_TOOL_DECLARATIONS = [
  {
    name: 'generate_trip_plan',
    description:
      'Build a structured day-by-day destination itinerary grounded in TripSplit curated catalog prices and scenic spots.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'City or region in India (e.g. Manali, Goa, Jaipur)' },
        days: { type: 'number', description: 'Number of days (1-7)' },
        travelers: { type: 'number', description: 'Number of travelers (1-20)' },
        language: { type: 'string', enum: ['en', 'hi'] },
      },
      required: ['destination'],
    },
  },
  {
    name: 'search_transit_links',
    description:
      'Generate transparent external transit search links (Google Maps Transit, IRCTC Rail, RedBus) with zero fabricated fares or seat availability.',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string' },
        destination: { type: 'string' },
      },
      required: ['origin', 'destination'],
    },
  },
  {
    name: 'get_travel_safety',
    description:
      'Provide verified Indian tourist/emergency helplines alongside weather-derived packing advice and alerts.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        language: { type: 'string', enum: ['en', 'hi'] },
      },
    },
  },
  {
    name: 'get_user_bookings',
    description:
      'Fetch saved bookings in the authenticated user’s TripSplit Bookings Vault.',
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string', description: 'Optional trip UUID filter' },
      },
    },
  },
  {
    name: 'update_trip_draft',
    description:
      'Prepare an explicit confirmation card before updating an existing trip title, destination, dates, budget, or status.',
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string' },
        title: { type: 'string' },
        destination: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        budget: { type: 'number' },
        status: { type: 'string', enum: ['ACTIVE', 'UPCOMING', 'COMPLETED'] },
      },
      required: ['tripId'],
    },
  },
  {
    name: 'create_settlement_draft',
    description:
      'Prepare a confirmation card before logging a pending P2P settlement proposal between trip members.',
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string' },
        toUserId: { type: 'string' },
        toUserName: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['tripId', 'toUserId', 'amount'],
    },
  },
  {
    name: 'create_booking_draft',
    description:
      'Prepare a confirmation card before saving a booking draft or external provider link to the trip Bookings Vault.',
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string' },
        title: { type: 'string' },
        vendorName: { type: 'string' },
        category: { type: 'string', enum: ['Hotel', 'Flight', 'Train', 'Bus', 'Rental', 'Activity', 'Other'] },
        amount: { type: 'number' },
        externalUrl: { type: 'string' },
      },
      required: ['tripId', 'title', 'category', 'amount'],
    },
  },
  {
    name: 'save_preference_draft',
    description:
      'Prepare a confirmation card before saving user language, currency, or auto-narration preferences.',
    parameters: {
      type: 'object',
      properties: {
        preferredLanguage: { type: 'string', enum: ['en', 'hi'] },
        preferredCurrency: { type: 'string' },
        autoNarrate: { type: 'boolean' },
      },
    },
  },
] as const;

export async function executeExtendedAiTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ExtendedToolContext
): Promise<ExtendedToolResult | null> {
  switch (toolName) {
    case 'generate_trip_plan': {
      const destQuery = String(args.destination || 'Manali').trim();
      const days = Number(args.days || 3);
      const travelers = Number(args.travelers || 2);
      const language = args.language === 'hi' ? 'hi' : 'en';
      const plan = buildDestinationItineraryPlan({
        destinationQuery: destQuery,
        days,
        travelers,
        language,
      });
      return {
        ok: true,
        data: plan.card,
        card: plan.card,
      };
    }

    case 'search_transit_links': {
      const origin = String(args.origin || 'New Delhi').trim();
      const destination = String(args.destination || 'Manali').trim();
      const card = buildTransitLinksCard(origin, destination);
      return { ok: true, data: card, card };
    }

    case 'get_travel_safety': {
      const destination = args.destination ? String(args.destination).trim() : undefined;
      const language = args.language === 'hi' ? 'hi' : 'en';
      let tempC: number | null = null;
      let rainProb: number | null = null;

      if (destination) {
        const weather = await getWeatherForLocation(destination);
        if (weather.data) {
          tempC = weather.data.temperatureC;
          rainProb = weather.data.rainProbabilityPercent;
        }
      }

      const card = buildTravelSafetyCard({
        destination,
        temperatureC: tempC,
        rainProbPercent: rainProb,
        language,
      });
      return { ok: true, data: card, card };
    }

    case 'get_user_bookings': {
      if (!ctx.userId || !ctx.supabase) {
        return {
          ok: false,
          error: 'Authentication required to inspect your Bookings Vault.',
        };
      }
      const tripId = args.tripId ? String(args.tripId).trim() : null;
      let query = ctx.supabase
        .from('bookings')
        .select('id, trip_id, title, vendor_name, category, amount, status, provider_status, external_url, created_at')
        .order('created_at', { ascending: false })
        .limit(12);
      if (tripId) {
        query = query.eq('trip_id', tripId);
      }
      const { data, error } = await query;
      if (error) return { ok: false, error: error.message };

      const rows = (data || []).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        vendorName: String(row.vendor_name || 'External Provider'),
        category: String(row.category || 'Other'),
        amount: Number(row.amount || 0),
        status: String(row.status || 'Confirmed'),
        providerStatus: row.provider_status ? String(row.provider_status) : undefined,
        externalUrl: row.external_url ? String(row.external_url) : undefined,
      }));
      return {
        ok: true,
        data: rows,
        card: { type: 'bookings_summary', bookings: rows },
      };
    }

    case 'update_trip_draft': {
      if (!ctx.userId) return { ok: false, error: 'Authentication required to modify trips.' };
      const tripId = String(args.tripId || '').trim();
      if (!tripId) return { ok: false, error: 'tripId is required' };
      const updates: Record<string, unknown> = { tripId };
      if (args.title) updates.title = String(args.title).trim();
      if (args.destination) updates.destination = String(args.destination).trim();
      if (args.startDate) updates.start_date = String(args.startDate).trim();
      if (args.endDate) updates.end_date = String(args.endDate).trim();
      if (args.budget !== undefined) updates.budget = Math.max(0, Number(args.budget) || 0);
      if (args.status) updates.status = String(args.status);

      return {
        ok: true,
        requiresConfirmation: {
          actionType: 'UPDATE_TRIP',
          summary: `Update trip details for trip ${tripId.slice(0, 8)}...`,
          payload: updates,
        },
      };
    }

    case 'create_settlement_draft': {
      if (!ctx.userId) return { ok: false, error: 'Authentication required to create settlements.' };
      const tripId = String(args.tripId || '').trim();
      const toUserId = String(args.toUserId || '').trim();
      const amount = Number(args.amount || 0);
      if (!tripId || !toUserId || !Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: 'Valid tripId, toUserId, and positive amount are required.' };
      }
      const label = args.toUserName ? String(args.toUserName) : toUserId;
      return {
        ok: true,
        requiresConfirmation: {
          actionType: 'CREATE_SETTLEMENT_PROPOSAL',
          summary: `Log pending settlement of ₹${amount.toLocaleString('en-IN')} to ${label}`,
          payload: { tripId, toUserId, amount },
        },
      };
    }

    case 'create_booking_draft': {
      if (!ctx.userId) return { ok: false, error: 'Authentication required to save bookings.' };
      const tripId = String(args.tripId || '').trim();
      const title = String(args.title || '').trim();
      const category = String(args.category || 'Hotel').trim();
      const amount = Math.max(0, Number(args.amount) || 0);
      if (!tripId || !title) {
        return { ok: false, error: 'tripId and title are required to prepare a booking draft.' };
      }
      return {
        ok: true,
        requiresConfirmation: {
          actionType: 'CREATE_BOOKING_DRAFT',
          summary: `Save ${category} booking draft "${title}" (₹${amount.toLocaleString('en-IN')})`,
          payload: {
            tripId,
            title,
            vendorName: String(args.vendorName || title),
            category,
            amount,
            externalUrl: args.externalUrl ? String(args.externalUrl) : undefined,
          },
        },
      };
    }

    case 'save_preference_draft': {
      if (!ctx.userId) return { ok: false, error: 'Authentication required to save account preferences.' };
      const payload: Record<string, unknown> = {};
      if (args.preferredLanguage === 'hi' || args.preferredLanguage === 'en') {
        payload.preferred_language = args.preferredLanguage;
      }
      if (args.preferredCurrency) {
        payload.preferred_currency = String(args.preferredCurrency).toUpperCase().slice(0, 6);
      }
      if (typeof args.autoNarrate === 'boolean') {
        payload.auto_narrate = args.autoNarrate;
      }
      if (Object.keys(payload).length === 0) {
        return { ok: false, error: 'At least one preference field is required.' };
      }
      return {
        ok: true,
        requiresConfirmation: {
          actionType: 'SAVE_PREFERENCES',
          summary: `Save account preferences (${Object.entries(payload).map(([k, v]) => `${k}=${v}`).join(', ')})`,
          payload,
        },
      };
    }

    default:
      return null;
  }
}

export function extractStructuredCardFromTool(
  toolName: string,
  data: unknown
): StructuredCard | null {
  if (!data || typeof data !== 'object') return null;

  if (toolName === 'search_destinations' && Array.isArray(data) && data.length > 0) {
    const items = (data as Array<Record<string, unknown>>).slice(0, 8).map((d) => ({
      id: String(d.id || ''),
      name: String(d.name || ''),
      state: String(d.state || ''),
      region: String(d.region || ''),
      tagline: String(d.tagline || ''),
      startingPrice: Number(d.startingPrice || 1200),
      heroImage: String(d.heroImage || ''),
      spotCount: Number(d.spotCount || 4),
    }));
    return { type: 'destinations', items };
  }

  if (toolName === 'get_weather') {
    const w = data as {
      status?: string;
      source?: string;
      disclaimer?: string;
      data?: {
        city?: string;
        temperatureC?: number;
        windKmh?: number;
        rainProbabilityPercent?: number | null;
        forecast3Day?: Array<{ date: string; minC: number; maxC: number; rainProbPercent: number | null }>;
      } | null;
    };
    if (w.data) {
      return {
        type: 'weather',
        city: w.data.city || 'Destination',
        status: w.status || 'indicative_public_api',
        source: w.source || 'Open-Meteo Public Feed',
        temperatureC: w.data.temperatureC,
        windKmh: w.data.windKmh,
        rainProbabilityPercent: w.data.rainProbabilityPercent,
        forecast3Day: w.data.forecast3Day,
        disclaimer: w.disclaimer,
      };
    }
  }

  if (toolName === 'convert_currency') {
    const fx = data as {
      status?: string;
      source?: string;
      disclaimer?: string;
      data?: {
        amount?: number;
        from?: string;
        to?: string;
        rate?: number;
        convertedAmount?: number;
      } | null;
    };
    if (fx.data) {
      return {
        type: 'currency',
        status: fx.status || 'indicative_public_api',
        source: fx.source || 'Frankfurter ECB Feed',
        amount: fx.data.amount,
        from: fx.data.from,
        to: fx.data.to,
        rate: fx.data.rate,
        convertedAmount: fx.data.convertedAmount,
        disclaimer: fx.disclaimer,
      };
    }
  }

  if (toolName === 'calculate_route') {
    const rt = data as {
      status?: string;
      source?: string;
      disclaimer?: string;
      data?: {
        origin?: string;
        destination?: string;
        distanceKm?: number;
        durationMinutes?: number;
        mode?: string;
      } | null;
    };
    if (rt.data) {
      return {
        type: 'route',
        origin: rt.data.origin || '',
        destination: rt.data.destination || '',
        status: rt.status || 'indicative_public_api',
        source: rt.source || 'Coordinate Distance Estimate',
        distanceKm: rt.data.distanceKm,
        durationMinutes: rt.data.durationMinutes,
        mode: rt.data.mode,
        disclaimer: rt.disclaimer,
      };
    }
  }

  if (toolName === 'search_hotels' || toolName === 'search_flights' || toolName === 'search_attractions') {
    const env = data as {
      status?: string;
      missingCredential?: string;
      disclaimer?: string;
      source?: string;
    };
    if (env.status === 'waiting_for_credentials') {
      const cat =
        toolName === 'search_hotels' ? 'hotels' : toolName === 'search_flights' ? 'flights' : 'places';
      return {
        type: 'provider_status',
        category: cat,
        title: env.source || `${cat.toUpperCase()} Provider Adapter`,
        status: 'waiting_for_credentials',
        missingCredential: env.missingCredential,
        message:
          env.disclaimer ||
          `Configure ${env.missingCredential || 'provider credentials'} to fetch live rates. No fabricated prices are shown.`,
        links:
          cat === 'hotels'
            ? [{ label: 'Continue to Booking Search', url: 'https://www.booking.com/' }]
            : cat === 'flights'
              ? [{ label: 'Continue to Google Flights', url: 'https://www.google.com/travel/flights' }]
              : undefined,
      };
    }
  }

  if (toolName === 'get_user_trips' && Array.isArray(data)) {
    const trips = (data as Array<Record<string, unknown>>).map((t) => ({
      id: String(t.id || ''),
      title: String(t.title || ''),
      destination: String(t.destination || ''),
      budget: Number(t.budget || 0),
      startDate: t.start_date ? String(t.start_date) : undefined,
      endDate: t.end_date ? String(t.end_date) : undefined,
      status: t.status ? String(t.status) : undefined,
    }));
    return { type: 'trips_summary', trips };
  }

  return null;
}

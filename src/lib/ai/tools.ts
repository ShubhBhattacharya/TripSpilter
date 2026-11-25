import { SupabaseClient } from '@supabase/supabase-js';
import { DESTINATIONS } from '../../data/destinations';
import {
  getWeatherForLocation,
  getCurrencyRate,
  calculateRouteInfo,
  searchLivePlaces,
  searchHotels,
  searchFlights,
} from '../providers/travel-providers';
import { calculateNetBalances, optimizeSettlements } from '../financial/split-engine';

export interface ToolExecutionContext {
  userId: string | null;
  supabase: SupabaseClient | null;
}

export interface PendingConfirmationAction {
  actionType: 'CREATE_TRIP' | 'CREATE_EXPENSE' | 'UPDATE_ITINERARY';
  summary: string;
  payload: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: PendingConfirmationAction;
}

export const AI_TOOL_DECLARATIONS = [
  {
    name: 'search_destinations',
    description: 'Search TripSplit Indian destinations database by name, state, region, or spot keywords.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'City, state, or landmark keyword' },
        region: { type: 'string', description: 'Optional region: North, South, East, West, Central, Northeast' },
      },
    },
  },
  {
    name: 'get_destination_details',
    description: 'Get complete city overview and 4 included spots for a destination ID or city name.',
    parameters: {
      type: 'object',
      properties: {
        cityQuery: { type: 'string', description: 'City ID or name such as manali or jaipur' },
      },
      required: ['cityQuery'],
    },
  },
  {
    name: 'search_attractions',
    description: 'Search live places, restaurants, or tourist attractions using Google Places API (New) when configured.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        city: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_hotels',
    description: 'Query live hotel availability and rates (never fabricates prices if provider key is missing).',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        checkIn: { type: 'string' },
        checkOut: { type: 'string' },
        guests: { type: 'number' },
      },
      required: ['city'],
    },
  },
  {
    name: 'search_flights',
    description: 'Query live flight options and fares (never fabricates fares if provider key is missing).',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string' },
        destination: { type: 'string' },
        departureDate: { type: 'string' },
        passengers: { type: 'number' },
      },
      required: ['origin', 'destination'],
    },
  },
  {
    name: 'get_weather',
    description: 'Fetch current weather and forecast for a destination.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' },
      },
      required: ['city'],
    },
  },
  {
    name: 'calculate_route',
    description: 'Calculate route distance and travel time between two locations.',
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
    name: 'convert_currency',
    description: 'Convert monetary amount between currencies (indicative rates with source & timestamp).',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['amount', 'from', 'to'],
    },
  },
  {
    name: 'get_user_trips',
    description: 'Fetch the authenticated user trips from PostgreSQL.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_trip_expenses',
    description: 'Fetch expenses and compute exact balances & settlements for a specific user trip.',
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string' },
      },
      required: ['tripId'],
    },
  },
  {
    name: 'create_trip_draft',
    description: 'Prepare a new trip draft for explicit user confirmation before saving to database.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        destination: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        budget: { type: 'number' },
      },
      required: ['title', 'destination'],
    },
  },
  {
    name: 'create_expense_draft',
    description: 'Prepare an expense draft for explicit user confirmation before writing to database.',
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string' },
        vendorName: { type: 'string' },
        totalAmount: { type: 'number' },
        splitType: { type: 'string' },
      },
      required: ['vendorName', 'totalAmount'],
    },
  },
  {
    name: 'update_itinerary_draft',
    description: 'Prepare an itinerary item draft for explicit user approval.',
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string' },
        day: { type: 'number' },
        title: { type: 'string' },
        time: { type: 'string' },
        estimatedCost: { type: 'number' },
      },
      required: ['title'],
    },
  },
] as const;

export async function executeAiTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'search_destinations': {
        const q = String(args.query || '').toLowerCase().trim();
        const region = args.region ? String(args.region).toLowerCase() : '';
        const matches = DESTINATIONS.filter((d) => {
          const regionOk = !region || d.region.toLowerCase() === region;
          const qOk =
            !q ||
            d.name.toLowerCase().includes(q) ||
            d.state.toLowerCase().includes(q) ||
            d.spots.some((s) => s.name.toLowerCase().includes(q));
          return regionOk && qOk;
        }).slice(0, 12);

        return {
          tool: toolName,
          ok: true,
          data: matches.map((d) => ({
            id: d.id,
            name: d.name,
            region: d.region,
            startingPriceInr: d.startingPrice,
            spots: d.spots.map((s) => ({ name: s.name, costInr: s.cost, bestTime: s.bestTime })),
          })),
        };
      }

      case 'get_destination_details': {
        const q = String(args.cityQuery || '').toLowerCase().trim();
        const city =
          DESTINATIONS.find(
            (d) => d.id === q || d.name.toLowerCase().includes(q)
          ) || null;
        if (!city) {
          return { tool: toolName, ok: false, error: `Destination "${args.cityQuery}" not found.` };
        }
        return {
          tool: toolName,
          ok: true,
          data: {
            id: city.id,
            name: city.name,
            state: city.state,
            region: city.region,
            tagline: city.tagline,
            description: city.description,
            startingPriceInr: city.startingPrice,
            coordinates: { lat: city.lat, lng: city.lng },
            spots: city.spots.map((s) => ({
              id: s.id,
              name: s.name,
              subtitle: s.subtitle,
              costInr: s.cost,
              duration: s.duration,
              bestTime: s.bestTime,
            })),
          },
        };
      }

      case 'search_attractions': {
        const res = await searchLivePlaces(String(args.query || ''), args.city ? String(args.city) : undefined);
        return { tool: toolName, ok: true, data: res };
      }

      case 'search_hotels': {
        const res = await searchHotels({
          city: String(args.city || ''),
          checkIn: String(args.checkIn || new Date().toISOString().split('T')[0]),
          checkOut: String(args.checkOut || new Date(Date.now() + 86400000).toISOString().split('T')[0]),
          guests: Number(args.guests || 2),
        });
        return { tool: toolName, ok: true, data: res };
      }

      case 'search_flights': {
        const res = await searchFlights({
          origin: String(args.origin || ''),
          destination: String(args.destination || ''),
          departureDate: String(args.departureDate || new Date().toISOString().split('T')[0]),
          passengers: Number(args.passengers || 1),
        });
        return { tool: toolName, ok: true, data: res };
      }

      case 'get_weather': {
        const cityName = String(args.city || '');
        const match = DESTINATIONS.find(
          (d) => d.id === cityName.toLowerCase() || d.name.toLowerCase().includes(cityName.toLowerCase())
        );
        const lat = typeof args.lat === 'number' ? args.lat : match?.lat;
        const lng = typeof args.lng === 'number' ? args.lng : match?.lng;
        const res = await getWeatherForLocation(cityName, lat, lng);
        return { tool: toolName, ok: true, data: res };
      }

      case 'calculate_route': {
        const res = await calculateRouteInfo(String(args.origin || ''), String(args.destination || ''));
        return { tool: toolName, ok: true, data: res };
      }

      case 'convert_currency': {
        const res = await getCurrencyRate(
          Number(args.amount || 1),
          String(args.from || 'USD').toUpperCase(),
          String(args.to || 'INR').toUpperCase()
        );
        return { tool: toolName, ok: true, data: res };
      }

      case 'get_user_trips': {
        if (!ctx.userId || !ctx.supabase) {
          return {
            tool: toolName,
            ok: false,
            error: 'Authentication required to view personal database trips.',
          };
        }
        const { data, error } = await ctx.supabase
          .from('trips')
          .select('id, title, destination, start_date, end_date, budget, status')
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) return { tool: toolName, ok: false, error: error.message };
        return { tool: toolName, ok: true, data: { trips: data || [] } };
      }

      case 'get_trip_expenses': {
        if (!ctx.userId || !ctx.supabase) {
          return {
            tool: toolName,
            ok: false,
            error: 'Authentication required to inspect trip expenses.',
          };
        }
        const tripId = String(args.tripId || '');
        const { data: member } = await ctx.supabase
          .from('trip_members')
          .select('role')
          .eq('trip_id', tripId)
          .eq('user_id', ctx.userId)
          .maybeSingle();

        const { data: tripOwner } = await ctx.supabase
          .from('trips')
          .select('created_by')
          .eq('id', tripId)
          .maybeSingle();

        if (!member && tripOwner?.created_by !== ctx.userId) {
          return { tool: toolName, ok: false, error: 'Access denied: not a member of this trip.' };
        }

        const { data: expenses, error } = await ctx.supabase
          .from('expenses')
          .select('id, paid_by, vendor_name, total_amount, total_amount_paise, split_type, created_at, expense_splits(user_id, amount_owed, amount_owed_paise, status)')
          .eq('trip_id', tripId);

        if (error) return { tool: toolName, ok: false, error: error.message };

        const { data: members } = await ctx.supabase
          .from('trip_members')
          .select('user_id, profiles(display_name, full_name)')
          .eq('trip_id', tripId);

        const memberIds = Array.from(
          new Set<string>([
            ...(members || []).map((m) => m.user_id),
            ...(expenses || []).map((e) => e.paid_by),
          ])
        );

        const rawExpenses = (expenses || []).map((e) => ({
          id: e.id,
          paidBy: e.paid_by,
          totalAmount: Number(e.total_amount),
        }));

        const rawSplits = (expenses || []).flatMap((e) =>
          (e.expense_splits || []).map(
            (sp: { user_id: string; amount_owed: number; status: string }) => ({
              expenseId: e.id,
              userId: sp.user_id,
              amountOwed: Number(sp.amount_owed),
              status: sp.status,
            })
          )
        );

        const { balances, totalTripSpend, isZeroSum } = calculateNetBalances({
          memberIds,
          expenses: rawExpenses,
          splits: rawSplits,
          settlements: [],
        });
        const settlements = optimizeSettlements(balances);

        const nameMap: Record<string, string> = {};
        for (const m of members || []) {
          const prof = m.profiles as unknown as { display_name?: string; full_name?: string } | null;
          nameMap[m.user_id] = prof?.display_name || prof?.full_name || m.user_id;
        }

        return {
          tool: toolName,
          ok: true,
          data: {
            expenseCount: expenses?.length || 0,
            totalTripSpendInr: totalTripSpend,
            isZeroSum,
            balances: Object.values(balances).map((b) => ({
              ...b,
              memberName: nameMap[b.userId] || b.userId,
            })),
            settlements: settlements.map((s) => ({
              ...s,
              fromName: nameMap[s.fromUserId] || s.fromUserId,
              toName: nameMap[s.toUserId] || s.toUserId,
            })),
          },
        };
      }

      case 'create_trip_draft': {
        const startDate = String(args.startDate || new Date().toISOString().split('T')[0]);
        const endDate = String(
          args.endDate || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
        );
        const budget = Math.max(0, Number(args.budget || 10000));
        return {
          tool: toolName,
          ok: true,
          requiresConfirmation: {
            actionType: 'CREATE_TRIP',
            summary: `Create trip "${args.title}" to ${args.destination} (${startDate} to ${endDate}) with budget ₹${budget}`,
            payload: {
              title: String(args.title),
              destination: String(args.destination),
              startDate,
              endDate,
              budget,
            },
          },
          data: { draftPrepared: true, awaitingUserApproval: true },
        };
      }

      case 'create_expense_draft': {
        const totalAmount = Math.max(1, Number(args.totalAmount || 0));
        return {
          tool: toolName,
          ok: true,
          requiresConfirmation: {
            actionType: 'CREATE_EXPENSE',
            summary: `Add ${args.splitType || 'EQUAL'} expense of ₹${totalAmount} for "${args.vendorName}"`,
            payload: {
              tripId: String(args.tripId || ''),
              vendorName: String(args.vendorName),
              totalAmount,
              splitType: String(args.splitType || 'EQUAL'),
            },
          },
          data: { draftPrepared: true, awaitingUserApproval: true },
        };
      }

      case 'update_itinerary_draft': {
        return {
          tool: toolName,
          ok: true,
          requiresConfirmation: {
            actionType: 'UPDATE_ITINERARY',
            summary: `Add Day ${Number(args.day || 1)} activity "${args.title}"`,
            payload: {
              tripId: String(args.tripId || ''),
              day: Number(args.day || 1),
              title: String(args.title),
              time: String(args.time || '10:00 AM'),
              estimatedCost: Number(args.estimatedCost || 0),
            },
          },
          data: { draftPrepared: true, awaitingUserApproval: true },
        };
      }

      default:
        return { tool: toolName, ok: false, error: `Tool "${toolName}" is not permitted.` };
    }
  } catch (err) {
    return {
      tool: toolName,
      ok: false,
      error: err instanceof Error ? err.message : 'Tool execution error',
    };
  }
}

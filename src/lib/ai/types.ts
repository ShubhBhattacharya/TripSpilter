export type AIProviderName = 'openai' | 'gemini' | 'unconfigured';

export type AILanguage = 'hi' | 'en';

export type PendingActionType =
  | 'CREATE_TRIP'
  | 'UPDATE_ITINERARY'
  | 'UPDATE_TRIP'
  | 'CREATE_EXPENSE'
  | 'CREATE_SETTLEMENT_PROPOSAL'
  | 'CREATE_BOOKING_DRAFT'
  | 'SAVE_PREFERENCES';

export interface PendingConfirmationAction {
  actionType: PendingActionType;
  summary: string;
  payload: Record<string, unknown>;
}

export interface ItineraryDayPlan {
  day: number;
  title: string;
  morning: string;
  afternoon: string;
  evening: string;
  estimatedCostInr: number;
}

export type StructuredCard =
  | {
      type: 'itinerary';
      destinationId: string;
      destinationName: string;
      state: string;
      days: number;
      travelers: number;
      budgetEstimateInr: number;
      heroImage: string;
      schedule: ItineraryDayPlan[];
      disclaimer: string;
    }
  | {
      type: 'destinations';
      query?: string;
      items: Array<{
        id: string;
        name: string;
        state: string;
        region: string;
        tagline: string;
        startingPrice: number;
        heroImage: string;
        spotCount: number;
      }>;
    }
  | {
      type: 'weather';
      city: string;
      status: string;
      source: string;
      temperatureC?: number;
      windKmh?: number;
      rainProbabilityPercent?: number | null;
      forecast3Day?: Array<{
        date: string;
        minC: number;
        maxC: number;
        rainProbPercent: number | null;
      }>;
      disclaimer?: string;
    }
  | {
      type: 'currency';
      status: string;
      source: string;
      amount?: number;
      from?: string;
      to?: string;
      rate?: number;
      convertedAmount?: number;
      disclaimer?: string;
    }
  | {
      type: 'route';
      origin: string;
      destination: string;
      status: string;
      source: string;
      distanceKm?: number;
      durationMinutes?: number;
      mode?: string;
      disclaimer?: string;
    }
  | {
      type: 'provider_status';
      category: 'hotels' | 'flights' | 'places' | 'transit';
      title: string;
      status: string;
      missingCredential?: string;
      message: string;
      links?: Array<{ label: string; url: string }>;
    }
  | {
      type: 'safety';
      destination?: string;
      helplines: Array<{ label: string; number: string; note: string }>;
      weatherAlert?: string | null;
      packingTips: string[];
      source: string;
    }
  | {
      type: 'trips_summary';
      trips: Array<{
        id: string;
        title: string;
        destination: string;
        budget: number;
        startDate?: string;
        endDate?: string;
        status?: string;
      }>;
    }
  | {
      type: 'bookings_summary';
      bookings: Array<{
        id: string;
        title: string;
        vendorName: string;
        category: string;
        amount: number;
        status: string;
        providerStatus?: string;
        externalUrl?: string;
      }>;
    };

export interface ChatTurnMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AICompanionRequest {
  messages: ChatTurnMessage[];
  tripId?: string;
  language?: AILanguage;
  preferredProvider?: 'openai' | 'gemini' | 'auto';
  currentPath?: string;
  allowPaidLlm?: boolean;
}

export interface AICompanionResponse {
  reply: string;
  provider: AIProviderName;
  model: string;
  fallbackUsed: boolean;
  toolExecutions: Array<{ tool: string; ok: boolean }>;
  pendingConfirmations: PendingConfirmationAction[];
  structuredCards: StructuredCard[];
  missingCredentials?: string[];
}

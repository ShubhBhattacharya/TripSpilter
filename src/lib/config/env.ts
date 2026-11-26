/**
 * Centralized Environment & Integration Configuration Validator
 * Strictly separates public browser keys from server-only secrets.
 * Never exposes secret values in logs or API responses.
 */

export interface PublicConfigStatus {
  supabaseConfigured: boolean;
  demoMode: boolean;
}

export interface ServerIntegrationStatus {
  supabase: boolean;
  supabaseServiceRole: boolean;
  phoneOtpEnabled: boolean;
  openai: boolean;
  gemini: boolean;
  googleMapsPlaces: boolean;
  unsplashImages: boolean;
  hotelProvider: boolean;
  flightProvider: boolean;
  activitiesProvider: boolean;
  weatherProvider: 'commercial_key' | 'open_meteo_free_non_commercial';
  currencyProvider: 'commercial_key' | 'frankfurter_ecb_indicative';
  paymentGateway: boolean;
  redisRateLimit: boolean;
}

const PLACEHOLDER_TOKENS = [
  'your-project-ref',
  'your-supabase-url',
  'your-supabase-anon-key',
  'placeholder-project',
  'placeholder-anon-key',
];

function isNonPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_TOKENS.some((tok) => trimmed.toLowerCase().includes(tok));
}

export function isValidSupabaseConfig(): boolean {
  return (
    isNonPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isNonPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/**
 * Throws a clear configuration error on server-only calls when strict DB mode is required.
 */
export function assertSupabaseConfigured(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isNonPlaceholder(url) || !isNonPlaceholder(anonKey)) {
    throw new Error(
      'Supabase is not configured. Set valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.'
    );
  }
  return { url: url!, anonKey: anonKey! };
}

/**
 * Server-only privileged service role accessor. Never import this in client components.
 */
export function getServerServiceRoleKey(): string | null {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: Attempted to read SUPABASE_SERVICE_ROLE_KEY in browser.');
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return isNonPlaceholder(key) ? key! : null;
}

/**
 * Non-secret readiness inventory for admin diagnostics and honest UI disclosure.
 */
export function getServerIntegrationStatus(): ServerIntegrationStatus {
  return {
    supabase: isValidSupabaseConfig(),
    supabaseServiceRole: isNonPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY),
    phoneOtpEnabled: process.env.NEXT_PUBLIC_SUPABASE_PHONE_ENABLED === 'true',
    openai: isNonPlaceholder(process.env.OPENAI_API_KEY),
    gemini: isNonPlaceholder(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY),
    googleMapsPlaces: isNonPlaceholder(process.env.GOOGLE_MAPS_API_KEY),
    unsplashImages: isNonPlaceholder(process.env.UNSPLASH_ACCESS_KEY),
    hotelProvider: isNonPlaceholder(process.env.HOTEL_PROVIDER_API_KEY),
    flightProvider:
      isNonPlaceholder(process.env.FLIGHT_PROVIDER_API_KEY) &&
      isNonPlaceholder(process.env.FLIGHT_PROVIDER_API_SECRET),
    activitiesProvider: isNonPlaceholder(process.env.ACTIVITIES_PROVIDER_API_KEY),
    weatherProvider: isNonPlaceholder(process.env.WEATHER_PROVIDER_API_KEY)
      ? 'commercial_key'
      : 'open_meteo_free_non_commercial',
    currencyProvider: isNonPlaceholder(process.env.CURRENCY_PROVIDER_API_KEY)
      ? 'commercial_key'
      : 'frankfurter_ecb_indicative',
    paymentGateway:
      isNonPlaceholder(process.env.PAYMENT_PROVIDER_API_KEY) &&
      isNonPlaceholder(process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET),
    redisRateLimit:
      isNonPlaceholder(process.env.UPSTASH_REDIS_REST_URL) &&
      isNonPlaceholder(process.env.UPSTASH_REDIS_REST_TOKEN),
  };
}

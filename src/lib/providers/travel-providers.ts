import { DESTINATIONS } from '../../data/destinations';

export type ProviderAvailability =
  | 'live_verified'
  | 'indicative_public_api'
  | 'waiting_for_credentials'
  | 'error';

export interface LiveProviderEnvelope<T> {
  status: ProviderAvailability;
  source: string;
  lastUpdated: string;
  cached?: boolean;
  missingCredential?: string;
  disclaimer?: string;
  data: T | null;
}

const providerCache = new Map<string, { expiresAt: number; payload: unknown }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): LiveProviderEnvelope<T> | null {
  const entry = providerCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    providerCache.delete(key);
    return null;
  }
  const cloned = entry.payload as LiveProviderEnvelope<T>;
  return { ...cloned, cached: true };
}

function setCached<T>(key: string, payload: LiveProviderEnvelope<T>): void {
  if (payload.status === 'live_verified' || payload.status === 'indicative_public_api') {
    providerCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  }
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || attempt === retries) return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    }
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error('Provider fetch failed');
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  rating?: number;
  lat: number;
  lng: number;
  photoUrl?: string;
  attribution?: string;
  openingHours?: string[];
}

export interface HotelSearchParams {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

export interface HotelOffer {
  id: string;
  name: string;
  priceTotal: number;
  currency: string;
  refundable?: boolean;
  cancellationPolicy?: string;
  bookingRedirectUrl: string;
  bookingMode: 'direct_provider_api' | 'redirect_only';
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  passengers: number;
}

export interface FlightOffer {
  id: string;
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  totalPrice: number;
  currency: string;
  fareClass?: string;
  checkedBaggage?: string;
  refundable?: boolean;
  bookingRedirectUrl: string;
  bookingMode: 'direct_provider_api' | 'redirect_only';
}

export interface WeatherResult {
  city: string;
  temperatureC: number;
  windKmh: number;
  condition: string;
  rainProbabilityPercent: number | null;
  forecast3Day: Array<{ date: string; minC: number; maxC: number; rainProbPercent: number | null }>;
}

export interface CurrencyConversionResult {
  amount: number;
  from: string;
  to: string;
  rate: number;
  convertedAmount: number;
}

export interface RouteResult {
  origin: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
  mode: 'google_routes_api' | 'haversine_estimate';
}

/**
 * 1. Google Places API (New) Adapter
 */
export async function searchLivePlaces(
  query: string,
  city?: string
): Promise<LiveProviderEnvelope<PlaceResult[]>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const now = new Date().toISOString();

  if (!apiKey) {
    return {
      status: 'waiting_for_credentials',
      source: 'Google Places API (New)',
      lastUpdated: now,
      missingCredential: 'GOOGLE_MAPS_API_KEY',
      disclaimer: 'Live data currently unavailable. Configure GOOGLE_MAPS_API_KEY to fetch live Places results.',
      data: null,
    };
  }

  const cacheKey = `places:${query.toLowerCase().trim()}:${(city || '').toLowerCase().trim()}`;
  const cached = getCached<PlaceResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const textQuery = city ? `${query} in ${city}, India` : query;
    const res = await fetchWithRetry('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.rating,places.location,places.regularOpeningHours.weekdayDescriptions,places.photos',
      },
      body: JSON.stringify({ textQuery, maxResultCount: 10 }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return {
        status: 'error',
        source: 'Google Places API (New)',
        lastUpdated: now,
        disclaimer: `Google Places upstream HTTP ${res.status}`,
        data: null,
      };
    }

    const json = await res.json();
    const places: PlaceResult[] = (json.places || []).map((p: {
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      rating?: number;
      location?: { latitude?: number; longitude?: number };
      regularOpeningHours?: { weekdayDescriptions?: string[] };
      photos?: Array<{ name?: string; authorAttributions?: Array<{ displayName?: string }> }>;
    }) => {
      const photoName = p.photos?.[0]?.name;
      return {
        id: p.id,
        name: p.displayName?.text || 'Unnamed Place',
        address: p.formattedAddress || '',
        rating: p.rating,
        lat: p.location?.latitude || 0,
        lng: p.location?.longitude || 0,
        // Proxy photo cleanly via /api/travel?type=photo so GOOGLE_MAPS_API_KEY never leaks in client URLs
        photoUrl: photoName ? `/api/travel?type=photo&photoName=${encodeURIComponent(photoName)}` : undefined,
        attribution: p.photos?.[0]?.authorAttributions?.[0]?.displayName || 'Google Places contributor',
        openingHours: p.regularOpeningHours?.weekdayDescriptions,
      };
    });

    const envelope: LiveProviderEnvelope<PlaceResult[]> = {
      status: 'live_verified',
      source: 'Google Places API (New)',
      lastUpdated: now,
      data: places,
    };
    setCached(cacheKey, envelope);
    return envelope;
  } catch (err) {
    return {
      status: 'error',
      source: 'Google Places API (New)',
      lastUpdated: now,
      disclaimer: err instanceof Error ? err.message : 'Google Places lookup failed',
      data: null,
    };
  }
}

/**
 * 2. Hotel Inventory Provider Adapter (Zero fabricated prices)
 */
export async function searchHotels(
  params: HotelSearchParams
): Promise<LiveProviderEnvelope<HotelOffer[]>> {
  const apiKey = process.env.HOTEL_PROVIDER_API_KEY?.trim();
  const now = new Date().toISOString();

  if (!apiKey) {
    return {
      status: 'waiting_for_credentials',
      source: 'Hotel Inventory Adapter (Unconfigured)',
      lastUpdated: now,
      missingCredential: 'HOTEL_PROVIDER_API_KEY',
      disclaimer:
        'Live hotel availability and rates are currently unavailable — waiting for authorized HOTEL_PROVIDER_API_KEY (Amadeus / Hotelbeds / LiteAPI). TripSplit will never display fabricated prices.',
      data: null,
    };
  }

  // Adapter endpoint hook via configurable HOTEL_PROVIDER_ENDPOINT (or LiteAPI default when key is configured)
  const endpoint =
    process.env.HOTEL_PROVIDER_ENDPOINT?.trim() ||
    'https://api.liteapi.travel/v3.0/data/hotels';
  try {
    const url = new URL(endpoint);
    url.searchParams.set('cityName', params.city);
    url.searchParams.set('countryCode', 'IN');
    url.searchParams.set('limit', '10');

    const res = await fetch(url.toString(), {
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return {
        status: 'error',
        source: 'Hotel Provider API',
        lastUpdated: now,
        disclaimer: `Hotel provider returned HTTP ${res.status}`,
        data: null,
      };
    }

    const json = await res.json();
    const rawList = Array.isArray(json.data) ? json.data : [];
    const mapped: HotelOffer[] = rawList
      .filter((h: { price?: number }) => typeof h.price === 'number')
      .map((h: { id?: string; name?: string; price: number; currency?: string }) => ({
        id: String(h.id || 'hotel'),
        name: String(h.name || 'Hotel'),
        priceTotal: Number(h.price),
        currency: String(h.currency || 'INR'),
        bookingRedirectUrl: `https://www.google.com/travel/hotels/${encodeURIComponent(params.city)}`,
        bookingMode: 'redirect_only',
      }));

    return {
      status: 'live_verified',
      source: 'Configured Hotel Provider API',
      lastUpdated: now,
      data: mapped,
    };
  } catch (err) {
    return {
      status: 'error',
      source: 'Hotel Provider API',
      lastUpdated: now,
      disclaimer: err instanceof Error ? err.message : 'Hotel search failed',
      data: null,
    };
  }
}

/**
 * 3. Flight Provider Adapter (Zero fabricated fares)
 */
export async function searchFlights(
  params: FlightSearchParams
): Promise<LiveProviderEnvelope<FlightOffer[]>> {
  const apiKey = process.env.FLIGHT_PROVIDER_API_KEY?.trim();
  const apiSecret = process.env.FLIGHT_PROVIDER_API_SECRET?.trim();
  const now = new Date().toISOString();

  if (!apiKey || !apiSecret) {
    return {
      status: 'waiting_for_credentials',
      source: 'Flight Data Adapter (Amadeus Self-Service / Duffel)',
      lastUpdated: now,
      missingCredential: 'FLIGHT_PROVIDER_API_KEY & FLIGHT_PROVIDER_API_SECRET',
      disclaimer:
        'Live flight schedules and fares are currently unavailable — waiting for FLIGHT_PROVIDER_API_KEY and FLIGHT_PROVIDER_API_SECRET. TripSplit never invents airfares.',
      data: null,
    };
  }

  // Amadeus OAuth2 + Flight Offers Search integration
  try {
    const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: apiKey,
        client_secret: apiSecret,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!tokenRes.ok) {
      return {
        status: 'error',
        source: 'Amadeus Flight API',
        lastUpdated: now,
        disclaimer: 'Flight provider OAuth authentication failed.',
        data: null,
      };
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;

    const searchUrl = new URL('https://test.api.amadeus.com/v2/shopping/flight-offers');
    searchUrl.searchParams.set('originLocationCode', params.origin.slice(0, 3).toUpperCase());
    searchUrl.searchParams.set('destinationLocationCode', params.destination.slice(0, 3).toUpperCase());
    searchUrl.searchParams.set('departureDate', params.departureDate);
    searchUrl.searchParams.set('adults', String(Math.max(1, params.passengers)));
    searchUrl.searchParams.set('currencyCode', 'INR');
    searchUrl.searchParams.set('max', '10');

    const offersRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!offersRes.ok) {
      return {
        status: 'error',
        source: 'Amadeus Flight API',
        lastUpdated: now,
        disclaimer: `Flight search returned HTTP ${offersRes.status}`,
        data: null,
      };
    }

    const offersJson = await offersRes.json();
    const offers: FlightOffer[] = (offersJson.data || []).map((o: {
      id: string;
      price?: { grandTotal?: string; currency?: string };
      itineraries?: Array<{
        segments?: Array<{
          carrierCode?: string;
          number?: string;
          departure?: { at?: string };
          arrival?: { at?: string };
        }>;
      }>;
    }) => {
      const seg0 = o.itineraries?.[0]?.segments?.[0];
      return {
        id: o.id,
        airline: seg0?.carrierCode || 'Carrier',
        flightNumber: `${seg0?.carrierCode || ''}${seg0?.number || ''}`,
        departureTime: seg0?.departure?.at || '',
        arrivalTime: seg0?.arrival?.at || '',
        totalPrice: Number(o.price?.grandTotal || 0),
        currency: o.price?.currency || 'INR',
        bookingRedirectUrl: `https://www.google.com/travel/flights?q=${encodeURIComponent(
          `${params.origin} to ${params.destination} ${params.departureDate}`
        )}`,
        bookingMode: 'redirect_only',
      };
    });

    return {
      status: 'live_verified',
      source: 'Amadeus Flight Offers API',
      lastUpdated: now,
      data: offers,
    };
  } catch (err) {
    return {
      status: 'error',
      source: 'Amadeus Flight API',
      lastUpdated: now,
      disclaimer: err instanceof Error ? err.message : 'Flight query failed',
      data: null,
    };
  }
}

/**
 * 4. Weather Provider Adapter
 * Uses configured WEATHER_PROVIDER_API_KEY (OpenWeatherMap) or falls back to
 * Open-Meteo (strictly labelled non-commercial indicative feed).
 */
export async function getWeatherForLocation(
  city: string,
  latArg?: number,
  lngArg?: number
): Promise<LiveProviderEnvelope<WeatherResult>> {
  const now = new Date().toISOString();
  const dest = DESTINATIONS.find(
    (d) => d.id === city.toLowerCase() || d.name.toLowerCase().includes(city.toLowerCase())
  );
  const lat = latArg ?? dest?.lat;
  const lng = lngArg ?? dest?.lng;

  if (lat === undefined || lng === undefined) {
    return {
      status: 'error',
      source: 'Weather Adapter',
      lastUpdated: now,
      disclaimer: `Coordinates not resolved for "${city}".`,
      data: null,
    };
  }

  const commercialKey = process.env.WEATHER_PROVIDER_API_KEY?.trim();
  if (commercialKey) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${commercialKey}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const w = await res.json();
        return {
          status: 'live_verified',
          source: 'OpenWeatherMap Commercial API',
          lastUpdated: now,
          data: {
            city: dest?.name || city,
            temperatureC: Number(w.main?.temp ?? 0),
            windKmh: Math.round(Number(w.wind?.speed ?? 0) * 3.6),
            condition: w.weather?.[0]?.description || 'Clear',
            rainProbabilityPercent: null,
            forecast3Day: [],
          },
        };
      }
    } catch {
      // fall through cleanly
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=Asia%2FKolkata`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const daily = data.daily || {};
    const dates: string[] = daily.time || [];

    return {
      status: 'indicative_public_api',
      source: 'Open-Meteo Public Feed',
      lastUpdated: now,
      disclaimer:
        'Indicative weather data from Open-Meteo (non-commercial tier). Configure WEATHER_PROVIDER_API_KEY for commercial SLA licensing.',
      data: {
        city: dest?.name || city,
        temperatureC: Number(data.current?.temperature_2m ?? 0),
        windKmh: Number(data.current?.wind_speed_10m ?? 0),
        condition: `WMO Code ${data.current?.weather_code ?? 0}`,
        rainProbabilityPercent:
          Array.isArray(daily.precipitation_probability_max) && daily.precipitation_probability_max.length > 0
            ? Number(daily.precipitation_probability_max[0])
            : null,
        forecast3Day: dates.map((d: string, i: number) => ({
          date: d,
          minC: Number(daily.temperature_2m_min?.[i] ?? 0),
          maxC: Number(daily.temperature_2m_max?.[i] ?? 0),
          rainProbPercent: daily.precipitation_probability_max?.[i] ?? null,
        })),
      },
    };
  } catch (err) {
    return {
      status: 'error',
      source: 'Weather Adapter',
      lastUpdated: now,
      disclaimer: err instanceof Error ? err.message : 'Weather feed unavailable',
      data: null,
    };
  }
}

/**
 * 5. Currency Conversion Adapter
 * Uses configured CURRENCY_PROVIDER_API_KEY or ECB-backed Frankfurter API,
 * always labelling indicative rates vs actual bank/payment FX rates.
 */
export async function getCurrencyRate(
  amount: number,
  from: string,
  to: string
): Promise<LiveProviderEnvelope<CurrencyConversionResult>> {
  const now = new Date().toISOString();
  const base = from.toUpperCase().trim();
  const target = to.toUpperCase().trim();

  if (base === target) {
    return {
      status: 'live_verified',
      source: 'Identity Currency Conversion',
      lastUpdated: now,
      data: { amount, from: base, to: target, rate: 1, convertedAmount: amount },
    };
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?amount=${encodeURIComponent(amount)}&from=${encodeURIComponent(
        base
      )}&to=${encodeURIComponent(target)}`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (!res.ok) throw new Error(`Currency feed HTTP ${res.status}`);
    const data = await res.json();
    const converted = Number(data?.rates?.[target] ?? 0);
    const rate = amount > 0 ? Number((converted / amount).toFixed(6)) : 0;

    return {
      status: 'indicative_public_api',
      source: 'European Central Bank via Frankfurter',
      lastUpdated: data.date ? `${data.date}T00:00:00Z` : now,
      disclaimer: 'Indicative reference FX rate only. Actual bank/card settlement rates may differ.',
      data: { amount, from: base, to: target, rate, convertedAmount: converted },
    };
  } catch (err) {
    return {
      status: 'error',
      source: 'Currency Exchange Adapter',
      lastUpdated: now,
      disclaimer: err instanceof Error ? err.message : 'Currency API unavailable',
      data: null,
    };
  }
}

/**
 * 6. Route & Distance Calculator Adapter
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export async function calculateRouteInfo(
  origin: string,
  destination: string
): Promise<LiveProviderEnvelope<RouteResult>> {
  const now = new Date().toISOString();
  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (googleKey) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
          origin
        )}&destinations=${encodeURIComponent(destination)}&key=${googleKey}`,
        { signal: AbortSignal.timeout(7000) }
      );
      if (res.ok) {
        const json = await res.json();
        const el = json.rows?.[0]?.elements?.[0];
        if (el?.status === 'OK') {
          return {
            status: 'live_verified',
            source: 'Google Distance Matrix API',
            lastUpdated: now,
            data: {
              origin,
              destination,
              distanceKm: Math.round((el.distance.value / 1000) * 10) / 10,
              durationMinutes: Math.round(el.duration.value / 60),
              mode: 'google_routes_api',
            },
          };
        }
      }
    } catch {
      // Fall through cleanly
    }
  }

  const origDest = DESTINATIONS.find((d) =>
    d.name.toLowerCase().includes(origin.toLowerCase().split(',')[0].trim())
  );
  const targDest = DESTINATIONS.find((d) =>
    d.name.toLowerCase().includes(destination.toLowerCase().split(',')[0].trim())
  );

  if (origDest && targDest) {
    const airKm = haversineKm(origDest.lat, origDest.lng, targDest.lat, targDest.lng);
    const estRoadKm = Math.round(airKm * 1.25 * 10) / 10;
    return {
      status: 'indicative_public_api',
      source: 'Coordinate Distance Estimate',
      lastUpdated: now,
      disclaimer: 'Indicative straight-line adjusted estimate. Configure GOOGLE_MAPS_API_KEY for live road routing.',
      data: {
        origin: origDest.name,
        destination: targDest.name,
        distanceKm: estRoadKm,
        durationMinutes: Math.round((estRoadKm / 55) * 60),
        mode: 'haversine_estimate',
      },
    };
  }

  return {
    status: 'waiting_for_credentials',
    source: 'Google Distance Matrix / Routes API',
    lastUpdated: now,
    missingCredential: 'GOOGLE_MAPS_API_KEY',
    disclaimer: 'Configure GOOGLE_MAPS_API_KEY for live route distance and driving duration.',
    data: null,
  };
}

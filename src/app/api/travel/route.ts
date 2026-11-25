import { NextResponse } from 'next/server';
import {
  searchLivePlaces,
  searchHotels,
  searchFlights,
  getWeatherForLocation,
  getCurrencyRate,
  calculateRouteInfo,
} from '../../../lib/providers/travel-providers';
import { createClient } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/client';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../lib/rate-limit';

const VALID_PHOTO_NAME_REGEX = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';

  let userId: string | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id || null;
  }

  const rateLimit = await checkRateLimit(
    getClientIdentifier('travel_data', request, userId),
    userId ? 60 : 25,
    60000
  );
  const headers = new Headers();
  applyRateLimitHeaders(headers, rateLimit);
  if (!rateLimit.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
  }

  // Require authentication on paid external travel supplier endpoints when Supabase auth is active
  const isPaidEndpoint = ['places', 'hotels', 'flights', 'route', 'photo'].includes(type);
  if (isPaidEndpoint && isSupabaseConfigured && !userId) {
    return NextResponse.json(
      { error: 'Authentication required to query live travel provider endpoints.' },
      { status: 401, headers }
    );
  }

  switch (type) {
    case 'photo': {
      const photoName = searchParams.get('photoName') || '';
      if (!VALID_PHOTO_NAME_REGEX.test(photoName)) {
        return NextResponse.json({ error: 'Invalid photo resource name' }, { status: 400, headers });
      }
      const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
      if (!key) {
        return NextResponse.json({ error: 'Missing GOOGLE_MAPS_API_KEY' }, { status: 503, headers });
      }
      const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${key}`;
      const upstream = await fetch(mediaUrl, { signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) {
        return NextResponse.json({ error: 'Photo unavailable' }, { status: 502, headers });
      }
      const buf = await upstream.arrayBuffer();
      headers.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=86400');
      return new NextResponse(buf, { status: 200, headers });
    }

    case 'places': {
      const q = searchParams.get('query') || '';
      const city = searchParams.get('city') || undefined;
      if (!q) return NextResponse.json({ error: 'query is required' }, { status: 400, headers });
      const res = await searchLivePlaces(q, city);
      return NextResponse.json(res, { headers });
    }

    case 'hotels': {
      const city = searchParams.get('city') || '';
      if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400, headers });
      const res = await searchHotels({
        city,
        checkIn: searchParams.get('checkIn') || new Date().toISOString().split('T')[0],
        checkOut: searchParams.get('checkOut') || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        guests: Number(searchParams.get('guests') || 2),
      });
      return NextResponse.json(res, { headers });
    }

    case 'flights': {
      const origin = searchParams.get('origin') || '';
      const destination = searchParams.get('destination') || '';
      if (!origin || !destination) {
        return NextResponse.json({ error: 'origin and destination are required' }, { status: 400, headers });
      }
      const res = await searchFlights({
        origin,
        destination,
        departureDate: searchParams.get('departureDate') || new Date().toISOString().split('T')[0],
        passengers: Number(searchParams.get('passengers') || 1),
      });
      return NextResponse.json(res, { headers });
    }

    case 'weather': {
      const city = searchParams.get('city') || 'Manali';
      const res = await getWeatherForLocation(city);
      return NextResponse.json(res, { headers });
    }

    case 'currency': {
      const amount = Number(searchParams.get('amount') || 100);
      const from = searchParams.get('from') || 'USD';
      const to = searchParams.get('to') || 'INR';
      const res = await getCurrencyRate(amount, from, to);
      return NextResponse.json(res, { headers });
    }

    case 'route': {
      const origin = searchParams.get('origin') || '';
      const destination = searchParams.get('destination') || '';
      if (!origin || !destination) {
        return NextResponse.json({ error: 'origin and destination are required' }, { status: 400, headers });
      }
      const res = await calculateRouteInfo(origin, destination);
      return NextResponse.json(res, { headers });
    }

    default:
      return NextResponse.json(
        { error: 'Supported types: places, hotels, flights, weather, currency, route, photo' },
        { status: 400, headers }
      );
  }
}

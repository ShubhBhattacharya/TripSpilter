import { NextResponse } from 'next/server';
import {
  searchLivePlaces,
  searchHotels,
  searchFlights,
  getWeatherForLocation,
  getCurrencyRate,
  calculateRouteInfo,
} from '../../../lib/providers/travel-providers';
import { checkRateLimit, getClientIdentifier, applyRateLimitHeaders } from '../../../lib/rate-limit';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';

  const rateLimit = await checkRateLimit(getClientIdentifier('travel_data', request), 60, 60000);
  const headers = new Headers();
  applyRateLimitHeaders(headers, rateLimit);
  if (!rateLimit.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers });
  }

  switch (type) {
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
        { error: 'Supported types: places, hotels, flights, weather, currency, route' },
        { status: 400, headers }
      );
  }
}

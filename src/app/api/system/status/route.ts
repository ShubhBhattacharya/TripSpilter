import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerIntegrationStatus } from '../../../../lib/config/env';

export const runtime = 'nodejs';

function tokensMatchConstantTime(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const expectedToken = process.env.SYSTEM_STATUS_TOKEN?.trim();
    const providedToken = request.headers.get('x-admin-token');
    if (!tokensMatchConstantTime(providedToken, expectedToken)) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
  }

  const raw = getServerIntegrationStatus();
  return NextResponse.json({
    supabase: Boolean(raw.supabase),
    supabaseServiceRole: Boolean(raw.supabaseServiceRole),
    phoneOtpEnabled: Boolean(raw.phoneOtpEnabled),
    openai: Boolean(raw.openai),
    gemini: Boolean(raw.gemini),
    googleMapsPlaces: Boolean(raw.googleMapsPlaces),
    unsplashImages: Boolean(raw.unsplashImages),
    hotelProvider: Boolean(raw.hotelProvider),
    flightProvider: Boolean(raw.flightProvider),
    activitiesProvider: Boolean(raw.activitiesProvider),
    weatherProvider: raw.weatherProvider === 'commercial_key',
    currencyProvider: raw.currencyProvider === 'commercial_key',
    paymentGateway: Boolean(raw.paymentGateway),
    redisRateLimit: Boolean(raw.redisRateLimit),
  });
}

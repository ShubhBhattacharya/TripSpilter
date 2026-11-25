import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { calculatePercentageSplit, toPaise } from '../src/lib/financial/split-engine';
import { verifyWebhookSignature, createServerPaymentOrder } from '../src/lib/payments/gateway';
import {
  searchHotels,
  searchFlights,
  searchLivePlaces,
} from '../src/lib/providers/travel-providers';
import { executeAiTool } from '../src/lib/ai/tools';
import { invokeCentralAICompanion } from '../src/lib/ai/provider';
import { getServerIntegrationStatus, isValidSupabaseConfig } from '../src/lib/config/env';
import { POST as explainPost } from '../src/app/api/guide/explain/route';
import { POST as ttsPost } from '../src/app/api/guide/tts/route';
import { GET as travelGet } from '../src/app/api/travel/route';
import { POST as webhookPost } from '../src/app/api/payments/webhook/route';
import { GET as authCallbackGet } from '../src/app/auth/callback/route';
import {
  PORTAL_NAV_CATEGORIES,
  PLATFORM_OFFERS,
  HANDPICKED_COLLECTIONS,
  resolveCollectionDestinations,
  getDestinationById,
} from '../src/data/travelCatalog';
import {
  COUNTRY_CODES,
  validateMobileNumber,
  validateEmailAddress,
  evaluatePasswordStrength,
  sanitizeNextRedirect,
} from '../src/lib/auth/validation';

describe('Phase 5: Percentage Split Engine Invariants', () => {
  it('distributes odd paise remainders cleanly across members to equal total exactly', () => {
    const res = calculatePercentageSplit({
      totalAmount: 1000,
      percentages: [
        { memberId: 'u1', percent: 33.33 },
        { memberId: 'u2', percent: 33.33 },
        { memberId: 'u3', percent: 33.34 },
      ],
    });
    expect(res.isValid).toBe(true);
    const totalPaise = res.shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(totalPaise).toBe(toPaise(1000));
  });

  it('rejects percentages not summing to 100%', () => {
    const res = calculatePercentageSplit({
      totalAmount: 500,
      percentages: [
        { memberId: 'u1', percent: 50 },
        { memberId: 'u2', percent: 30 },
      ],
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('80.00%');
  });
});

describe('Phase 6: Payment Gateway Order & Webhook Security', () => {
  it('discloses WAITING FOR PAYMENT PROVIDER CREDENTIALS when gateway keys absent', async () => {
    const res = await createServerPaymentOrder({
      amountPaise: 120000,
      currency: 'INR',
      receiptRef: 'ts_test_001',
    });
    expect(res.configured).toBe(false);
    expect(res.status).toBe('waiting_for_credentials');
    expect(res.providerOrderId).toBeNull();
  });

  it('accepts valid HMAC-SHA256 webhook signature and rejects tampered payloads', () => {
    const secret = 'test_webhook_secret_key_123';
    const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_1' });
    const validSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    expect(verifyWebhookSignature(rawBody, validSig, secret)).toBe(true);
    expect(verifyWebhookSignature(rawBody, 'invalid_hex_signature', secret)).toBe(false);
    expect(verifyWebhookSignature(rawBody + ' ', validSig, secret)).toBe(false);
    expect(verifyWebhookSignature(rawBody, null, secret)).toBe(false);
  });
});

describe('Phase 8: Live Travel API Adapters (Zero Fabricated Rates)', () => {
  it('searchHotels reports waiting_for_credentials rather than inventing prices', async () => {
    const res = await searchHotels({
      city: 'Manali',
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      guests: 2,
    });
    expect(res.status).toBe('waiting_for_credentials');
    expect(res.missingCredential).toBe('HOTEL_PROVIDER_API_KEY');
    expect(res.data).toBeNull();
  });

  it('searchFlights reports waiting_for_credentials rather than inventing airfares', async () => {
    const res = await searchFlights({
      origin: 'DEL',
      destination: 'GOI',
      departureDate: '2026-12-15',
      passengers: 2,
    });
    expect(res.status).toBe('waiting_for_credentials');
    expect(res.data).toBeNull();
  });

  it('searchLivePlaces reports waiting_for_credentials when GOOGLE_MAPS_API_KEY is unset', async () => {
    const res = await searchLivePlaces('Hadimba Temple', 'Manali');
    expect(res.status).toBe('waiting_for_credentials');
    expect(res.missingCredential).toBe('GOOGLE_MAPS_API_KEY');
  });
});

describe('Phase 7: Central AI Companion & Controlled Tool Security', () => {
  it('discloses missing AI credentials clearly when unconfigured', async () => {
    const reply = await invokeCentralAICompanion(
      { messages: [{ role: 'user', content: 'Plan a 3-day trip to Manali' }], language: 'en' },
      { userId: null, supabase: null }
    );
    expect(reply.provider).toBe('unconfigured');
    expect(reply.missingCredentials).toEqual(['OPENAI_API_KEY', 'GEMINI_API_KEY']);
  }, 15000);

  it('searches destination catalog deterministically without hallucinating', async () => {
    const res = await executeAiTool(
      'search_destinations',
      { query: 'Manali' },
      { userId: null, supabase: null }
    );
    expect(res.ok).toBe(true);
    const list = res.data as Array<{ id: string; name: string }>;
    expect(list.some((d) => d.id === 'manali')).toBe(true);
  });

  it('enforces explicit user approval on mutation drafts', async () => {
    const res = await executeAiTool(
      'create_trip_draft',
      { title: 'Manali Winter', destination: 'Manali', budget: 15000 },
      { userId: 'usr-123', supabase: null }
    );
    expect(res.ok).toBe(true);
    expect(res.requiresConfirmation?.actionType).toBe('CREATE_TRIP');
  });

  it('blocks unauthenticated DB tool access and rejects non-whitelisted tools', async () => {
    const unauth = await executeAiTool('get_user_trips', {}, { userId: null, supabase: null });
    expect(unauth.ok).toBe(false);
    expect(unauth.error).toContain('Authentication required');

    const badTool = await executeAiTool(
      'execute_raw_sql',
      { query: 'DROP TABLE trips;' },
      { userId: 'usr-123', supabase: null }
    );
    expect(badTool.ok).toBe(false);
    expect(badTool.error).toContain('not permitted');
  });
});

describe('Phase 13: Environment Status Inventory & API Security Route Tests', () => {
  it('returns strictly boolean/provider enum readiness without leaking secret strings', () => {
    const status = getServerIntegrationStatus();
    expect(typeof status.supabase).toBe('boolean');
    expect(typeof status.paymentGateway).toBe('boolean');
    expect(isValidSupabaseConfig()).toBe(false);
    expect(JSON.stringify(status)).not.toContain('placeholder');
  });

  it('guide explain route generates Wikipedia-grounded Hindi explanation and includes rate-limit headers', async () => {
    const req = new Request('http://localhost:3000/api/guide/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({
        cityId: 'manali',
        cityName: 'Manali, Himachal Pradesh',
        state: 'Himachal Pradesh',
        spotName: 'Hadimba Devi Temple',
        language: 'hi',
      }),
    });
    const res = await explainPost(req as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy();
    const json = await res.json();
    expect(json.language).toBe('hi');
    expect(typeof json.explanation).toBe('string');
    expect(json.explanation).toContain('Hadimba Devi Temple');
  }, 15000);

  it('guide TTS route returns clean browser fallback status and rate-limit headers when OpenAI key absent', async () => {
    const req = new Request('http://localhost:3000/api/guide/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.11' },
      body: JSON.stringify({ text: 'Welcome to Manali', language: 'en' }),
    });
    const res = await ttsPost(req as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy();
    const json = await res.json();
    expect(json.configured).toBe(false);
    expect(json.provider).toBe('browser-speech-synthesis');
  });

  it('travel API rejects SSRF / invalid photoName format and rejects missing credentials honestly', async () => {
    const badPhotoReq = new Request('http://localhost:3000/api/travel?type=photo&photoName=http://169.254.169.254/latest/meta-data');
    const badRes = await travelGet(badPhotoReq);
    expect(badRes.status).toBe(400);

    const hotelsReq = new Request('http://localhost:3000/api/travel?type=hotels&city=Jaipur');
    const hotelsRes = await travelGet(hotelsReq);
    expect(hotelsRes.status).toBe(200);
    const hotelsJson = await hotelsRes.json();
    expect(hotelsJson.status).toBe('waiting_for_credentials');
    expect(hotelsJson.data).toBeNull();
  });

  it('payment webhook fails closed when webhook secret is unconfigured', async () => {
    const req = new Request('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
      body: JSON.stringify({ event: 'payment.captured' }),
    });
    const res = await webhookPost(req);
    expect(res.status).toBe(503);
  });
});

describe('Phase 14: All-in-One AI Travel Agent Tools, Safety & Cards', () => {
  it('generate_trip_plan produces catalog itinerary card without inventing hotel/flight rates', async () => {
    const res = await executeAiTool(
      'generate_trip_plan',
      { destination: 'Manali', days: 3, travelers: 2, language: 'en' },
      { userId: null, supabase: null }
    );
    expect(res.ok).toBe(true);
    expect(res.card?.type).toBe('itinerary');
    if (res.card?.type === 'itinerary') {
      expect(res.card.destinationId).toBe('manali');
      expect(res.card.schedule).toHaveLength(3);
      expect(res.card.budgetEstimateInr).toBeGreaterThan(0);
    }
  });

  it('search_transit_links returns redirect-only external links and get_travel_safety returns official Indian helplines', async () => {
    const transit = await executeAiTool(
      'search_transit_links',
      { origin: 'Delhi', destination: 'Jaipur' },
      { userId: null, supabase: null }
    );
    expect(transit.ok).toBe(true);
    expect(transit.card?.type).toBe('provider_status');

    const safety = await executeAiTool(
      'get_travel_safety',
      { language: 'en' },
      { userId: null, supabase: null }
    );
    expect(safety.ok).toBe(true);
    expect(safety.card?.type).toBe('safety');
    if (safety.card?.type === 'safety') {
      expect(safety.card.helplines.some((h) => h.number === '112')).toBe(true);
      expect(safety.card.helplines.some((h) => h.number === '1363')).toBe(true);
    }
  });

  it('enforces authentication on get_user_bookings and mutation drafts', async () => {
    const anonBookings = await executeAiTool('get_user_bookings', {}, { userId: null, supabase: null });
    expect(anonBookings.ok).toBe(false);
    expect(anonBookings.error).toContain('Authentication required');

    const draftBooking = await executeAiTool(
      'create_booking_draft',
      { tripId: 'trip-1', title: 'Snow Resort', category: 'Hotel', amount: 4500 },
      { userId: 'usr-123', supabase: null }
    );
    expect(draftBooking.ok).toBe(true);
    expect(draftBooking.requiresConfirmation?.actionType).toBe('CREATE_BOOKING_DRAFT');

    const draftSettlement = await executeAiTool(
      'create_settlement_draft',
      { tripId: 'trip-1', toUserId: 'usr-456', amount: 1200 },
      { userId: 'usr-123', supabase: null }
    );
    expect(draftSettlement.ok).toBe(true);
    expect(draftSettlement.requiresConfirmation?.actionType).toBe('CREATE_SETTLEMENT_PROPOSAL');
  });

  it('invokeCentralAICompanion returns deterministic itinerary card & protects paid LLM in guest mode', async () => {
    const planReply = await invokeCentralAICompanion(
      { messages: [{ role: 'user', content: 'Plan a 3-day trip to Manali' }], language: 'en' },
      { userId: null, supabase: null }
    );
    expect(planReply.provider).toBe('unconfigured');
    expect(planReply.missingCredentials).toEqual(['OPENAI_API_KEY', 'GEMINI_API_KEY']);
    expect(planReply.structuredCards.some((c) => c.type === 'itinerary')).toBe(true);

    const guestReply = await invokeCentralAICompanion(
      {
        messages: [{ role: 'user', content: 'Convert 100 USD to INR' }],
        language: 'en',
        allowPaidLlm: false,
      },
      { userId: null, supabase: null }
    );
    expect(guestReply.model).toBe('guest-deterministic');
    expect(guestReply.missingCredentials).toEqual([]);
  }, 15000);
});

describe('Phase 15: Split-Screen Auth Validation & Redirect Security', () => {
  it('defaults country list to India (+91) and validates E.164 mobile rules strictly', () => {
    expect(COUNTRY_CODES[0].code).toBe('+91');

    const validIn = validateMobileNumber('+91', '98765 43210');
    expect(validIn.valid).toBe(true);
    expect(validIn.e164).toBe('+919876543210');

    const invalidPrefix = validateMobileNumber('+91', '1234567890');
    expect(invalidPrefix.valid).toBe(false);

    const tooShort = validateMobileNumber('+91', '98765');
    expect(tooShort.valid).toBe(false);

    const validUs = validateMobileNumber('+1', '4155551234');
    expect(validUs.valid).toBe(true);
    expect(validUs.e164).toBe('+14155551234');
  });

  it('validates email normalization, password strength, and open-redirect sanitization', () => {
    expect(validateEmailAddress('  Team@TripSplit.IN ').normalized).toBe('team@tripsplit.in');
    expect(validateEmailAddress('bad-email').valid).toBe(false);

    expect(evaluatePasswordStrength('Pass@123').score).toBe(3);
    expect(evaluatePasswordStrength('abc').score).toBe(0);

    expect(sanitizeNextRedirect('/trips/abc-123')).toBe('/trips/abc-123');
    expect(sanitizeNextRedirect('https://evil.example/phish')).toBe('/');
    expect(sanitizeNextRedirect('//evil.example')).toBe('/');
    expect(sanitizeNextRedirect('javascript:alert(1)')).toBe('/');
  });

  it('GET /auth/callback safely redirects invalid or unconfigured auth requests instead of throwing 500', async () => {
    const req = new Request('http://localhost:3000/auth/callback');
    const res = await authCallbackGet(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?error=invalid-auth-request');
  });
});

describe('Phase 16: Travel Portal Catalog Integrity & Destination Resolution', () => {
  it('defines booking categories and avoids fabricated coupon codes or fake bank partnerships', () => {
    expect(PORTAL_NAV_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    expect(PORTAL_NAV_CATEGORIES.some((c) => c.id === 'insurance' && !c.searchSupported)).toBe(true);
    for (const offer of PLATFORM_OFFERS) {
      expect(offer.title.toLowerCase()).not.toContain('hdfc');
      expect(offer.title.toLowerCase()).not.toContain('icici');
      expect(offer.description).not.toMatch(/CODE:/i);
    }
  });

  it('resolves handpicked collections and individual destinations across all 60 cities cleanly', () => {
    for (const col of HANDPICKED_COLLECTIONS) {
      const list = resolveCollectionDestinations(col.destinationIds);
      expect(list.length).toBeGreaterThanOrEqual(4);
    }
    const manali = getDestinationById('manali');
    expect(manali?.name).toContain('Manali');
    expect(manali?.spots).toHaveLength(4);
    expect(getDestinationById('nonexistent-city-slug')).toBeUndefined();
  });
});

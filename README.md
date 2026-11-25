# TripSplit — Collaborative Trip Planner, Direct-to-Vendor UPI Splitter & 3D AI Guide

TripSplit is a Next.js 16 + TypeScript + Supabase + PostgreSQL travel-tech platform combining group expense management, deterministic paise-accurate bill splitting, UPI QR payment intents, verified gateway webhook architecture, 360° destination discovery, a bilingual Hindi/English voice tour guide, and an AI Travel Companion.

---

## Key Capabilities

1. **Full-Screen 3D Experience & Destination Discovery (`/3d-experience`)**
   - Full-viewport responsive destination discovery across 60 Indian destinations (`All | North | South | East | West | Central | Northeast`), text + autocomplete + Hindi/English/Hinglish voice search.
   - Destination intro cards + 360° monument viewer paired with an animated 3D travel guide character and bilingual Hindi/English speech synthesis (`Play`, `Pause`, `Resume`, `Stop`, `Replay`, `Mute`, follow-up Q&A).
2. **Global Floating AI Travel Agent & Workspace (`FloatingAiAssistant`, `/ai-assistant`, `/api/ai/chat`)**
   - Always-accessible bottom-right cosmic AI orb mounted in `src/app/layout.tsx` across all pages (including `/3d-experience`, `/explore`, `/trips`, `/qr-split`, `/profile`) with expandable drawer / full-screen modes, Hindi/English/Hinglish voice input (`SpeechRecognition`) and TTS playback, receipt image OCR upload, conversation history & search, stop/regenerate/copy actions, and interactive structured cards (itineraries, weather, currency FX, destinations, emergency helplines, external transit links, honest credential disclosures, and explicit approval confirmations via `/api/ai/confirm-action`).
   - Supports OpenAI GPT-4o-mini + Google Gemini tool calling with automatic fallback, plus deterministic catalog/public-adapter execution when AI keys are absent.
3. **Expense Engine & Settlements (`/trips`, `/trips/[id]`, `/qr-split`)**
   - Deterministic integer-paise arithmetic (`src/lib/financial/split-engine.ts`) for Equal, Exact Custom, Percentage, and Itemized splits plus greedy minimum-transfer settlements (`/api/trips/[id]/settlements`).
4. **Live Travel Data Adapters (`/api/travel`)**
   - Modular adapters for Google Places API (New), Google Distance Matrix/Routes, Hotel/Flight suppliers, Weather, and FX conversion. Unconfigured suppliers explicitly return `waiting_for_credentials` and never display fabricated prices.
5. **Payment Gateway & Verified Webhook Architecture (`/api/payments/*`)**
   - Server-side order creation (`POST /api/payments/create-order`) reading authoritative amounts from PostgreSQL `expense_splits`, paired with HMAC-SHA256 webhook verification & duplicate replay protection (`POST /api/payments/webhook`).

---

## Environment Variables Setup

Copy `.env.example` to `.env.local` for local development (never commit `.env.local`).

### Mandatory for Persistent Accounts, Trips, Expenses & Auth
| Variable Name | Scope | Purpose | Where to Obtain |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public / Server | Supabase project API URL | Supabase Dashboard -> Project Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public / Server | Supabase anonymous public key (protected by RLS) | Supabase Dashboard -> Project Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Required ONLY for verified payment webhooks updating splits | Supabase Dashboard -> Project Settings -> API |

### Optional — Central AI Companion, Voice TTS & Receipt OCR
| Variable Name | Scope | Paid / Free Tier | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | Server-only | **Paid API** | Powers OpenAI GPT-4o-mini companion & optional HD `tts-1` audio |
| `GEMINI_API_KEY` | Server-only | Free tier / Pay-as-you-go | Powers Google Gemini companion & Receipt OCR (`/api/ocr/parse-receipt`) |
| `AI_PROVIDER` | Server-only | Config | Preferred AI provider: `auto`, `openai`, or `gemini` |
| `AI_MODEL` | Server-only | Config | Model identifier override (e.g., `gpt-4o-mini` or `gemini-2.0-flash`) |

### Optional — Live Travel Data Suppliers & Gateway Payments
| Variable Name | Scope | Paid / Partner Access | Purpose |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Server-only | **Paid Google Cloud Billing** (free monthly credit) | Live Google Places search, photos proxy, and driving routes |
| `HOTEL_PROVIDER_API_KEY` | Server-only | **Partner / Paid API** | Live hotel rates & availability (e.g. LiteAPI / Hotelbeds) |
| `FLIGHT_PROVIDER_API_KEY` | Server-only | **Partner / Paid API** | Live flight offers (Amadeus Self-Service) |
| `FLIGHT_PROVIDER_API_SECRET` | Server-only | **Partner / Paid API** | Amadeus OAuth2 secret |
| `WEATHER_PROVIDER_API_KEY` | Server-only | Optional commercial key | Commercial weather SLA (defaults to Open-Meteo non-commercial feed) |
| `CURRENCY_PROVIDER_API_KEY` | Server-only | Optional | Custom FX feed (defaults to indicative ECB Frankfurter API) |
| `PAYMENT_PROVIDER_API_KEY` | Server-only | **KYC / Gateway Account** | Razorpay Key ID for checkout orders |
| `PAYMENT_PROVIDER_API_SECRET` | Server-only | **KYC / Gateway Account** | Razorpay Key Secret |
| `PAYMENT_PROVIDER_WEBHOOK_SECRET` | Server-only | **KYC / Gateway Account** | HMAC-SHA256 webhook verification secret |
| `UPSTASH_REDIS_REST_URL` | Server-only | Free / Paid Redis | Distributed API rate limiting across serverless instances |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only | Free / Paid Redis | Upstash REST auth token |
| `NEXT_PUBLIC_DEMO_MODE` | Public | Config | Set `true` only if enabling demo sample trips without Supabase |

---

## Supabase Database Setup

Apply the additive SQL migrations in `supabase/migrations/` in exact chronological order via the Supabase SQL Editor or Supabase CLI (`supabase db push`):

1. `supabase/migrations/20261121_complete_schema.sql` — Core 16 tables, indexes, and RLS activation
2. `supabase/migrations/20261122_security_hardening.sql` — Base RLS policies
3. `supabase/migrations/20261122_final_backend_hardening.sql` — Idempotency table & atomic `create_expense_with_splits` RPC
4. `supabase/migrations/20261125_ai_payments_bookings_hardening.sql` — User preferences, private AI conversations/messages, receipt uploads, booking status tracking, and payment webhook deduplication tables

Enable **Email/Password** and **Google OAuth** under **Supabase Authentication -> Providers**, and add `<your-domain>/auth/callback` to **Redirect URLs**.

---

## Local Development & Verification Commands

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Type checking, ESLint, unit/security tests & production build
npx tsc --noEmit
npm run lint
npm test
npm run build --webpack
```

### Deployment Procedure (Controlled Rollout)
1. Validate all changes on a feature branch with `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build --webpack`.
2. Deploy to a Vercel Preview environment first and verify `/api/system/status` reports expected configured integrations.
3. Apply pending non-destructive SQL migrations on Supabase before merging PRs to `main`.

### Known Limitations
- Without `HOTEL_PROVIDER_API_KEY` and `FLIGHT_PROVIDER_API_KEY`, hotel/flight search endpoints return `waiting_for_credentials` and redirect/draft workflows clearly show `Continue to provider to book`.
- Without `PAYMENT_PROVIDER_*` keys, direct UPI links initiate local bank apps (`upi://pay`) while settlement confirmation remains explicitly labeled as pending gateway verification.
- Default weather (`Open-Meteo`) and currency (`Frankfurter`) feeds use indicative public APIs until commercial keys are configured.

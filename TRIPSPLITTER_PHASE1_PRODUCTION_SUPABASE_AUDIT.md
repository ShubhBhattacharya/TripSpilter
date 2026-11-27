# TripSplitter — Phase 1: Production & Supabase Verification Audit

**Repository:** `https://github.com/ShubhBhattacharya/TripSpilter`  
**Production URL:** `https://tripsplitter-delta.vercel.app/`  
**Vercel Project:** `trip_splitter`  
**Audit Date:** `2026-11-27`  
**Audit Scope:** Strict read-only verification (`AUDIT ONLY` — zero source code, schema, RLS, or production env mutations).  

---

## Summary Status Matrix

| Audit Domain | Status | Summary |
| --- | --- | --- |
| 1. GitHub `main` vs Live Vercel Production Sync | **VERIFIED PASS** | Live production (`tripsplitter-delta.vercel.app`) serves compiled client JS strings unique to latest `main` commit `66ee595`. |
| 1b. GitHub Deployments API / Vercel Commit Metadata | **BLOCKED** | GitHub Deployments API returns `0` deployments; `vercel` CLI is absent from PATH, so exact Vercel internal deployment ID/branch linkage metadata could not be queried directly. |
| 2. Production Vercel → Supabase Runtime Connection | **FAIL** | Production `GET /api/system/status` returns `supabase: false` and `supabaseServiceRole: false`. All DB-backed routes operate strictly in unconfigured/demo fallback mode. |
| 2b. Supabase MCP SQL / Postgres Auth (`28P01`) | **FAIL / BLOCKED** | Hosted project `ycfasggikwwmxejhgawf` is `ACTIVE_HEALTHY` (`Auth /settings` = HTTP `200`), but MCP SQL endpoints (`list_migrations`, `list_tables`, `list_extensions`) fail with `FATAL: 28P01: password authentication failed` for `postgres` and `supabase_read_only_user`. |
| 3. Live Postgres Schema & Migrations Applied | **FAIL (PostgREST PGRST205)** | Read-only PostgREST `anon` probes against `profiles`, `trips`, `expenses`, `bookings`, `payment_refunds`, and `booking_webhook_events` all return HTTP `404` (`PGRST205: Could not find the table ... in the schema cache`). None of the core application tables exist in `public`. |
| 3b. Migration Lexicographical Ordering Integrity | **FAIL (CRITICAL MIGRATION BUG)** | Running `supabase/migrations/` in alphabetical filename order (`supabase db push`) crashes at 3 distinct points due to same-day naming collisions (`20261122_f*` < `s*`, `20261126_9*` < `m*`, `20261127_d*` < `s*`). |
| 4. Authentication & Real DB Persistence (Production) | **FAIL (Mock / Demo Fallback Active)** | Unauthenticated `GET /trips`, `/profile`, `/qr-split` return HTTP `200` without login redirect (`middleware.ts` bypasses when Supabase env missing). Auth UI defaults to `localStorage`/`sessionStorage` preview mode; DB writes fail closed or simulate demo state. |
| 5. Security Controls & Service Role Separation | **VERIFIED PASS (Codebase)** | `SUPABASE_SERVICE_ROLE_KEY` is restricted exclusively to 3 server routes + `env.ts` browser throw guard; security headers active live; RLS policies cover all 16 SQL tables (unapplied on live DB). |
| 6. Local Read-Only Automated Verification (`main` @ `66ee595`) | **VERIFIED PASS** | `tsc --noEmit` (`0`), `eslint` (`0`), and Vitest (**9 files, `118/118` tests passed** under mocked DB/gateway). Live DB write/RLS E2E: **BLOCKED**. |

---

## 1. GitHub & Vercel Verification

- **Latest Commit on `origin/main`:** `66ee595a140e68a76442e801e00dd470b17c74bf` (`chore(release-audit): harden payment webhook currency, idempotency, AI quota, UUID validation, UI persistence & add final market-readiness report`, committed `2026-11-27T03:31:24Z`).
- **GitHub Actions CI (`main`):** Workflow run [`45934912080`](https://github.com/ShubhBhattacharya/TripSpilter/actions/runs/45934912080) on `66ee595` — **`completed` / `success`**.
- **Is `66ee595` Actually Live on `https://tripsplitter-delta.vercel.app/`?** — **VERIFIED PASS**
  - Inspecting the compiled client JS chunks served from live `/notifications` and `/profile` confirmed presence of BOTH strings introduced strictly in commit `66ee595`:
    - `found66ee595ProfileKey: true` (`"tripsplit_user_permissions"` in profile JS chunk)
    - `found66ee595NotifClearRead: true` (`"Clear read"` in notifications JS chunk)
  - Live response headers confirmed Vercel edge serving (`server: Vercel`, `x-vercel-id: bom1::iad1::...`, `x-frame-options: DENY`, `strict-transport-security: max-age=63072000; includeSubDomains; preload`).
- **Readiness Report Metadata Mismatch Investigation:**
  - `TRIPSPLITTER_FINAL_MARKET_READINESS_REPORT.md` Section 18 (written on the feature branch prior to merging) recorded `main` as `2e99a7bdcee02f52a5a0426dd4b1e2a30777a287` (`UNCHANGED`). Following explicit owner instruction, `66ee595` was subsequently fast-forward merged into `main`, so Section 18 reflects the pre-merge snapshot while live Vercel auto-deployed `66ee595`.
- **Direct Vercel Metadata Check:** **BLOCKED** — GitHub Deployments API returned `githubDeploymentsCount: 0`, and `vercel` CLI / Vercel API tokens are not present in this audit environment.

---

## 2. Supabase Connection Audit

- **Local Env Inventory (Key Names Only — Zero Values Read/Exposed):**
  - `.env` / `.env.local`: **Not present** in workspace root.
  - `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PHONE_ENABLED`, `SUPABASE_SERVICE_ROLE_KEY`, plus AI/Maps/Unsplash/Travel/Payment/Redis/Demo vars.
  - `.env.local.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_DEMO_MODE`.
- **Live Vercel Production Env Status (`GET https://tripsplitter-delta.vercel.app/api/system/status`):** **FAIL (Unconfigured)**
  - `supabase: false` (valid `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` absent or still set to placeholder strings checked by `src/lib/config/env.ts`).
  - `supabaseServiceRole: false` (`SUPABASE_SERVICE_ROLE_KEY` absent/placeholder).
  - `phoneOtpEnabled: false`, `openai: false`, `gemini: false`, `googleMapsPlaces: false`, `unsplashImages: false`, `hotelProvider: false`, `flightProvider: false`, `activitiesProvider: false`, `paymentGateway: false`, `redisRateLimit: false`.
  - Active free adapters: `weatherProvider: "open_meteo_free_non_commercial"`, `currencyProvider: "frankfurter_ecb_indicative"`.
- **Hosted Supabase Project Health (`ycfasggikwwmxejhgawf`):**
  - Management metadata (`get_project`, `get_project_url`, `get_publishable_keys`): **VERIFIED PASS** — Project `"ShubhBhattacharya's Project"`, region `ap-south-1`, `status: ACTIVE_HEALTHY`, Postgres `17.6.1.166`, URL `https://ycfasggikwwmxejhgawf.supabase.co`, active `anon` and `publishable` keys (`disabled: false`).
  - Auth Endpoint (`GET https://ycfasggikwwmxejhgawf.supabase.co/auth/v1/settings` with `apikey`): HTTP **`200`** (GoTrue reachable).
  - PostgREST Root (`GET /rest/v1/` with `anon` JWT): HTTP **`401`** (`"Only the service_role API key can be used for this endpoint."` — OpenAPI root introspection restricted to `service_role`).
- **Root Cause of Earlier `28P01` Database Error:** **FAIL / BLOCKED**
  - Direct SQL MCP calls (`list_migrations`, `list_tables`, `list_extensions`) fail inside Supabase MCP with `FATAL: 28P01: password authentication failed for user "postgres"` and `"supabase_read_only_user"`. Meanwhile `get_advisors` returned `"Project 56112464 is currently hibernated and will wake on next supported request"`, and log analytics tables (`postgres_logs`, `auth_logs`) returned `"Table does not exist"`.
  - This confirms a **Supabase MCP / Postgres role password desynchronization or hibernated pooler state** blocking direct SQL execution, **combined with missing Vercel env variables** preventing the Next.js app from connecting to `ycfasggikwwmxejhgawf` at runtime.

---

## 3. Database & Migrations Audit

### Live Schema Reality Check
- Read-only PostgREST `anon` table checks (`GET https://ycfasggikwwmxejhgawf.supabase.co/rest/v1/<table>?select=*&limit=1`) returned **HTTP `404` (`PGRST205`)** on every tested table:
  - `public.profiles` → `Could not find the table 'public.profiles' in the schema cache` (**FAIL — NOT APPLIED**)
  - `public.trips` → `Could not find the table 'public.trips' in the schema cache` (**FAIL — NOT APPLIED**)
  - `public.expenses` → `Could not find the table 'public.expenses' in the schema cache` (**FAIL — NOT APPLIED**)
  - `public.bookings` → `Could not find the table 'public.bookings' in the schema cache` (**FAIL — NOT APPLIED**)
  - `public.payment_refunds` → `Could not find the table 'public.payment_refunds' in the schema cache` (**FAIL — NOT APPLIED**)
  - `public.booking_webhook_events` → `Could not find the table 'public.booking_webhook_events' in the schema cache` (**FAIL — NOT APPLIED**)
- Exact `supabase_migrations.schema_migrations` row listing via SQL: **BLOCKED** (`28P01`), though PostgREST `PGRST205` independently proves **the application schema is not present in `public`**.

### Ordered Migration Checklist & Dependency Bugs Found

In strict alphabetical filename order (how Supabase CLI `supabase db push` executes migrations):

| # | Migration File (Alphabetical Order) | Intended Logical Order | Compatibility Finding |
| --- | --- | --- | --- |
| 1 | `20261121_complete_schema.sql` | **#1** | Creates 16 core tables + enables RLS; adds indexes & constraints. **OK.** |
| 2 | `20261122_final_backend_hardening.sql` | Should be **#3** | **BROKEN ORDER (`FAIL`):** References `is_trip_admin(trip_id)` on lines 50, 57, 67, 78, 94 **before** `20261122_security_hardening.sql` creates `is_trip_admin()`. Crashes on clean DB! |
| 3 | `20261122_security_hardening.sql` | Should be **#2** | Defines `is_trip_member()`, `is_trip_admin()`, hardens `handle_new_user()`, adds expense/split/settlement UPDATE RLS. (`trip_members` INSERT policy later fixed in Phase 8.) |
| 4 | `20261125_ai_payments_bookings_hardening.sql` | **#4** | Creates `user_preferences`, `ai_conversations`, `ai_messages`, `receipt_uploads`, `payment_orders`, `payment_webhook_events`. |
| 5 | `20261126_95_market_readiness_final.sql` | Should be **#6** | **BROKEN ORDER (`FAIL`):** Runs `ALTER TABLE public.payment_refunds` at line 39 (`'9'` sorts before `'m'`) **before** `20261126_market_readiness_hardening.sql` creates `payment_refunds`! Also creates `booking_status_history`. |
| 6 | `20261126_market_readiness_hardening.sql` | Should be **#5** | Creates `payment_refunds`, `ai_usage_logs`, `dispatch_trip_notification()`, and `notifications` RLS. |
| 7 | `20261127_day7_refund_webhook_hardening.sql` | Should be **#8** | **BROKEN ORDER (`FAIL`):** Executes `ALTER TABLE public.booking_webhook_events` at line 120 (`'d'` sorts before `'s'`) **before** `20261127_security_booking_webhook_remediation.sql` creates `booking_webhook_events`! Also revokes `finalize_payment_refund` from `PUBLIC, anon, authenticated`. |
| 8 | `20261127_phase8_complete_rls_and_webhook_hardening.sql` | **#9** | Fixes `trip_members` escalation policy, completes RLS across 16 tables, restricts `bookings` client statuses, defines `accept_trip_invitation`. |
| 9 | `20261127_phase9_audit_remediations.sql` | **#10** | Adds `trg_prevent_last_trip_admin_loss`, locks `bookings DELETE` to `Draft`/`Cancelled`/`Failed`, adds self-scoped `notifications INSERT`, updates `accept_trip_invitation`. |
| 10 | `20261127_security_booking_webhook_remediation.sql` | Should be **#7** | Creates `booking_webhook_events` and adds `booking_status_history` client source policy (`'s'` causes it to run after `day7`, `phase8`, `phase9`). |

---

## 4. Authentication & Persistence Verification (Production Read-Only Probes)

All checks distinguish **local browser fallback (`localStorage`/`sessionStorage`)** from **real Supabase persistence**:

| Workflow / Check | Observed Production Result (`tripsplitter-delta.vercel.app`) | Mode / Reality | Status |
| --- | --- | --- | --- |
| Signup / Login / Email / OAuth | `AuthExperience.tsx` checks `isSupabaseConfigured` (`false` in prod). Submitting login/signup creates a **localStorage preview object (`tripsplit_demo_user`)** via `signInAsDemo()`; no Supabase session exists. | Mock/Preview fallback only | **FAIL (No Live Auth Configured)** |
| Mobile SMS OTP Auth | Explicitly halted with notice: requires live Supabase Phone Auth + SMS provider. | Honest fail-closed UI disclosure | **BLOCKED** |
| Session Persistence & Logout | Driven locally by `tripsplit_demo_user` (`localStorage`) + `tripsplit_preview_signed_out` (`sessionStorage`), NOT Supabase JWT cookies. | Local browser state only | **FAIL (No Live Session Auth)** |
| Protected Routes (`/trips`, `/profile`, `/qr-split`) | Unauthenticated requests to `/trips`, `/profile`, `/qr-split` all return **HTTP `200`** (`location: null`), because `src/lib/supabase/middleware.ts:15` returns early without checking auth when Supabase env vars are missing. | Middleware auth enforcement bypassed when unconfigured | **FAIL (Unconfigured Env)** |
| Profile Persistence (`/profile`) | `AuthProvider.updateProfile()` mutates in-memory React state only when `!isSupabaseConfigured`; permissions toggles persist locally in `localStorage` (`tripsplit_user_permissions`); `/api/preferences` returns `{ configured: false, preferences: null }`. | Local browser / in-memory fallback | **FAIL (No Remote DB Persistence)** |
| Trip Creation & Retrieval (`/api/trips`) | `GET /api/trips` returns HTTP `200 { trips: [], isDemo: true, configured: false }`. `POST /api/trips` returns demo payload (`trip-${Date.now()}`) without DB write. | Mock / unconfigured | **FAIL (No Remote DB Persistence)** |
| Expense Persistence (`/api/expenses`) | `GET /api/expenses?tripId=test` returns HTTP `200 { message: "Demo mode expenses", expenses: [], isDemo: true }`. | Mock / unconfigured | **FAIL (No Remote DB Persistence)** |
| Bookings & Refunds (`/api/bookings`, `/api/payments/refund`) | `GET /api/bookings?tripId=test` returns `200 { bookings: [], configured: false }`. `GET /api/payments/refund` returns `200 { refunds: [], configured: false }`. | Unconfigured fail-closed | **BLOCKED** |
| Notifications Persistence (`/api/notifications`) | `GET /api/notifications` returns HTTP `200 { notifications: [], configured: false }`. | Unconfigured | **FAIL (No Remote DB Persistence)** |

---

## 5. Security Findings

1. **`SUPABASE_SERVICE_ROLE_KEY` Isolation:** **VERIFIED PASS (Codebase)** — Recursive scan of `src/` confirms `getServerServiceRoleKey()` is defined in `src/lib/config/env.ts` (explicitly throwing `'SECURITY VIOLATION'` if called in `window`) and imported **only** in `/api/bookings/webhook/route.ts`, `/api/payments/webhook/route.ts`, and `/api/payments/refund/route.ts`.
2. **`.gitignore` Secret Hygiene:** **VERIFIED PASS** — `.gitignore` ignores `.env*` while keeping `!.env.example` and `!.env*.example`; no `.env` secret files are tracked.
3. **Production Security Headers:** **VERIFIED PASS** — `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` are served live.
4. **API Auth Guards & Validation (`auth-guards.ts` / Zod):** **VERIFIED PASS (Codebase/Mocked Tests)** — All DB routes call `requireAuthenticatedUser`, `requireTripMembership`, `requireTripAdmin`, and Zod/UUID validation when `isSupabaseConfigured` is true.
5. **Production Fail-Closed Behavior vs Middleware Bypass:** **CRITICAL OPERATIONAL FINDING** — Because Supabase env vars are missing on Vercel production, `/trips`, `/profile`, and `/qr-split` bypass SSR route protection (serving client shell), and AI/trip/expense demo paths run locally, though server mutation routes (`/api/bookings/[id]`, `/api/payments/refund` `POST`, `/api/trips/[id]/members`, `/api/trips/invitations/accept`) properly fail closed with `503`.
6. **Live RLS Execution:** **BLOCKED** — Cannot test live Postgres RLS policies until tables exist and SQL/Supabase env credentials are configured.

---

## 6. Exact Blockers & Root Causes

1. **Blocker 1 — Unapplied Database Schema (`public.*` tables missing in Supabase `ycfasggikwwmxejhgawf`):**
   - *Evidence:* PostgREST returns `404 PGRST205` (`Could not find the table ...`) on `profiles`, `trips`, `expenses`, `bookings`, `payment_refunds`, `booking_webhook_events`.
   - *Root Cause:* Migrations in `supabase/migrations/` were never pushed/executed on Supabase project `ycfasggikwwmxejhgawf`.
2. **Blocker 2 — Broken Lexicographical Ordering in `supabase/migrations/`:**
   - *Evidence:* Three pairs of SQL migrations run out of dependency order when sorted alphabetically by filename (`20261122_final` before `security`; `20261126_95` before `market`; `20261127_day7` before `security_booking`).
   - *Root Cause:* Descriptive filenames under same-day date prefixes sort lexicographically rather than chronological dependency order.
3. **Blocker 3 — Supabase MCP / Postgres `28P01` Authentication Failure:**
   - *Evidence:* `list_migrations` (`postgres`) and `list_tables` (`supabase_read_only_user`) fail with `FATAL: 28P01: password authentication failed`; `get_advisors` notes project hibernation.
   - *Root Cause:* Supabase MCP Postgres credentials/role sync for `ycfasggikwwmxejhgawf` is stale/hibernated and requires project wake + DB password / MCP reconnection in Supabase Dashboard.
4. **Blocker 4 — Missing Supabase & Gateway Credentials in Vercel `trip_splitter` Production Env:**
   - *Evidence:* `https://tripsplitter-delta.vercel.app/api/system/status` reports `supabase: false`, `supabaseServiceRole: false`, `paymentGateway: false`, `hotelProvider: false`, `flightProvider: false`, `openai: false`, `gemini: false`, `redisRateLimit: false`.
   - *Root Cause:* Environment secrets have not been configured in Vercel Project Settings (`Production` / `Preview`) and triggered in a fresh deployment.

---

## 7. Automated Test Evidence (Read-Only on `main` @ `66ee595`)

Executed locally on unmodified `main` (`66ee595`):
- `npx tsc --noEmit`: **VERIFIED PASS** (exit `0`)
- `npm run lint`: **VERIFIED PASS** (exit `0`)
- `npm test` (`vitest run`): **VERIFIED PASS — 9 files, `118` tests passed, `0` failed, `0` skipped** (`tests/financial-split.test.ts` 13, `tests/upi-engine.test.ts` 7, `tests/backend-security.test.ts` 37, `tests/market-readiness.test.ts` 17, `tests/phase8-comprehensive.test.ts` 4, `tests/phase9-verification.test.ts` 4, `tests/security-regression.test.ts` 7, `tests/final-readiness.test.ts` 4, `tests/platform-backend.test.ts` 25). *Note: Database, RPC, and gateway HTTP calls in route unit tests are mocked (`vi.mock`); real Supabase persistence tests remain **BLOCKED**.*

---

## 8. Prioritized Remediation Plan (For Next Execution Phases)

1. **P0 — Fix Migration Filename Ordering Before Running `supabase db push`:**
   - Rename/re-timestamp migrations into an explicit monotonic sequence (e.g., `2026112101_*`, `2026112201_security_*`, `2026112202_final_*`, `2026112501_*`, `2026112601_market_*`, `2026112602_95_*`, `2026112701_security_booking_*`, `2026112702_day7_*`, `2026112703_phase8_*`, `2026112704_phase9_*`) OR add a verified idempotent bootstrap check, then test applying all 10 cleanly from scratch against an ephemeral/staging Postgres instance.
2. **P0 — Restore Supabase `ycfasggikwwmxejhgawf` DB Connection & Apply Migrations (With Owner Approval):**
   - Wake project / reset DB password & reconnect Supabase MCP in Supabase Dashboard so `28P01` clears; verify empty state, apply ordered migrations safely, and confirm all tables, indexes, triggers, `accept_trip_invitation`, `finalize_payment_refund`, and RLS policies exist in Postgres.
3. **P0 — Configure Vercel Preview/Production Environment Variables:**
   - Populate `NEXT_PUBLIC_SUPABASE_URL` (`https://ycfasggikwwmxejhgawf.supabase.co`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` in Vercel `trip_splitter` settings (plus Supabase Auth Redirect URLs for `tripsplitter-delta.vercel.app/auth/callback`), then redeploy cleanly.
4. **P1 — Execute Live Authenticated End-to-End & Cross-User RLS Tests:**
   - Verify real signup/login/logout, SSR cookie session persistence, `/trips`/`/profile`/`/qr-split` unauthenticated redirect enforcement, trip creation, invite redemption, expense/settlement persistence, and cross-user isolation against real Supabase.
5. **P1 — Provision Sandbox Payment, Supplier Webhook, AI & Redis Secrets:**
   - Configure Razorpay test keys, `BOOKING_WEBHOOK_SECRET_*`, `GEMINI_API_KEY`/`OPENAI_API_KEY`, and Upstash Redis, and run sandbox E2E checkout/refund/webhook verification.

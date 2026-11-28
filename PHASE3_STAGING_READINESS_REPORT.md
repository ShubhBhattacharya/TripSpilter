# TripSplitter — Phase 3: Safe Supabase Staging Identification & Live Integration Preparation Report

**Repository:** `https://github.com/ShubhBhattacharya/TripSpilter`  
**Phase 3 Working Branch:** `feature/phase3-staging-preparation` *(branched from `origin/feature/phase2-supabase-recovery` at `be9a598`)*  
**Main Branch (`main` — Untouched):** `8f60cda`  
**Production URL (`https://tripsplitter-delta.vercel.app/` — Untouched):** Live runtime returns `"supabase": false`  
**Preview URL (`https://tripsplitter-9qi9eug2m-shubhdgi12-8206s-projects.vercel.app/`):** Protected behind Vercel Authentication SSO (`200` login gate HTML)  
**Target Supabase Ref Under Investigation:** `ycfasggikwwmxejhgawf`  
**Classification Labels Used:** `VERIFIED` | `BLOCKED` | `NOT VERIFIED` | `REQUIRES OWNER APPROVAL`

---

## 1. Executive Summary & Database Safety Decision

- **Supabase Project `ycfasggikwwmxejhgawf` Environment Classification:** **`UNKNOWN`**
- **Database Modification Policy Applied:** **ALL schema changes, migrations, resets, and writes STOPPED (`BLOCKED` / `REQUIRES OWNER APPROVAL`).** Zero SQL mutations, zero migrations, and zero environment variable changes were executed against `ycfasggikwwmxejhgawf`, Vercel Production, Vercel Preview, or `main`.
- **Safe Code-Only Improvements Added on `feature/phase3-staging-preparation`:**
  1. Hardened [src/app/api/trips/route.ts](src/app/api/trips/route.ts) (`POST`), [src/app/api/expenses/route.ts](src/app/api/expenses/route.ts) (`GET`, `POST`), and [src/app/api/expenses/splits/[id]/route.ts](src/app/api/expenses/splits/%5Bid%5D/route.ts) (`PATCH`) to fail closed with `HTTP 503` when `!isSupabaseConfigured` and `NEXT_PUBLIC_DEMO_MODE !== 'true'`, eliminating silent fake `200`/`201` `"demo mode"` success responses.
  2. Created reproducible 10-step live staging E2E harness [scripts/live-staging-e2e.mjs](scripts/live-staging-e2e.mjs) with explicit preflight safety guards blocking accidental production or `UNKNOWN` project mutation.
  3. Added automated regression coverage in [tests/phase3-staging-preparation.test.ts](tests/phase3-staging-preparation.test.ts).

---

## 2. Verified Facts vs Unknowns

### Verified Facts (`VERIFIED`)
1. **Git State (`VERIFIED`):**
   - `origin/main` HEAD: `8f60cda` (`docs(audit): add Phase 1 production and Supabase verification audit report`).
   - `origin/feature/phase2-supabase-recovery` HEAD: `be9a598` (`feat(phase2): reorder baseline migrations, fail-close middleware & auth, fix client DB error handling & add recovery suite`).
   - Note: A separate unmerged branch `origin/fix/remaining-readiness` (`2732cf9`) also exists off `main`.
2. **Next.js 16 Auth Middleware & Client Config (`VERIFIED`):**
   - Request interception lives in [src/proxy.ts](src/proxy.ts) invoking `updateSession` from [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts) (`src/middleware.ts` does not exist because Next.js 16 uses Proxy convention).
   - `PROTECTED_PREFIXES` (`/trips`, `/qr-split`, `/profile`, `/settings`) fail closed with `307 -> /login?error=supabase-unconfigured&redirectTo=...` when `isValidSupabaseConfig()` is false.
   - Browser/server clients ([src/lib/supabase/client.ts](src/lib/supabase/client.ts), [src/lib/supabase/server.ts](src/lib/supabase/server.ts)) validate URLs/keys via placeholder checks, and `getServerServiceRoleKey()` in [src/lib/config/env.ts](src/lib/config/env.ts) throws in browser context.
3. **Production Runtime Check (`VERIFIED`):**
   - `GET https://tripsplitter-delta.vercel.app/api/system/status` returned `HTTP 200` with `"supabase": false`, `"supabaseServiceRole": false`, `"paymentGateway": false`.
4. **Migration Ordering on `feature/phase2-supabase-recovery` (`VERIFIED`):**
   - All 10 re-timestamped SQL files (`20261121000001` through `20261127000004`) pass static dependency ordering across all 27 public tables and enable RLS on 27/27 tables.

### Unknowns (`NOT VERIFIED` / `UNKNOWN`)
1. **Intended Ownership/Usage of `ycfasggikwwmxejhgawf` (`UNKNOWN`):** Cannot be proven whether owner intends `ycfasggikwwmxejhgawf` (`"ShubhBhattacharya's Project"`, created `2026-09-26` inside `"KisanRoute Org"`) as personal scratchpad, another app's future DB, or TripSplitter staging.
2. **Vercel Preview Env Vars (`NOT VERIFIED`):** Preview URL `https://tripsplitter-9qi9eug2m-shubhdgi12-8206s-projects.vercel.app/api/system/status` returned Vercel Authentication SSO login HTML, preventing unauthenticated read-only inspection of Preview's `/api/system/status`.
3. **Supabase Dashboard Auth Provider & Redirect URL Config (`NOT VERIFIED`):** Supabase SQL tables `auth.instances` (`0` rows) and `auth.sso_providers` (`0` rows) show zero custom SSO rows, while hosted GoTrue OAuth/redirect URL settings in Supabase Studio are not readable via Postgres metadata tables without exposing config/API keys or Management Auth settings.

---

## 3. Supabase Project Identification (`ycfasggikwwmxejhgawf`)

Read-only MCP inspection (`list_organizations`, `list_projects`, `get_project`, `list_migrations`, `list_tables`, `list_extensions`, `get_advisors`, and read-only `SELECT` catalog queries via `execute_sql`):

| Attribute | Observed Read-Only Evidence | Classification |
| --- | --- | --- |
| Project Name & Ref | `"ShubhBhattacharya's Project"` (`ycfasggikwwmxejhgawf`) | `VERIFIED` |
| Organization & Plan | `"KisanRoute Org"` (`fnauzciwvkzyohoykmek`), `plan: "free"`, `tier: "tier_free"` | `VERIFIED` |
| Region & Status | `ap-south-1`, `ACTIVE_HEALTHY`, Postgres `17.11.0.003`, created `2026-09-26T12:55:29.492623Z` | `VERIFIED` |
| Sibling Project in Org | `wvljwgarfwstxiceziji` (`"KisanRoute-Staging"`, `INACTIVE`, created `2026-11-01`) | `VERIFIED` |
| Installed Schemas | `auth`, `extensions`, `graphql`, `graphql_public`, `information_schema`, `pg_catalog`, `pg_toast`, `pgbouncer`, `public`, `realtime`, `storage`, `vault` | `VERIFIED` |
| Public Tables & User Migrations | **0** tables in `public`; `list_migrations` = `[]`; `supabase_migrations.schema_migrations` does not exist (`false`) | `VERIFIED` |
| Data / Auth / Storage Footprint | `auth.users`: `0` rows; `auth.identities`: `0`; `auth.instances`: `0`; `auth.sso_providers`: `0`; `storage.buckets`: `0`; `vault.secrets`: `0` | `VERIFIED` |
| Active DB Connections (`pg_stat_activity`) | Internal only (`pgbouncer`, `supabase_admin`, `mgmt-api`, `pg_cron scheduler`, `pg_net 0.20.4`, `postgres_exporter`, `PostgREST 14.18`); zero app connections | `VERIFIED` |
| Security & Health Advisors (`get_advisors`) | `lints: []` (security & health) | `VERIFIED` |
| **Environment Determination** | Empty schema alone does **not** prove staging: project was created 2 months prior to TripSplitter inside another org (`KisanRoute Org`) with a default generic name and zero Vercel connection. | **`UNKNOWN`** |

---

## 4. Migration Static Review (`supabase/migrations/`, 10 Files)

Static analysis of `20261121000001` through `20261127000004` on `feature/phase3-staging-preparation`:

1. **Execution Order & Foreign-Key Dependencies — `VERIFIED`:**
   - `20261121000001_complete_schema.sql`: Creates 16 core tables (`profiles`, `trips`, `trip_members`, `trip_invitations`, `expenses`, `expense_splits`, `vendor_splits`, `vendor_split_members`, `settlements`, `itinerary_items`, `bookings`, `polls`, `poll_options`, `poll_votes`, `activity_logs`, `notifications`) and `is_trip_member()`.
   - `20261122000001_security_hardening.sql`: Creates `is_trip_admin()`, `handle_new_user()`, `handle_new_trip_creator()`, paise columns/constraints, and hardened RLS policies.
   - `20261122000002_final_backend_hardening.sql`: Creates `idempotency_keys` and atomic `create_expense_with_splits()`. Zero missing `is_trip_admin()` reference.
   - `20261125000001_ai_payments_bookings_hardening.sql`: Creates 6 tables (`user_preferences`, `ai_conversations`, `ai_messages`, `receipt_uploads`, `payment_orders`, `payment_webhook_events`).
   - `20261126000001_market_readiness_hardening.sql`: Creates `payment_refunds`, `ai_usage_logs`, `dispatch_trip_notification()`, and `update_expense_with_splits()`.
   - `20261126000002_95_market_readiness_final.sql`: Creates `booking_status_history`, `reserve_payment_refund()`, `finalize_payment_refund()`, alters `payment_refunds` cleanly (post-creation), and applies `REVOKE ALL` / `GRANT EXECUTE` locks.
   - `20261127000001_security_booking_webhook_remediation.sql`: Creates `booking_webhook_events` and hardens booking status transitions.
   - `20261127000002_day7_refund_webhook_hardening.sql`: Locks `finalize_payment_refund` to `service_role` only, drops unsafe client refund policies, adds `processing_status`/`retry_count`/`last_error` to webhook tables.
   - `20261127000003_phase8_complete_rls_and_webhook_hardening.sql`: Hardens `trip_members` self-escalation & defines `accept_trip_invitation()`.
   - `20261127000004_phase9_audit_remediations.sql`: Adds `CONSTRAINT TRIGGER trg_prevent_last_trip_admin_loss` + `prevent_last_trip_admin_loss()`, restricts booking deletion to `'Draft'/'Cancelled'/'Failed'`, and updates `accept_trip_invitation()`.
2. **RLS Coverage — `VERIFIED`:** All **27/27** tables enable Row-Level Security (`WITHOUT_RLS = none`).
3. **Destructive SQL Scan — `VERIFIED`:** Zero `DROP TABLE`, `TRUNCATE`, or `DROP COLUMN` statements. The sole `DELETE FROM` is row-scoped `DELETE FROM public.expense_splits WHERE expense_id = p_expense_id` inside `update_expense_with_splits()` immediately before re-inserting splits atomically.
4. **Duplicate Objects & Idempotency — `VERIFIED`:** All tables use `CREATE TABLE IF NOT EXISTS`, policies use `DROP POLICY IF EXISTS` before `CREATE POLICY`, and functions use `CREATE OR REPLACE FUNCTION`. Note: if comparing branches before merge, `main` (`8f60cda`) still uses un-numbered `20261122_*`/`20261126_*`/`20261127_*` filenames, whereas `feature/phase2-supabase-recovery` and `fix/remaining-readiness` must reconcile canonical migration filenames before merging into `main`.
5. **Rollback & Recovery Strategy — `VERIFIED` (Plan Only):** On a clean disposable staging DB, snapshot with `pg_dump --schema=public --schema-only` prior to `supabase db push`; on failure mid-stack, restore pre-migration backup or drop disposable staging database/schema rather than rolling partial DDL manually in production.

### Migration Execution Plan for Clean Disposable Staging Database (DO NOT RUN HERE)

```bash
# 1. Verify target project ref is your NEW dedicated staging ref (never production or UNKNOWN)
supabase link --project-ref <NEW_STAGING_PROJECT_REF>

# 2. Dry-run / inspect diff before applying
supabase db push --dry-run

# 3. Apply all 10 migrations sequentially (20261121000001 -> 20261127000004)
supabase db push
```

*(Note: Execution requires **OWNER APPROVAL**; **NOT EXECUTED** in Phase 3.)*

---

## 5. Security Risks & Repository Findings

1. **`expense_splits` Debtor Amount Mutation Gap on Phase 2 Branch (`VERIFIED`):**
   Policy `"Debtors can initiate or report paid"` in `20261122000001_security_hardening.sql` validates only `user_id = auth.uid()` and `status IN (...)`, without a `BEFORE UPDATE` trigger blocking changes to `amount_owed`, `amount_owed_paise`, `expense_id`, or `user_id` directly through Supabase PostgREST. *(Remediated separately on branch `fix/remaining-readiness` commit `7b85a7b`; not yet merged into `feature/phase2-supabase-recovery`.)*
2. **Payment Webhook Non-Atomic Persistence & False `200` on Phase 2 Branch (`VERIFIED`):**
   [src/app/api/payments/webhook/route.ts](src/app/api/payments/webhook/route.ts) on Phase 2 returns `HTTP 200 { verified: true, persisted: false }` if `SUPABASE_SERVICE_ROLE_KEY` is missing, mutates tables in separate requests instead of one DB transaction, and does not reclaim stale `processing` locks. *(Remediated separately on `fix/remaining-readiness` commit `d62bf5f`.)*
3. **Public Unauthenticated `/api/system/status` (`VERIFIED`):**
   Returns integration inventory and provider adapter modes without admin authentication on Phase 2 branch. *(Gated on `fix/remaining-readiness` commit `e8ca182`.)*
4. **`/dashboard` & `/notifications` Not in Edge `PROTECTED_PREFIXES` (`VERIFIED`):**
   [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts) redirects only `/trips`, `/qr-split`, `/profile`, and `/settings` at Edge middleware level; `/dashboard` and `/notifications` rely on client UI + API `401` guards when Supabase is configured.
5. **Free-Tier Organization 2-Project Limit (`VERIFIED`):**
   `KisanRoute Org` (`fnauzciwvkzyohoykmek`) is on `free` tier and already contains 2 projects (`wvljwgarfwstxiceziji` INACTIVE + `ycfasggikwwmxejhgawf` ACTIVE). Creating a 3rd dedicated staging project requires creating a dedicated TripSplitter Supabase organization (or owner cleanup/upgrade of unused projects).
6. **Resolved Safe Code Gap Fixed in This Branch (`VERIFIED`):**
   `POST /api/trips`, `GET/POST /api/expenses`, and `PATCH /api/expenses/splits/[id]` previously returned fake `200`/`201` `"demo mode"` success even when `NEXT_PUBLIC_DEMO_MODE` was unset/false. Updated to fail closed (`HTTP 503`) unless `NEXT_PUBLIC_DEMO_MODE === 'true'`.

---

## 6. Dedicated Staging Environment Plan (`REQUIRES OWNER APPROVAL`)

Because `ycfasggikwwmxejhgawf` is **`UNKNOWN`**, **recommended path:** create a new dedicated **`TripSplitter-Staging`** Supabase project in its own dedicated TripSplitter organization (or after explicit owner decision on existing `free`-tier org capacity).

### Environment Variables Matrix

| Variable | Vercel Preview (Staging ONLY) | Local `.env.local` (Staging) | Client-Exposed? | Purpose |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging project URL | Staging project URL | Yes (`NEXT_PUBLIC_`) | Supabase API base URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key | Staging anon key | Yes (`NEXT_PUBLIC_`) | RLS-enforced client auth/queries |
| `SUPABASE_SERVICE_ROLE_KEY` | **Staging service-role key (Preview only)** | **Staging service-role key (gitignored)** | **NO (Server-only)** | Privileged webhooks & refund finalization (`Never` use `NEXT_PUBLIC_*`) |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | `false` | Yes | Disables local mock fallback |
| `PAYMENT_PROVIDER_API_KEY` | Razorpay Test Key (`rzp_test_*`) | Optional test key | **NO (Server-only)** | Test payment order/refund gateway |
| `PAYMENT_PROVIDER_API_SECRET` | Razorpay Test Secret | Optional test secret | **NO (Server-only)** | Gateway basic auth secret |
| `PAYMENT_PROVIDER_WEBHOOK_SECRET` | Staging webhook HMAC secret | Optional test secret | **NO (Server-only)** | `/api/payments/webhook` verification |
| `BOOKING_PROVIDER_WEBHOOK_SECRET` | Staging booking webhook secret | Optional test secret | **NO (Server-only)** | `/api/bookings/webhook` verification |

### Required Supabase Auth Callback & Redirect URLs (Staging Project)
Under **Supabase Dashboard → Authentication → URL Configuration** in the dedicated staging project:
- **Site URL:** `https://tripsplitter-9qi9eug2m-shubhdgi12-8206s-projects.vercel.app` (or current Vercel Preview domain)
- **Additional Redirect URLs:**
  - `http://localhost:3000/auth/callback`
  - `https://tripsplitter-9qi9eug2m-shubhdgi12-8206s-projects.vercel.app/auth/callback`
  - `https://*-shubhdgi12-8206s-projects.vercel.app/auth/callback` (if preview subdomains vary per commit)

*(Never commit `.env.local` or paste API keys/passwords/service-role keys into chat or GitHub.)*

---

## 7. Verification Summary & Test Distinction (Mocked vs Live DB)

| Check / Flow | Execution Mode | Status | Details |
| --- | --- | --- | --- |
| `npx tsc --noEmit` | Local TypeScript compiler | `VERIFIED` | Exits `0` |
| `npm run lint` | Local ESLint | `VERIFIED` | Exits `0` |
| `npm test` (`vitest run`) | **Mocked** (`vi.mock` Supabase SSR/client/admin) + static SQL checks | `VERIFIED` | Tests HTTP route guards, financial math, middleware, fail-closed `503` logic, and static SQL order — does **NOT** prove live Postgres connectivity |
| `npm run build --webpack` | Local Next.js production build | `VERIFIED` | Succeeds cleanly with `NEXT_PUBLIC_DEMO_MODE=true` |
| Live Staging 10-Step E2E (`scripts/live-staging-e2e.mjs`) | **Real Supabase Auth + Real Postgres + Live Preview** | **`BLOCKED`** | Exits with code `2` (`BLOCKED: Missing staging environment variables` / awaiting owner approval & dedicated staging project) |

### 10-Step Live E2E Test Plan (`scripts/live-staging-e2e.mjs`)

1. **User signup & login** — Real GoTrue `signUp` + `signInWithPassword` for disposable User A, User B, and outsider User C. (**BLOCKED**)
2. **Session persistence & logout** — Verified JWT `getUser()` persistence and `signOut()`. (**BLOCKED**)
3. **Profile creation & updates** — Confirms `handle_new_user` trigger creates `public.profiles` row, updates `display_name` & `upi_id`. (**BLOCKED**)
4. **Trip creation & retrieval** — Real `trips` insert & retrieval verifying `handle_new_trip_creator` `admin` role. (**BLOCKED**)
5. **Trip invitations & membership** — Admin invite creation + email-matched User B `accept_trip_invitation()` RPC redemption. (**BLOCKED**)
6. **Expense creation & splitting** — `create_expense_with_splits()` RPC with integer-paise split accuracy. (**BLOCKED**)
7. **Settlement calculations & persistence** — User B records settlement (`manually_reported_paid`) cleanly in `public.settlements`. (**BLOCKED**)
8. **Booking creation** — Creates `Draft` booking row in `public.bookings`. (**BLOCKED**)
9. **User preferences** — Upserts & reads `public.user_preferences`. (**BLOCKED**)
10. **Cross-user authorization & RLS** — Confirms outsider User C reads `0` rows from User A's `trips`/`expenses` via Supabase RLS and non-admin User B cannot self-escalate `trip_members.role` to `'admin'`. (**BLOCKED**)

---

## 8. Exact Owner Actions Required Before Next Phase

1. **Confirm Supabase Project Strategy (`REQUIRES OWNER APPROVAL`):**
   Decide whether to create a fresh dedicated **`TripSplitter-Staging`** project in a new organization (recommended) or explicitly authorize using/wiping `ycfasggikwwmxejhgawf` after verifying no other project relies on it.
2. **Apply Migrations to Approved Staging Project (`REQUIRES OWNER APPROVAL`):**
   Approve running `supabase db push` of migrations `20261121000001`–`20261127000004` (plus decide whether to merge security remediations from `fix/remaining-readiness`, e.g., immutable `expense_splits` trigger & atomic webhook RPC, before pushing).
3. **Configure Vercel Preview & Auth Redirect URLs (`REQUIRES OWNER APPROVAL`):**
   Add Preview-only staging environment variables in Vercel Project Settings (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_DEMO_MODE=false`) and configure Auth `/auth/callback` URLs in Supabase Studio.
4. **Authorize Live 10-Step Staging E2E Execution (`REQUIRES OWNER APPROVAL`):**
   Run `ALLOW_STAGING_SUPABASE_EXECUTION=I_APPROVE_STAGING_E2E node scripts/live-staging-e2e.mjs` with Preview/local staging env vars populated, verify all 10 live steps pass, and delete disposable test accounts.

---

## 9. Remaining Blockers

1. **No Conclusive Staging Supabase Project Identified (`UNKNOWN`):** `ycfasggikwwmxejhgawf` cannot be verified as staging, blocking migration execution.
2. **Missing Staging Runtime Env Vars & Protected Preview SSO:** No `.env.local` or accessible Preview Supabase configuration exists for live database E2E runs.
3. **Branch Reconciliation Pending Between `feature/phase2-supabase-recovery` and `fix/remaining-readiness`:** Security/payment/legal fixes on `fix/remaining-readiness` (debtor split-amount trigger, atomic webhook RPC, gated system status) are not yet unified with `feature/phase2-supabase-recovery`'s re-timestamped migration filenames prior to any staging schema push.

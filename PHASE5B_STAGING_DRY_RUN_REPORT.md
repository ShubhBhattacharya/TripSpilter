# TripSplitter / TripSplit — Phase 5B: Staging Migration Dry-Run & Final Safety Verification Report

**Repository:** `https://github.com/ShubhBhattacharya/TripSpilter.git`  
**Mode:** Strictly Read-Only Pre-Execution Audit (zero SQL executed, zero migrations pushed, zero remote config/Vercel/Supabase/Production/`main` modifications; legacy project `ycfasggikwwmxejhgawf` never accessed)  
**Labels Used:** `VERIFIED` | `PASS` | `FAIL` | `BLOCKED` | `NOT VERIFIED` | `REQUIRES OWNER APPROVAL`

---

## Final Decision: **`SAFE FOR OWNER-APPROVED STAGING MIGRATION`**

*(Live PostgreSQL runtime execution remains `NOT VERIFIED` until owner approves Phase 5C migration push against empty staging project `dotpmdvxvmsrbzcmkqrp`. Do not merge into `main` or promote to Production.)*

---

## 1. Repository Branch & Commit SHA (`VERIFIED`)

- **Remote Origin URL:** `https://github.com/ShubhBhattacharya/TripSpilter.git` (`VERIFIED`)
- **Current Branch:** `feature/phase5a-migration-defect-fixes` (`VERIFIED`)
- **Confirmed Phase 4 Ancestor (`git merge-base HEAD 5e2354c68f95f6e632d51a40945ef9bcd10b886c`):** `5e2354c68f95f6e632d51a40945ef9bcd10b886c` (`VERIFIED`)
- **Current HEAD Commit SHA:** `ccdf644bb347d81818fc9eaac0baa2991d379e19` (`VERIFIED`)
- **Working Tree Before This Report (`git status --short`):** clean (`VERIFIED`; this audit creates only `PHASE5B_STAGING_DRY_RUN_REPORT.md` locally)
- **Expected Remediation & Test Files Present:** `supabase/migrations/20261128000003_auth_triggers_and_fk_safety.sql` (5,671 bytes) and `tests/phase5a-remediation.test.ts` (`VERIFIED`)

## 2. GitHub Push Status (`VERIFIED`)

- **`git ls-remote origin refs/heads/feature/phase5a-migration-defect-fixes`:** `ccdf644bb347d81818fc9eaac0baa2991d379e19` (`VERIFIED` — 100% synchronized with local `HEAD`)

## 3. Exact Staging Project Identity (`dotpmdvxvmsrbzcmkqrp`) (`VERIFIED`)

Verified read-only via Supabase MCP (`list_organizations`, `get_project`, `list_tables`, `list_migrations`, `list_extensions`, `get_advisors`):

| Property | Observed Value | Status |
| --- | --- | --- |
| **Organization / ID** | `TripSplitter-Staging` / `zgteowaybbtmelqnleqo` | `VERIFIED` |
| **Project Ref / Name** | `dotpmdvxvmsrbzcmkqrp` / `ShubhBhattacharya's Project` | `VERIFIED` |
| **Region / Engine / Health** | `ap-south-1` / Postgres `17.12.0.002` (`ga`) / `ACTIVE_HEALTHY` | `VERIFIED` |
| **Current `public` Schema Tables** | `0` tables (`tables: []`) | `VERIFIED` |
| **Extensions (`78` cataloged, `5` installed)** | `pgcrypto@1.3`, `uuid-ossp@1.1`, `supabase_vault@0.3.2`, `pg_stat_statements@1.11`, `plpgsql@1.0` | `VERIFIED` |
| **Performance Advisor (`get_advisors`)** | `0` lints | `VERIFIED` |
| **Security Advisor (`get_advisors`)** | `2` default template warnings (`0028`/`0029`) on built-in `public.rls_auto_enable()` (`event_trigger` function; intentionally unaltered) | `VERIFIED` |

## 4. Current Migration History on `dotpmdvxvmsrbzcmkqrp` (`VERIFIED`)

- **`list_migrations(dotpmdvxvmsrbzcmkqrp)`:** `{"migrations": []}` (`0` applied migrations).

## 5. Complete 13-Migration Chronological Review (`VERIFIED` Static / `NOT VERIFIED` Live PG)

| # | Migration File (Lines) | Dependencies, Syntax & Security Review | Result |
| --- | --- | --- | --- |
| 1 | `20261121000001_complete_schema.sql` (280) | Creates `"uuid-ossp"` (pre-installed in `extensions`), 16 core tables, indexes, `is_trip_member()` (`L230 SECURITY DEFINER`), enables RLS on all 16 tables (`L241-L256`). Note: `L65 expenses.paid_by ... ON DELETE SET NULL NOT NULL` contradicted deletion until remediated cleanly in Migration #13. | `PASS` (Static) |
| 2 | `20261122000001_security_hardening.sql` (233) | Defines `is_trip_member` (`L15`), `is_trip_admin` (`L29`), `handle_new_user` (`L46`), `handle_new_trip_creator` (`L68`), backfills paise `CHECK` constraints (`L126-L135`), hardens `expenses`/`expense_splits`/`settlements` RLS. Trigger attachment & `, pg_temp` `search_path` completed in #13. | `PASS` (Static) |
| 3 | `20261122000002_final_backend_hardening.sql` (258) | Creates `idempotency_keys` (RLS `L22`), fills missing RLS policies across bookings/invitations/polls/notifications/activity logs, adds transactional `create_expense_with_splits()` (`L115`). Runs after `is_trip_admin()` is created in #2. | `PASS` (Static) |
| 4 | `20261125000001_ai_payments_bookings_hardening.sql` (169) | Extends `expenses.split_type` (`PERCENTAGE`), adds booking columns, creates 6 tables (`user_preferences`, `ai_conversations`, `ai_messages`, `receipt_uploads`, `payment_orders`, `payment_webhook_events`), enables RLS on all 6; zero client policy on `payment_webhook_events` (`service_role` only). Zero unsafe lines. | `PASS` (Static) |
| 5 | `20261126000001_market_readiness_hardening.sql` (320) | Adds booking lifecycle constraint (`L57-L70`), creates `payment_refunds` & `ai_usage_logs` (both RLS), `dispatch_trip_notification()` (`L161`), and `update_expense_with_splits()` (`L241`). `L298 DELETE FROM public.expense_splits WHERE expense_id = p_expense_id` is scoped atomically inside RPC right before re-inserting splits (`L300`). | `PASS` (Static) |
| 6 | `20261126000002_95_market_readiness_final.sql` (326) | Extends `payment_orders` & `payment_refunds` cleanly after #5, creates `booking_status_history` (RLS), adds `reserve_payment_refund()` (`L97`), `finalize_payment_refund()` (`L206`), and locks RPC grants (`L299-L318`) with `authenticated` / `service_role`. | `PASS` (Static) |
| 7 | `20261127000001_security_booking_webhook_remediation.sql` (54) | Adds `bookings.payment_order_id` FK, creates server-only `booking_webhook_events` (RLS `L32`, zero client policies), restricts client `booking_status_history` `source` values (`L52`). | `PASS` (Static) |
| 8 | `20261127000002_day7_refund_webhook_hardening.sql` (138) | Drops unsafe client `INSERT`/`UPDATE`/`DELETE` policies on `payment_refunds`, locks `finalize_payment_refund()` (`L30 SET search_path = public, pg_temp`, `L105-L106 service_role` only), adds webhook retry tracking columns cleanly after #7. | `PASS` (Static) |
| 9 | `20261127000003_phase8_complete_rls_and_webhook_hardening.sql` (351) | Closes `trip_members` invitation escalation (`L11-L28`), enforces email-matched `accept_trip_invitation()` (`L299 SET search_path = public, pg_temp`, `L350 GRANT TO authenticated`), completes strict `TO authenticated` policies across all tables including non-confirmed booking guards. | `PASS` (Static) |
| 10 | `20261127000004_phase9_audit_remediations.sql` (145) | Adds `CONSTRAINT TRIGGER trg_prevent_last_trip_admin_loss` (`L51`) + `prevent_last_trip_admin_loss()` (`L20`), restricts booking delete RLS to `Draft`/`Cancelled`/`Failed` (`L61-L67`), adds `alreadyMember` to `accept_trip_invitation()` (`L84`). | `PASS` (Static) |
| 11 | `20261128000001_expense_splits_immutable_amounts.sql` (29) | Adds `BEFORE UPDATE` trigger `trg_expense_splits_immutable_columns` (`L25`) via `prevent_expense_splits_immutable_update()` (`L7`) blocking all roles from altering `expense_id`, `user_id`, `amount_owed`, `amount_owed_paise`. | `PASS` (Static) |
| 12 | `20261128000002_payment_webhook_transaction_rpc.sql` (277) | Adds `process_payment_webhook()` RPC (`L37`, `SET search_path = public, pg_temp`, `L275-L276 service_role` only) updating orders/splits/refunds/events in 1 transaction with 300s stale lock reclaim. | `PASS` (Static) |
| 13 | `20261128000003_auth_triggers_and_fk_safety.sql` (130) | Fixes F-01 (`L55` `on_auth_user_created`, `L61` `on_trip_created`), F-02 (`L70` `DROP NOT NULL`), F-03 (`L76-L92` `search_path = public, pg_temp` + trigger `REVOKE ALL`), F-04 (`L100-L125` `trg_settlements_immutable_columns`), F-05 (`L129` `idx_trips_created_by`). | `PASS` (Static) |

## 6. Independent F-01 through F-05 Verification

- **F-01 (`auth.users` & `public.trips` triggers — `VERIFIED` Static):** `on_auth_user_created` (`20261128000003:L55-L59`) attaches `AFTER INSERT ON auth.users` calling `handle_new_user()` (`L10-L35`, handles missing email/phone OTP cleanly with `'Traveler'` fallback and `ON CONFLICT DO UPDATE` without clobbering existing `display_name`). `on_trip_created` (`L61-L65`) attaches `AFTER INSERT ON public.trips` calling `handle_new_trip_creator()` (`L37-L53`, assigns creator `'admin'` in `public.trip_members`). Live Postgres `auth.users` execution: **`NOT VERIFIED`**.
- **F-02 (`expenses.paid_by` deletion safety & nullable code audit — `VERIFIED` Static & Mocked):** `20261128000003:L70` runs `ALTER TABLE public.expenses ALTER COLUMN paid_by DROP NOT NULL`. `20261122000001:L171` RLS policy still requires `is_trip_member(trip_id) AND paid_by = auth.uid()` on `INSERT` (blocking `NULL` or forged payers). Verified nullable `paidBy: string | null` across [split-engine.ts](src/lib/financial/split-engine.ts), [splits/[id]/route.ts](src/app/api/expenses/splits/[id]/route.ts), [members/route.ts](src/app/api/trips/[id]/members/route.ts), [settlements/route.ts](src/app/api/trips/[id]/settlements/route.ts), [trips/[id]/page.tsx](src/app/trips/[id]/page.tsx), [tools.ts](src/lib/ai/tools.ts), and [tools-extended.ts](src/lib/ai/tools-extended.ts): zero `"null"` key coercion or broken notification `UUID[]` arrays. Live deletion cascade on Postgres: **`NOT VERIFIED`**.
- **F-03 (`SECURITY DEFINER` hardening & grants — `VERIFIED` Static):** All **14** custom functions across #1–#13 resolve to `SET search_path = public, pg_temp`; all 5 trigger functions have `REVOKE ALL FROM PUBLIC, anon, authenticated`; user RPCs restrict `EXECUTE` to `authenticated` (except `is_trip_member`/`is_trip_admin` explicitly revoked from `PUBLIC, anon` and granted to `authenticated`); `finalize_payment_refund` and `process_payment_webhook` grant `EXECUTE` solely to `service_role`. Supabase built-in `public.rls_auto_enable()` (`event_trigger`) intentionally left unaltered.
- **F-04 (`settlements` immutability — `VERIFIED` Static):** `trg_settlements_immutable_columns` (`20261128000003:L121-L125`) calls `prevent_settlements_immutable_update()` blocking changes to `trip_id`, `from_user_id`, `to_user_id`, `amount`, and `amount_paise` for all roles while preserving debtor `manually_reported_paid` and creditor/admin `verified_paid` updates. Live Postgres enforcement: **`NOT VERIFIED`**.
- **F-05 (Index hygiene — `VERIFIED` Static):** Adds `idx_trips_created_by` (`20261128000003:L129`) backing `GET /api/trips`, `is_trip_admin()`, and `"Members view trips"`. Leaves unused FK columns (`vendor_split_members.verified_by`, `bookings.booked_by`, `receipt_uploads.*`, `ai_conversations.trip_id`, `payment_refunds.trip_id`) unindexed to avoid write amplification and preserves existing indexes without destructive `DROP INDEX`.

## 7. SQL Safety Findings (`VERIFIED`)

- `DROP TABLE`: **0**
- `DROP COLUMN`: **0**
- `TRUNCATE`: **0**
- `DELETE FROM`: **1** (`20261126000001_market_readiness_hardening.sql:L298`, scoped `WHERE expense_id = p_expense_id` inside transactional `update_expense_with_splits()`, immediately re-inserting splits)
- `DISABLE ROW LEVEL SECURITY`: **0**
- `GRANT ... TO PUBLIC/anon`: **0**
- `public` tables without RLS: **0 / 27** (`27 / 27` enable RLS; 25 have `TO authenticated` policies, 2 server-only webhook audit tables intentionally have zero client policies)

## 8. Local Dry-Run & Runtime Environment Distinction (`NOT VERIFIED` Live Postgres)

- **Local PostgreSQL (`psql`, `pg_ctl`, `postgres`, `supabase`, `docker`):** None installed locally — real PostgreSQL dry-run and runtime tests are **`NOT VERIFIED`**.
- **Local Env Var Presence (booleans only):** `NEXT_PUBLIC_SUPABASE_URL=false`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=false`, `SUPABASE_SERVICE_ROLE_KEY=false`, `NEXT_PUBLIC_DEMO_MODE=false`, `SYSTEM_STATUS_TOKEN=false`, `PAYMENT_PROVIDER_API_KEY=false`, `PAYMENT_PROVIDER_WEBHOOK_SECRET=false`.

## 9. Application Integration Readiness (`VERIFIED` Code / `BLOCKED` Live Runtime)

- **Auth & Callback (`/auth/callback`, `AuthProvider.tsx`, `src/proxy.ts` + `middleware.ts`):** `VERIFIED` — `/trips`, `/qr-split`, `/profile`, `/settings` fail closed (`307 -> /login?error=supabase-unconfigured`) when unconfigured; `/auth/callback` sanitizes `next` redirects and supports PKCE code exchange & OTP verification.
- **Trip, Expense, Settlement & Booking APIs:** `VERIFIED` — `POST /api/trips`, `GET/POST /api/expenses`, `PATCH /api/expenses/splits/[id]`, `/api/trips/[id]`, `/api/trips/[id]/settlements`, `/api/bookings` enforce `requireAuthenticatedUser()`, trip membership/admin checks, and fail closed (`HTTP 503`) unless `NEXT_PUBLIC_DEMO_MODE=true`.
- **Payment Webhook & System Status:** `VERIFIED` — `POST /api/payments/webhook` fails closed (`503` without `verified`) and uses atomic `process_payment_webhook()` RPC; `GET /api/system/status` enforces constant-time `X-Admin-Token` check (`404` in production otherwise) and emits booleans only.

## 10. Static vs Runtime Verification Results (Run Fresh on `ccdf644`)

| Command | Scope | Result | Observed Output |
| --- | --- | --- | --- |
| `npm run lint` | ESLint across repo | **`PASS`** | `exit 0` |
| `npx tsc --noEmit` | TypeScript compiler | **`PASS`** | `exit 0` |
| `npm test` (`vitest run`) | **Static SQL + Mocked DB** (`vi.mock`, *no live Postgres*) | **`PASS`** | `Test Files  20 passed (20)`, `Tests  159 passed (159)`, `0` failed (`8.62s`) |
| `npm run build --webpack` | Next.js 16.4.6 production build | **`PASS`** | `exit 0` (`Compiled successfully in 3.4s`, `40/40` static pages) |
| Live Postgres Triggers, RLS & 10-Step E2E | Real `dotpmdvxvmsrbzcmkqrp` database | **`NOT VERIFIED`** / **`BLOCKED`** | Pending Phase 5C owner approval & Preview staging env config |

## 11. Required Owner Configuration (`REQUIRES OWNER APPROVAL`)

1. **Staging Email Confirmation Setting (`NOT VERIFIED` read-only):** Check **Supabase Studio (`dotpmdvxvmsrbzcmkqrp`) → Authentication → Sign In / Providers → Email → Confirm email**. For `scripts/live-staging-e2e.mjs` (`auth.signUp()` + immediate `signInWithPassword()`), either temporarily disable `"Confirm email"` in staging OR pre-confirm disposable E2E accounts via `admin.auth.admin.createUser({ email_confirm: true })`.
2. **Supabase Auth Redirect URLs (`dotpmdvxvmsrbzcmkqrp` → Authentication → URL Configuration):**
   - `http://localhost:3000/auth/callback`
   - `https://*-shubhdgi12-8206s-projects.vercel.app/auth/callback`
3. **Vercel Preview-Only Environment Variables (Never in Production):**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` *(server-only)*
   - `NEXT_PUBLIC_DEMO_MODE=false`
   - `SYSTEM_STATUS_TOKEN` *(server-only)*

## 12. Unresolved Blockers

1. **Owner Approval Required for Phase 5C Migration Push:** No SQL/migrations executed on `dotpmdvxvmsrbzcmkqrp` yet.
2. **Missing Runtime Credentials & Unverified Email Confirmation Setting:** Live 10-step E2E testing against `dotpmdvxvmsrbzcmkqrp` cannot execute until Staging Auth settings and Preview/local `.env.local` are configured by owner.

## 13. Recommended Next Steps (`REQUIRES OWNER APPROVAL`)

1. Owner reviews this Phase 5B report and explicitly authorizes **Phase 5C**: pushing migrations `1`–`13` (`20261121000001` → `20261128000003`) to empty staging project **`dotpmdvxvmsrbzcmkqrp`** (`ap-south-1`), followed by live Postgres verification (`pg_tables`, `pg_policies`, `information_schema.triggers`, `pg_proc`, `get_advisors`).
2. After Phase 5C passes live Postgres inspection, owner sets Vercel Preview env vars & staging Auth redirect URLs and authorizes Phase 6 live 10-step E2E testing (`scripts/live-staging-e2e.mjs`).

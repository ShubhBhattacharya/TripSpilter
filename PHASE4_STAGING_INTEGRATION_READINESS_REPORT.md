# TripSplitter / TripSplit — Phase 4: Safe Staging Integration Readiness Report

**Repository:** `https://github.com/ShubhBhattacharya/TripSpilter`  
**Phase 4 Integration Branch:** `feature/phase4-staging-integration` *(reconciled `feature/phase2-supabase-recovery`, `feature/phase3-staging-preparation`, and `fix/remaining-readiness`)*  
**Main Branch (`main` — Untouched):** `8f60cda`  
**Production URL (`https://tripsplitter-delta.vercel.app/` — Untouched):** Live runtime unchanged (`"supabase": false`)  
**Dedicated Staging Supabase Project:** `dotpmdvxvmsrbzcmkqrp`  
**Status Taxonomy:** `VERIFIED` | `BLOCKED` | `NOT VERIFIED` | `REQUIRES OWNER APPROVAL`

---

## 1. Verified Dedicated Supabase Staging Project (`VERIFIED`)

Inspected strictly read-only via connected `supabase_mcp` (`list_organizations`, `list_projects`, `get_project`, `list_tables`, `list_migrations`, `list_extensions`, `get_advisors`). Old unknown project `ycfasggikwwmxejhgawf` was **not** accessed or modified.

| Field | Observed Result | Classification |
| --- | --- | --- |
| **Organization** | `TripSplitter-Staging` (`id`: `zgteowaybbtmelqnleqo`) | `VERIFIED` |
| **Project Ref** | `dotpmdvxvmsrbzcmkqrp` | `VERIFIED` |
| **Project Name** | `ShubhBhattacharya's Project` *(created `2026-11-28T07:19:10.893257Z`)* | `VERIFIED` |
| **Region** | `ap-south-1` | `VERIFIED` |
| **Status / DB Engine** | `ACTIVE_HEALTHY`, Postgres `17.12.0.002` (`db.dotpmdvxvmsrbzcmkqrp.supabase.co`) | `VERIFIED` |
| **`public` Schema Tables** | `[]` (`0` tables — fresh empty staging project) | `VERIFIED` |
| **Applied Migrations** | `list_migrations` = `[]` (`0` migrations executed) | `VERIFIED` |
| **Extensions** | `78` cataloged; `6` installed (`plpgsql` `1.0`, `pgcrypto` `1.3`, `uuid-ossp` `1.1`, `pg_graphql` `1.6.3`, `pg_stat_statements` `1.11`, `supabase_vault` `0.3.2`) | `VERIFIED` |
| **Internal RLS Baseline** | `auth.*` & `storage.*` tables intact (`auth.users`: `0` rows, `storage.buckets`: `0`, `vault.secrets`: `0`) | `VERIFIED` |
| **Security Advisors (`get_advisors`)** | Default template notice on built-in `public.rls_auto_enable()` (`anon`/`authenticated` `SECURITY DEFINER` execute warning `0028`/`0029`) | `VERIFIED` |

---

## 2. Branch Reconciliation Summary (`VERIFIED`)

Created `feature/phase4-staging-integration` from `feature/phase3-staging-preparation` (`9cda420`, which builds on `feature/phase2-supabase-recovery` `be9a598`) and merged `origin/fix/remaining-readiness` (`2732cf9`):

| Source Branch | Commit | Preserved Contributions | Conflict Resolution Notes | Classification |
| --- | --- | --- | --- | --- |
| `feature/phase2-supabase-recovery` | `be9a598` | Reordered 10 baseline migrations (`20261121000001`–`20261127000004`), fail-closed `src/lib/supabase/middleware.ts`, strict client DB error handling (`AuthProvider`, `/trips`, `BalancesTab`, `BookingsVaultTab`), `tests/phase2-recovery.test.ts` | Updated `tests/phase2-recovery.test.ts` migration array expectation from 10 to 12 to include the two `20261128*` additive migrations | `VERIFIED` |
| `feature/phase3-staging-preparation` | `9cda420` | Fail-closed `HTTP 503` on unconfigured `POST /api/trips`, `GET/POST /api/expenses`, `PATCH /api/expenses/splits/[id]` (when `NEXT_PUBLIC_DEMO_MODE !== 'true'`), 10-step `scripts/live-staging-e2e.mjs`, `tests/phase3-staging-preparation.test.ts` | Refined `scripts/live-staging-e2e.mjs` Step 2 session/logout client isolation and enforced `dotpmdvxvmsrbzcmkqrp` target guard | `VERIFIED` |
| `fix/remaining-readiness` | `2732cf9` | `20261128000001_expense_splits_immutable_amounts.sql`, `20261128000002_payment_webhook_transaction_rpc.sql`, atomic `/api/payments/webhook` `503` fail-closed route, gated `/api/system/status` (`X-Admin-Token` + `timingSafeEqual` + booleans only), `/refunds` & `/contact` legal pages + draft banners, `TripSplit` brand standardization, repo `.gitignore`/`.gitattributes` hygiene | Resolved single merge conflict in `src/components/auth/AuthExperience.tsx` (`handleGoogleAuth`) by retaining Phase 2 fail-closed `setError(...)` when Supabase is unconfigured rather than demo bypass; updated `docs/launch-checklist.md` to canonical filenames & ref `dotpmdvxvmsrbzcmkqrp` | `VERIFIED` |
| `main` | `8f60cda` | Base branch | **Completely untouched** | `VERIFIED` |

---

## 3. Final Migration Inventory, Ordering & Checksums (`supabase/migrations/`)

**Execution Status:** **NOT EXECUTED (`REQUIRES OWNER APPROVAL`)**. Static review confirms zero missing foreign keys, zero `DROP TABLE` / `TRUNCATE` / `DROP COLUMN` statements, and `ENABLE ROW LEVEL SECURITY` on **27 / 27** created `public` tables.

| Order | Migration File | Primary Scope & Security Controls | SHA-256 Checksum | Status |
| --- | --- | --- | --- | --- |
| 1 | `20261121000001_complete_schema.sql` | 16 core tables, indexes, `is_trip_member()`, RLS enabled on all 16 | `c9eefbe808b1cd55140ae07d260cc83d05328da7ad85ad0313527bf73ec16ada` | `VERIFIED` (Static) |
| 2 | `20261122000001_security_hardening.sql` | `is_trip_admin()`, `handle_new_user()`, `handle_new_trip_creator()`, paise constraints, hardened RLS | `25cea3bf17e1dd5917edba3fe04b507f6a33031bad2ad4264d6159d5eaae127f` | `VERIFIED` (Static) |
| 3 | `20261122000002_final_backend_hardening.sql` | `idempotency_keys` (RLS), atomic `create_expense_with_splits()` RPC | `6457ab90ce8526fd5c978e0dabdbd57623aa8f3e08c3bd7e634b703b2cce88d9` | `VERIFIED` (Static) |
| 4 | `20261125000001_ai_payments_bookings_hardening.sql` | `user_preferences`, `ai_conversations`, `ai_messages`, `receipt_uploads`, `payment_orders`, `payment_webhook_events` (all RLS) | `02950a86d5774c04a86fee0031c2c2763daebe8ac2c18eb872d25bf1c9d73222` | `VERIFIED` (Static) |
| 5 | `20261126000001_market_readiness_hardening.sql` | `payment_refunds`, `ai_usage_logs` (RLS), `dispatch_trip_notification()`, transactional `update_expense_with_splits()` | `b96523fa1f35c1a8bfbe636a86194c9d8f4137b8eb2e4118db419d0b7905066d` | `VERIFIED` (Static) |
| 6 | `20261126000002_95_market_readiness_final.sql` | `booking_status_history` (RLS), `reserve_payment_refund()`, `REVOKE`/`GRANT EXECUTE` locks | `7d0b1d6ea1dc358e3ef054bf01c1a98869ee4f5efed0da8dbfce8812fd0d55dd` | `VERIFIED` (Static) |
| 7 | `20261127000001_security_booking_webhook_remediation.sql` | `booking_webhook_events` (RLS), monotonic booking status validation | `9b5794980b0b2d4fb716a060e1676708d81ed9eaf5095fa5378b3b30cd5c76bb` | `VERIFIED` (Static) |
| 8 | `20261127000002_day7_refund_webhook_hardening.sql` | Locks `finalize_payment_refund()` to `service_role`, drops direct refund INSERT policy, webhook retry columns | `e200244e3347ac972ad46d3ed23c9b70be0061cce5c4a7cc9d4120b53390d094` | `VERIFIED` (Static) |
| 9 | `20261127000003_phase8_complete_rls_and_webhook_hardening.sql` | Closes `trip_members` self-escalation loophole, adds email-bound `accept_trip_invitation()` | `073d8b04a87b1a194472cc266d6986b01067df4456930c5d958d3524d5cedd40` | `VERIFIED` (Static) |
| 10 | `20261127000004_phase9_audit_remediations.sql` | `trg_prevent_last_trip_admin_loss` trigger, restricts booking deletes to non-confirmed drafts | `4604c8cff45f38daf67deb13610f653961f31d669d12b3f4097684bea739d937` | `VERIFIED` (Static) |
| 11 | `20261128000001_expense_splits_immutable_amounts.sql` | `BEFORE UPDATE` trigger on `public.expense_splits` blocking all roles from mutating `expense_id`, `user_id`, `amount_owed`, `amount_owed_paise` | `e391ca338d50caf939964c44bc8efcaa458fd8d6740e5dc3b4d43fada00deab8` | `VERIFIED` (Static) |
| 12 | `20261128000002_payment_webhook_transaction_rpc.sql` | Single-transaction `process_payment_webhook()` RPC (`service_role` only) + 5-minute stale `processing` reclaim | `7a133819a5f8618f50f4a62132f64a8ab838b1783f0111c36a9e3d31c7b0099b` | `VERIFIED` (Static) |

---

## 4. Security Review Findings

- **Debtor Split-Amount Tampering Closed (`VERIFIED` Code / Migration Static):** Migration #11 prevents debtor, creditor, or `service_role` edits to `expense_id`, `user_id`, `amount_owed`, or `amount_owed_paise` while allowing status transitions (`manually_reported_paid`).
- **Webhook Atomicity & Fail-Closed (`VERIFIED` Code):** [src/app/api/payments/webhook/route.ts](src/app/api/payments/webhook/route.ts) rejects missing `SUPABASE_SERVICE_ROLE_KEY` with `HTTP 503` (zero `verified: true` leakage) and runs all order/split/refund/event updates in one transaction via `process_payment_webhook()`.
- **Fail-Closed APIs & Proxy (`VERIFIED` Code):** `/trips`, `/qr-split`, `/profile`, `/settings` fail closed at [src/proxy.ts](src/proxy.ts) + [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts); unconfigured `POST /api/trips`, `GET/POST /api/expenses`, `PATCH /api/expenses/splits/[id]` return `503` unless `NEXT_PUBLIC_DEMO_MODE=true`.
- **Gated Diagnostics (`VERIFIED` Code):** [src/app/api/system/status/route.ts](src/app/api/system/status/route.ts) returns `404` in `NODE_ENV=production` unless `X-Admin-Token` passes constant-time comparison with `SYSTEM_STATUS_TOKEN`, and outputs booleans only.
- **Template Advisory on `dotpmdvxvmsrbzcmkqrp` (`VERIFIED` Advisor):** Default Supabase Postgres 17 function `public.rls_auto_enable()` is flagged as `anon`/`authenticated`-executable by `get_advisors(security)` (template artifact, not created by TripSplit migrations; consider `REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;` after initial push).
- **Live RLS / Postgres Verification:** `NOT VERIFIED` (`BLOCKED` pending owner approval to apply migrations to `dotpmdvxvmsrbzcmkqrp`).

---

## 5. Staging Connection Setup Instructions (Vercel Preview Only)

Configure **ONLY in Vercel → Project Settings → Environment Variables → Preview** (keep **Production** unchanged; never place secrets in `NEXT_PUBLIC_*` or Git):

| Variable | Value Source | Scope | Exposure |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dotpmdvxvmsrbzcmkqrp.supabase.co` *(or Dashboard API URL for staging project)* | Vercel **Preview** only | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key from `dotpmdvxvmsrbzcmkqrp` | Vercel **Preview** only | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role secret key from `dotpmdvxvmsrbzcmkqrp` | Vercel **Preview** only | **Server-only** |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Vercel **Preview** only | Public |
| `SYSTEM_STATUS_TOKEN` | Random high-entropy admin token | Vercel **Preview** only | **Server-only** |

**Supabase Auth Redirect URLs (`dotpmdvxvmsrbzcmkqrp` → Authentication → URL Configuration):**
- `http://localhost:3000/auth/callback`
- `https://*-shubhdgi12-8206s-projects.vercel.app/auth/callback` *(and explicit Preview deployment URL)*

---

## 6. Code-Level Verification Results (`feature/phase4-staging-integration`)

| Command | Mode | Result | Exact Observed Output |
| --- | --- | --- | --- |
| `npm run lint` | Static ESLint | **`VERIFIED`** | Exited `0` |
| `npx tsc --noEmit` | TypeScript compiler (`next typegen` refreshed) | **`VERIFIED`** | Exited `0` |
| `npm test` | **Mocked** (`vi.mock` Supabase + static SQL/HTML/hygiene assertions) | **`VERIFIED`** | `Test Files  19 passed (19)`, `Tests  153 passed (153)`, `0` failed (`9.85s`) |
| `npm run build --webpack` | Production Next.js 16.4.6 webpack build | **`VERIFIED`** | Exited `0` (`Compiled successfully in 42s`, `40/40` static pages generated) |
| `scripts/live-staging-e2e.mjs` | **Real Supabase Auth + Postgres E2E** (Cases 1–10) | **`BLOCKED`** | Preflight blocks execution without live staging env & `ALLOW_STAGING_SUPABASE_EXECUTION=I_APPROVE_STAGING_E2E`; prevents targeting `tripsplitter-delta.vercel.app` or `ycfasggikwwmxejhgawf`, and cleans up all disposable test accounts in `finally` |

---

## 7. Remaining Blockers & Exact Owner Approvals Needed

1. **Migration Execution on `dotpmdvxvmsrbzcmkqrp` — `REQUIRES OWNER APPROVAL` / `BLOCKED`:**
   Approve running the 12 ordered migrations (`20261121000001` → `20261128000002`) against `dotpmdvxvmsrbzcmkqrp` (never `ycfasggikwwmxejhgawf` or production).
2. **Vercel Preview Env Var Configuration — `REQUIRES OWNER APPROVAL`:**
   Populate `dotpmdvxvmsrbzcmkqrp` credentials + `NEXT_PUBLIC_DEMO_MODE=false` + `SYSTEM_STATUS_TOKEN` in **Vercel Preview** only, and configure Auth `/auth/callback` URLs in `dotpmdvxvmsrbzcmkqrp`.
3. **Live 10-Step E2E Execution — `REQUIRES OWNER APPROVAL` / `BLOCKED`:**
   Authorize executing `scripts/live-staging-e2e.mjs` (disposable accounts A/B/C with `finally` admin cleanup) after migrations and Preview credentials are live.
4. **Repository Token Hygiene & Legal Sign-Off (from `fix/remaining-readiness`):**
   Revoke the token formerly in `.vercel/anonymous.json` in Vercel, inspect the 1 redacted historical Gitleaks finding locally (`gitleaks detect --source . --log-opts="--all" --verbose`), complete counsel review banners, and populate grievance officer fields before future launch.

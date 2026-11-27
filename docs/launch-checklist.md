# TripSplit Launch Checklist & Owner-Assisted Runtime Setup

Branch: `fix/remaining-readiness`  
Live Production URL (pre-merge `main`): `https://tripsplitter-delta.vercel.app/`  
Current Runtime Check (`GET https://tripsplitter-delta.vercel.app/api/system/status`, observed 2026-11-27): `HTTP 200` returning `"supabase": false`, `"supabaseServiceRole": false`, `"paymentGateway": false`.

Because required Supabase and payment credentials are not set in the local runtime or Vercel Production/Preview environments, **live two-account E2E execution is currently `blocked`**. Complete Steps 1–4 below before merging or launching.

---

## 1. Required Owner Security Actions (Pre-Deployment)

1. **Revoke exposed Vercel token:** Revoke the token previously stored locally in `.vercel/anonymous.json` inside your Vercel Account Tokens dashboard (`.vercel/` is now ignored via `.gitignore` and excluded from git index).
2. **Audit git history secret finding:** `gitleaks detect --source . --log-opts="--all"` reported **1 finding across 48 commits** (count only; value redacted). Rotate any token/key flagged in historical commits and inspect via `gitleaks detect --source . --log-opts="--all" --verbose` locally before public launch.
3. **Complete Legal & Grievance Officer Placeholders:** Have legal counsel review `/privacy`, `/terms`, `/refunds`, and `/contact` (`Draft — [TO BE REVIEWED BY COUNSEL BEFORE PUBLIC LAUNCH]`), and replace `[GRIEVANCE_OFFICER_NAME]`, `[GRIEVANCE_OFFICER_EMAIL]`, and `[RESPONSE_TIME_SLA]` in `src/app/refunds/page.tsx` and `src/app/contact/page.tsx`.

---

## 2. Exact Vercel Environment Variables (Production & Preview)

Configure these exact environment variable names in **Vercel → Project Settings → Environment Variables** for both **Production** and **Preview** (using isolated staging Supabase/Razorpay test keys for Preview, and separate live keys for Production):

| Variable | Exposure | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (`NEXT_PUBLIC_*`) | Production, Preview | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (`NEXT_PUBLIC_*`) | Production, Preview | Supabase anonymous/public key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Production, Preview | Privileged key for `/api/payments/webhook`, `/api/bookings/webhook`, and `/api/payments/refund` |
| `PAYMENT_PROVIDER_API_KEY` | **Server-only** | Production, Preview | Razorpay / gateway API key ID |
| `PAYMENT_PROVIDER_API_SECRET` | **Server-only** | Production, Preview | Razorpay / gateway API secret |
| `PAYMENT_PROVIDER_WEBHOOK_SECRET` | **Server-only** | Production, Preview | HMAC-SHA256 webhook verification secret for `/api/payments/webhook` |
| `BOOKING_PROVIDER_WEBHOOK_SECRET` | **Server-only** | Production, Preview | HMAC-SHA256 webhook verification secret for `/api/bookings/webhook` |
| `SYSTEM_STATUS_TOKEN` | **Server-only** | Production (optional Preview) | High-entropy random secret required in `X-Admin-Token` header for `GET /api/system/status` in `NODE_ENV=production` |
| `NEXT_PUBLIC_DEMO_MODE` | Public (`NEXT_PUBLIC_*`) | Set `'false'` | Ensures real Supabase auth and persistence instead of demo fallback |

Optional integrations: `OPENAI_API_KEY` / `GEMINI_API_KEY` (AI Travel Companion), `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (distributed rate limiting).

---

## 3. Supabase Migrations: Exact Apply Order & Commands

> [!IMPORTANT]
> Historical `20261122`, `20261126`, and `20261127` filenames in `supabase/migrations/` already exist on `main` and have inter-file ordering dependencies when initializing an **empty** database (for instance `20261122_security_hardening.sql` defines `is_trip_admin()`, `20261126_market_readiness_hardening.sql` creates `payment_refunds`, and `20261127_security_booking_webhook_remediation.sql` creates `booking_webhook_events`).

### Dependency-Safe Apply Order (`supabase/migrations/`)

Apply in this exact order on a **fresh** database; on an **already-migrated** database where items 1–10 are applied, items 11–12 apply cleanly at the end:

1. `20261121_complete_schema.sql`
2. `20261122_security_hardening.sql`
3. `20261122_final_backend_hardening.sql`
4. `20261125_ai_payments_bookings_hardening.sql`
5. `20261126_market_readiness_hardening.sql`
6. `20261126_95_market_readiness_final.sql`
7. `20261127_security_booking_webhook_remediation.sql`
8. `20261127_day7_refund_webhook_hardening.sql`
9. `20261127_phase8_complete_rls_and_webhook_hardening.sql`
10. `20261127_phase9_audit_remediations.sql`
11. `20261128000001_expense_splits_immutable_amounts.sql` *(new on this branch)*
12. `20261128000002_payment_webhook_transaction_rpc.sql` *(new on this branch)*

### Exact Commands

Against an already-migrated Supabase project (applies pending additive migrations):

```bash
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

Against a fresh empty Postgres database (respecting historical dependency order via `psql`):

```bash
for f in \
  supabase/migrations/20261121_complete_schema.sql \
  supabase/migrations/20261122_security_hardening.sql \
  supabase/migrations/20261122_final_backend_hardening.sql \
  supabase/migrations/20261125_ai_payments_bookings_hardening.sql \
  supabase/migrations/20261126_market_readiness_hardening.sql \
  supabase/migrations/20261126_95_market_readiness_final.sql \
  supabase/migrations/20261127_security_booking_webhook_remediation.sql \
  supabase/migrations/20261127_day7_refund_webhook_hardening.sql \
  supabase/migrations/20261127_phase8_complete_rls_and_webhook_hardening.sql \
  supabase/migrations/20261127_phase9_audit_remediations.sql \
  supabase/migrations/20261128000001_expense_splits_immutable_amounts.sql \
  supabase/migrations/20261128000002_payment_webhook_transaction_rpc.sql
do
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

---

## 4. Runtime Verification After Env Vars Are Set

1. Confirm unauthenticated `GET /api/system/status` returns **HTTP 404** in production:
   ```bash
   curl -i https://<your-domain>/api/system/status
   ```
2. Confirm authorized `GET /api/system/status` returns **HTTP 200** with `"supabase": true` (and booleans only):
   ```bash
   curl -sS -H "X-Admin-Token: $SYSTEM_STATUS_TOKEN" https://<your-domain>/api/system/status
   ```
   **Stop gate:** If `supabase` is not `true`, do not proceed to user E2E testing.

---

## 5. Two-Account E2E Verification Checklist (Status: Blocked Until Owner Env Setup)

| Step | Action | Expected Result | Current Status |
| --- | --- | --- | --- |
| 1 | Sign up Account A & Account B | Real Supabase Auth users + `profiles` rows created | **blocked** (no live Supabase env/tokens configured) |
| 2 | Account A creates a trip | `trips` + `trip_members` (`admin`) persisted in Supabase | **blocked** |
| 3 | Account A invites Account B; Account B accepts | Membership created with `member` role via `/api/trips/invitations/accept` | **blocked** |
| 4 | Add 3 expenses (equal, exact, percentage split) | Atomic `expenses` + integer-paise `expense_splits` rows created | **blocked** |
| 5 | Inspect settlement plan | Minimum-transfer ledger balances across all 3 expenses | **blocked** |
| 6 | Account B marks split paid (`manually_reported_paid`) | UI displays `"not verified"` / pending creditor confirmation; debtor cannot alter `amount_owed` or `amount_owed_paise` (enforced by trigger) | **blocked** |
| 7 | Export CSV ledger | Valid CSV downloaded matching persisted expenses and splits | **blocked** |

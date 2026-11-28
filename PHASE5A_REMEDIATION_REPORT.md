# TripSplitter / TripSplit — Phase 5A: Critical Migration Defect Remediation & Regression Audit Report

**Repository:** `https://github.com/ShubhBhattacharya/TripSpilter`  
**Base Branch:** `feature/phase4-staging-integration`  
**Base Commit SHA:** `5e2354c68f95f6e632d51a40945ef9bcd10b886c`  
**Remediation Branch:** `feature/phase5a-migration-defect-fixes`  
**Target Staging Database (Future Push Only — NOT Modified):** `dotpmdvxvmsrbzcmkqrp`

---

## 1. Safety Confirmation

- Zero SQL statements or migrations were executed against `dotpmdvxvmsrbzcmkqrp`, `ycfasggikwwmxejhgawf`, or any hosted database.
- Zero changes were made to Supabase settings, Auth settings, environment variables, Vercel configuration, `main`, or Production (`https://tripsplitter-delta.vercel.app/`).
- No secrets or credentials were exposed or requested.

---

## 2. Additive Migration & Files Changed

**New Additive Migration:** `supabase/migrations/20261128000003_auth_triggers_and_fk_safety.sql`  
**SHA-256 Checksum:** `90f1a01542d89b1b9e8c025777de90c2f223af5ea14b42aa9d23b9a74c8ce468`  
**Purpose:** Attach missing `auth.users` and `public.trips` triggers (F-01), resolve contradictory `expenses.paid_by` `ON DELETE SET NULL NOT NULL` (F-02), lock `SET search_path = public, pg_temp` across all 9 affected functions & revoke trigger RPC calls (F-03), guard `public.settlements` immutable columns via `BEFORE UPDATE` trigger (F-04), and add justified FK index `idx_trips_created_by` (F-05).

**Exact Modified / Added Files:**
- `supabase/migrations/20261128000003_auth_triggers_and_fk_safety.sql` *(new)*
- `src/lib/financial/split-engine.ts` *(nullable `RawExpense.paidBy: string | null` safe ledger handling)*
- `src/app/api/expenses/splits/[id]/route.ts` *(nullable `paid_by` creditor check & safe `recipientUserIds` array filtering)*
- `src/app/api/trips/[id]/members/route.ts` *(nullable `paid_by` mapping without `"null"` coercion)*
- `src/app/api/trips/[id]/settlements/route.ts` *(nullable `paidBy` mapping)*
- `src/app/trips/[id]/page.tsx` *(nullable `paid_by` TypeScript handling)*
- `src/lib/ai/tools.ts` *(nullable `paid_by` exclusion from `memberIds` set)*
- `src/lib/ai/tools-extended.ts` *(nullable `paid_by` mapping without `"null"` coercion)*
- `docs/launch-checklist.md` *(updated 13-migration chronological apply order)*
- `tests/phase2-recovery.test.ts` *(expanded ordered migration check from 12 to 13 migrations)*
- `tests/phase5a-remediation.test.ts` *(new static SQL + mocked API/ledger verification suite)*
- `PHASE5_MIGRATION_SAFETY_AUDIT.md` *(Phase 5 pre-remediation read-only report archived alongside Phase 5A)*
- `PHASE5A_REMEDIATION_REPORT.md` *(this report)*

---

## 3. Finding Status Summary (F-01 through F-05)

| ID | Summary | Status | Resolution & Runtime Caveat |
| --- | --- | --- | --- |
| **F-01** | Attach missing `on_auth_user_created` (`auth.users`) & `on_trip_created` (`public.trips`) `AFTER INSERT` triggers; harden `handle_new_user()` & `handle_new_trip_creator()` | **FIXED** (Static SQL Verified) / **NOT VERIFIED** (Live Postgres) | Idempotent `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` added in `20261128000003`; safe `display_name` fallback handles missing email/phone OTP (`'Traveler'`); errors propagate cleanly. Live `auth.users` trigger execution unverified until staging push. |
| **F-02** | Resolve `expenses.paid_by` `ON DELETE SET NULL NOT NULL` contradiction + verify TypeScript/API/engine nullable compatibility | **FIXED** (Static SQL + Mocked App Verified) / **NOT VERIFIED** (Live Postgres) | Drops `NOT NULL` via `ALTER TABLE public.expenses ALTER COLUMN paid_by DROP NOT NULL;` while RLS `INSERT` policy (`is_trip_member(trip_id) AND paid_by = auth.uid()`) & `create_expense_with_splits()` still forbid inserting `NULL` or arbitrary users. Updated 7 application files (`split-engine.ts`, `splits/[id]/route.ts`, `members/route.ts`, `settlements/route.ts`, `trips/[id]/page.tsx`, `ai/tools.ts`, `ai/tools-extended.ts`) to prevent `"null"` string keys and broken notification `UUID[]` arrays. |
| **F-03** | Audit every `SECURITY DEFINER` function (independent count: **13 pre-existing + 1 new = 14** total custom functions); enforce `public, pg_temp` + least-privilege grants | **FIXED** (Static SQL Verified) | Fixed all **9** legacy `SECURITY DEFINER` functions missing `, pg_temp` (`is_trip_member`, `is_trip_admin`, `handle_new_user`, `handle_new_trip_creator`, `create_expense_with_splits`, `dispatch_trip_notification`, `update_expense_with_splits`, `reserve_payment_refund`, `prevent_expense_splits_immutable_update`). Revoked direct `PUBLIC`/`anon`/`authenticated` `EXECUTE` on all 5 trigger functions while retaining minimal `authenticated` / `service_role` RPC grants. Supabase-managed event-trigger function `public.rls_auto_enable()` left untouched (Postgres rejects direct RPC calls to `event_trigger` functions). |
| **F-04** | Block debtors/clients from mutating `trip_id`, `from_user_id`, `to_user_id`, `amount`, or `amount_paise` on `public.settlements` | **FIXED** (Static SQL Verified) / **NOT VERIFIED** (Live Postgres) | Added `BEFORE UPDATE` trigger `trg_settlements_immutable_columns` calling `prevent_settlements_immutable_update()` (`SECURITY DEFINER SET search_path = public, pg_temp`, revoked from `PUBLIC`/`anon`/`authenticated`). Preserves `manually_reported_paid` and creditor `verified_paid` updates. |
| **F-05** | Selective foreign-key & index hygiene review | **FIXED** (1 justified index added; 7 FKs & 2 unique overlaps explicitly retained) | Added `CREATE INDEX IF NOT EXISTS idx_trips_created_by ON public.trips(created_by)` to serve `GET /api/trips`, `is_trip_admin()`, and `"Members view trips"` RLS. Omitted blind indexes on unused FKs (`vendor_split_members.verified_by`, `bookings.booked_by`, `receipt_uploads.*`, `ai_conversations.trip_id`, `payment_refunds.trip_id`, `booking_status_history.trip_id`) to avoid write overhead, and left historical indexes `idx_trip_invitations_code` and `idx_idempotency_lookup` untouched without destructive drops. |

---

## 4. Verification Results & Methodology Distinction

Every check below ran **after final code, migration, and test edits** on `feature/phase5a-migration-defect-fixes`:

| Check | Verification Type | Result | Observed Output |
| --- | --- | --- | --- |
| `npm run lint` | Static ESLint | **PASSED** | Exited `0` |
| `npx tsc --noEmit` | TypeScript compiler (verified nullable `paid_by` across all routes/UI) | **PASSED** | Exited `0` (caught and resolved nullable `creditorId` in `splits/[id]/route.ts`) |
| `npm test` (`vitest run`) | **Static SQL inspection + Mocked DB (`vi.mock`)** — *not live Postgres* | **PASSED** | `Test Files  20 passed (20)`, `Tests  159 passed (159)`, `0` failed, `0` skipped (`8.09s`) |
| `npm run build --webpack` | Production Next.js 16.4.6 webpack build | **PASSED** | Exited `0` (`Compiled successfully in 15.7s`, `40/40` static pages) |
| Real PostgreSQL Trigger / FK / RLS Execution | **Live Postgres runtime on `dotpmdvxvmsrbzcmkqrp`** | **NOT VERIFIED** | Not run per Phase 5A read-only DB rule (`supabase db push` awaits owner approval) |

---

## 5. Remaining Risks & Pre-Staging Considerations

1. **Historical `paid_by = NULL` Balance Math:** If a former payer account is deleted while other trip members remain active, setting `expenses.paid_by = NULL` preserves the expense audit row cleanly and `calculateNetBalances` safely ignores `null` instead of creating a phantom `"null"` user — however `isZeroSum` on active remaining members alone will reflect unattributed paid credit unless settled prior to deletion (`evaluateMemberRemovalSafety` already blocks trip leave with unsettled debts cleanly).
2. **Untested Live `auth.users` Trigger Permissions on Managed Supabase:** While `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users` is standard Supabase pattern via `supabase db push` / SQL Editor / MCP `apply_migration`, actual execution against `dotpmdvxvmsrbzcmkqrp` Postgres 17.12 remains `NOT VERIFIED` until owner approves staging execution.
3. **Owner Staging Config Prerequisites:** Configure `/auth/callback` Redirect URLs, confirm email confirmation mode for E2E testing, and populate **Vercel Preview-only** environment variables using `dotpmdvxvmsrbzcmkqrp` before Phase 6 live execution.

---

## 6. Next Action Required From Owner

Review `feature/phase5a-migration-defect-fixes` and explicitly confirm approval to:
1. Push/apply the **13** chronologically ordered migrations (`20261121000001` → `20261128000003`) to dedicated staging project **`dotpmdvxvmsrbzcmkqrp`**.
2. Run live post-migration verification queries and the 10-step staging E2E harness (`scripts/live-staging-e2e.mjs`) against `dotpmdvxvmsrbzcmkqrp`.

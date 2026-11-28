# TripSplitter / TripSplit — Phase 5: Staging Migration Pre-Execution Safety Audit

**Repository:** `https://github.com/ShubhBhattacharya/TripSpilter`  
**Audited Branch:** `feature/phase4-staging-integration`  
**Audited Commit SHA:** `5e2354c68f95f6e632d51a40945ef9bcd10b886c`  
**Target Staging Project Ref:** `dotpmdvxvmsrbzcmkqrp` (`TripSplitter-Staging` org `zgteowaybbtmelqnleqo`)  
**Audit Execution Mode:** Strictly read-only inspection (zero SQL executed, zero migrations run, zero env/DB/branch mutations; legacy project `ycfasggikwwmxejhgawf` and Production `https://tripsplitter-delta.vercel.app/` not accessed)  
**Classification Labels:** `VERIFIED` | `BLOCKED` | `NOT VERIFIED` | `REQUIRES OWNER APPROVAL`

---

## Final Audit Verdict: **`NOT SAFE — FIX REQUIRED`**

Static Vitest checks (`19 files / 153 tests`, mocked DB) passed on commit `5e2354c`, **but direct SQL inspection of all 12 migration files uncovered two blocking runtime defects** (missing auth/trip trigger attachment + contradictory `ON DELETE SET NULL NOT NULL` foreign key on `expenses.paid_by`) plus additional hardening items that **must be fixed in an additive pre-flight migration before executing migrations on `dotpmdvxvmsrbzcmkqrp`**.

---

## 1. Branch, Commit & SHA-256 Checksum Verification (`VERIFIED`)

| Order | File | SHA-256 Checksum (Observed) | Bytes | Matches Phase 4 Report |
| --- | --- | --- | --- | --- |
| 1 | `20261121000001_complete_schema.sql` | `c9eefbe808b1cd55140ae07d260cc83d05328da7ad85ad0313527bf73ec16ada` | 13,334 | `VERIFIED` |
| 2 | `20261122000001_security_hardening.sql` | `25cea3bf17e1dd5917edba3fe04b507f6a33031bad2ad4264d6159d5eaae127f` | 8,595 | `VERIFIED` |
| 3 | `20261122000002_final_backend_hardening.sql` | `6457ab90ce8526fd5c978e0dabdbd57623aa8f3e08c3bd7e634b703b2cce88d9` | 9,181 | `VERIFIED` |
| 4 | `20261125000001_ai_payments_bookings_hardening.sql` | `02950a86d5774c04a86fee0031c2c2763daebe8ac2c18eb872d25bf1c9d73222` | 8,048 | `VERIFIED` |
| 5 | `20261126000001_market_readiness_hardening.sql` | `b96523fa1f35c1a8bfbe636a86194c9d8f4137b8eb2e4118db419d0b7905066d` | 12,276 | `VERIFIED` |
| 6 | `20261126000002_95_market_readiness_final.sql` | `7d0b1d6ea1dc358e3ef054bf01c1a98869ee4f5efed0da8dbfce8812fd0d55dd` | 12,405 | `VERIFIED` |
| 7 | `20261127000001_security_booking_webhook_remediation.sql` | `9b5794980b0b2d4fb716a060e1676708d81ed9eaf5095fa5378b3b30cd5c76bb` | 2,156 | `VERIFIED` |
| 8 | `20261127000002_day7_refund_webhook_hardening.sql` | `e200244e3347ac972ad46d3ed23c9b70be0061cce5c4a7cc9d4120b53390d094` | 6,515 | `VERIFIED` |
| 9 | `20261127000003_phase8_complete_rls_and_webhook_hardening.sql` | `073d8b04a87b1a194472cc266d6986b01067df4456930c5d958d3524d5cedd40` | 13,580 | `VERIFIED` |
| 10 | `20261127000004_phase9_audit_remediations.sql` | `4604c8cff45f38daf67deb13610f653961f31d669d12b3f4097684bea739d937` | 5,475 | `VERIFIED` |
| 11 | `20261128000001_expense_splits_immutable_amounts.sql` | `e391ca338d50caf939964c44bc8efcaa458fd8d6740e5dc3b4d43fada00deab8` | 1,018 | `VERIFIED` |
| 12 | `20261128000002_payment_webhook_transaction_rpc.sql` | `7a133819a5f8618f50f4a62132f64a8ab838b1783f0111c36a9e3d31c7b0099b` | 9,966 | `VERIFIED` |

---

## 2. Target Staging Project Identity (`dotpmdvxvmsrbzcmkqrp`) (`VERIFIED`)

Checked read-only via `get_project`, `list_migrations`, `list_tables(schemas: ["public"])`, `get_advisors(security)`, `get_advisors(performance)` without running SQL queries:

- **Ref / Name / Org:** `dotpmdvxvmsrbzcmkqrp` / `ShubhBhattacharya's Project` / `TripSplitter-Staging` (`zgteowaybbtmelqnleqo`) — `VERIFIED`
- **Region / Health / Engine:** `ap-south-1` / `ACTIVE_HEALTHY` / Postgres `17.12.0.002` — `VERIFIED`
- **Current Public Schema:** `0` tables (`tables: []`), `0` migrations (`migrations: []`) — `VERIFIED`
- **Advisors:** `performance`: `0` lints; `security`: `2` template warnings (`0028`/`0029`) on built-in `public.rls_auto_enable()` (`anon`/`authenticated` `SECURITY DEFINER` execute grant). — `VERIFIED`

---

## 3. Independent SQL & Security Safety Findings

### Critical Blocking Findings (Fix Required Before Execution)

| ID | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| **F-01** | **CRITICAL (Blocker)** | `20261122000001_security_hardening.sql:43-80` & entire 12-file migration set | **`on_auth_user_created` and `on_trip_created` triggers are never created.** `handle_new_user()` and `handle_new_trip_creator()` functions are defined, but zero migration runs `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users` or `CREATE TRIGGER on_trip_created AFTER INSERT ON public.trips`. Live Supabase Auth signups will create `auth.users` rows with **no corresponding `public.profiles` row**, causing every `trips`, `trip_members`, `expenses`, `settlements`, `bookings`, and `user_preferences` insert to fail with FK violation `23503`. | `VERIFIED` Defect |
| **F-02** | **CRITICAL (Blocker)** | `20261121000001_complete_schema.sql:65` | **Contradictory `ON DELETE SET NULL NOT NULL` on `public.expenses.paid_by`.** Deleting any user (`auth.users` -> `profiles` cascade, including E2E cleanup `admin.auth.admin.deleteUser()`) who has created an expense triggers `ON DELETE SET NULL` against a `NOT NULL` column, failing with PostgreSQL `23502`. Must drop `NOT NULL` on `expenses.paid_by` (while keeping `paid_by = auth.uid()` enforced on `INSERT` via RLS/RPC) or adjust delete semantics before staging tests. | `VERIFIED` Defect |

### High & Moderate Security / Integrity Findings

| ID | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| **F-03** | **HIGH** | `20261122000001`–`20261128000001` | **`pg_temp` omitted from `SET search_path` on 8 `SECURITY DEFINER` functions + missing `REVOKE ALL` on trigger/template functions.** `is_trip_member`, `is_trip_admin`, `handle_new_user`, `handle_new_trip_creator`, `create_expense_with_splits`, `dispatch_trip_notification`, `update_expense_with_splits`, `reserve_payment_refund`, and `prevent_expense_splits_immutable_update` use `SET search_path = public` rather than `public, pg_temp`. Also, `prevent_last_trip_admin_loss()`, trigger helper functions, and template `public.rls_auto_enable()` lack `REVOKE ALL FROM PUBLIC, anon, authenticated`. | `VERIFIED` Finding |
| **F-04** | **MEDIUM/HIGH** | `20261122000001_security_hardening.sql:206-214` | **`public.settlements` Debtor UPDATE policy lacks immutable column trigger.** Policy `"Debtors can report settlements paid"` restricts only `status IN ('payment_initiated', 'manually_reported_paid', 'failed')` without a `BEFORE UPDATE` trigger blocking debtors from modifying `trip_id`, `from_user_id`, `to_user_id`, `amount`, or `amount_paise` (unlike `expense_splits`, which is guarded in Migration #11). | `VERIFIED` Finding |
| **F-05** | **LOW/MEDIUM** | `20261121000001`, `20261125000001`, `20261126000001`, `20261126000002` | **Unindexed Foreign Keys & Redundant Indexes.** FKs lacking covering indexes: `trips.created_by`, `vendor_split_members.verified_by`, `bookings.booked_by`, `receipt_uploads.trip_id`, `receipt_uploads.expense_id`, `ai_conversations.trip_id`, `payment_refunds.trip_id`, `booking_status_history.trip_id`. Redundant indexes duplicating `UNIQUE` constraints: `idx_trip_invitations_code`, `idx_idempotency_lookup`. | `VERIFIED` Finding |

### Passed Static Security & Compatibility Checks (`VERIFIED`)

- **Migration Ordering & FKs (`VERIFIED`):** Across migrations 1–12 in timestamp order, every table/column/function referenced in `ALTER TABLE`, `REFERENCES`, `CREATE POLICY`, or SQL RPCs exists beforehand (`missingAlter = 0`, `missingFk = 0`).
- **Destructive Operations (`VERIFIED`):** Zero `DROP TABLE`, `TRUNCATE`, or `DROP COLUMN` statements. The sole `DELETE FROM` is `WHERE expense_id = p_expense_id` inside atomic `update_expense_with_splits()`.
- **RLS Coverage (`VERIFIED`):** All **27 / 27** `public` tables have `ENABLE ROW LEVEL SECURITY`. **25** tables define explicit `TO authenticated` policies (using `auth.uid()`, `is_trip_member()`, `is_trip_admin()`); **2** webhook audit tables (`payment_webhook_events`, `booking_webhook_events`) intentionally have **zero client policies** (`service_role` only). Zero `anon` policies exist.
- **No Conflicting/Orphan Policies (`VERIFIED`):** Every modified policy is preceded by `DROP POLICY IF EXISTS` on the exact policy name before `CREATE POLICY`.
- **`expense_splits` Trigger vs `update_expense_with_splits()` Compatibility (`VERIFIED`):** `update_expense_with_splits()` deletes and re-inserts splits rather than calling `UPDATE`, so `trg_expense_splits_immutable_columns` (`BEFORE UPDATE`) does not block legitimate admin/payer expense edits.
- **Payment Webhook Atomicity (`VERIFIED` Static):** Migration #12 `process_payment_webhook()` restricts execution exclusively to `service_role`, reclaims stale `'processing'` events (`> 300s`), validates captured payment currency/amount, updates `payment_orders`/`expense_splits`/`payment_refunds`/`payment_webhook_events` atomically in one transaction. *(Runtime Postgres verification `NOT VERIFIED` until applied.)*

---

## 4. Pre-Execution Staging Migration Plan (After Fixing F-01 & F-02)

### Recommended Required Pre-Flight Fix (`REQUIRES OWNER APPROVAL`)
Before applying to `dotpmdvxvmsrbzcmkqrp`, add `supabase/migrations/20261128000003_auth_triggers_and_fk_safety.sql` (and optionally settlements immutability + `pg_temp` search_path hardening + `REVOKE ALL` on trigger/`rls_auto_enable`):
1. `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`
2. `DROP TRIGGER IF EXISTS on_trip_created ON public.trips; CREATE TRIGGER on_trip_created AFTER INSERT ON public.trips FOR EACH ROW EXECUTE FUNCTION public.handle_new_trip_creator();`
3. `ALTER TABLE public.expenses ALTER COLUMN paid_by DROP NOT NULL;` (resolves `ON DELETE SET NULL NOT NULL` contradiction).
4. `ALTER FUNCTION ... SET search_path = public, pg_temp;` for the 8 legacy functions + `REVOKE ALL FROM PUBLIC, anon, authenticated` on trigger functions and `public.rls_auto_enable()`.

### Execution Sequence (Migrations 1 → 12 + New #13)
1. **Pre-Migration Backup:** Because `dotpmdvxvmsrbzcmkqrp` currently has `0` tables and `0` user rows (`VERIFIED`), baseline snapshot is trivial (`pg_dump --schema-only` or dashboard restore point). Once data exists, always take a logical backup before further pushes.
2. **Exact Apply Order:** Strictly chronological `20261121000001` → `20261128000002` (+ `20261128000003` fix):
   ```bash
   supabase link --project-ref dotpmdvxvmsrbzcmkqrp
   supabase db push --dry-run
   supabase db push
   ```
3. **Expected Schema Result:** **27** `public` tables, **13** custom functions/RPCs (`is_trip_member`, `is_trip_admin`, `handle_new_user`, `handle_new_trip_creator`, `create_expense_with_splits`, `dispatch_trip_notification`, `update_expense_with_splits`, `reserve_payment_refund`, `finalize_payment_refund`, `accept_trip_invitation`, `prevent_last_trip_admin_loss`, `prevent_expense_splits_immutable_update`, `process_payment_webhook`), **4** active triggers (`on_auth_user_created`, `on_trip_created`, `trg_prevent_last_trip_admin_loss`, `trg_expense_splits_immutable_columns`).
4. **Post-Migration Verification SQL (Read-Only Checks to Run After Push):**
   ```sql
   SELECT COUNT(*) AS table_count FROM pg_tables WHERE schemaname = 'public';
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;
   SELECT trigger_schema, trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_schema IN ('public', 'auth') ORDER BY 1, 3, 2;
   SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
   ```
5. **Rollback Limitations & Recovery Strategy:** PostgreSQL executes each migration file in a transaction cleanly (if any file fails, that file rolls back automatically — **except** cross-migration partial completion leaves earlier migrations committed). On a clean disposable staging DB like `dotpmdvxvmsrbzcmkqrp`, rollback after partial multi-file failure is via restoring the pre-migration snapshot or resetting/re-pushing from scratch rather than maintaining destructive down-scripts.

---

## 5. Manual Interventions & Configuration Prerequisites (`REQUIRES OWNER APPROVAL`)

1. **Supabase Auth Redirect URLs (`dotpmdvxvmsrbzcmkqrp` → Authentication → URL Configuration):** Configure `http://localhost:3000/auth/callback` and Vercel Preview `https://*-shubhdgi12-8206s-projects.vercel.app/auth/callback`.
2. **Supabase Auth Email Confirmation Setting (Staging):** Verify whether `"Confirm email"` is enabled in `dotpmdvxvmsrbzcmkqrp`. `scripts/live-staging-e2e.mjs` calls client `auth.signUp()` immediately followed by `signInWithPassword()`, which fails with `"Email not confirmed"` unless either Email Confirmations are disabled on staging OR `admin.auth.admin.createUser({ email_confirm: true })` is used for E2E setup.
3. **Vercel Preview Env Vars:** Populate `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_DEMO_MODE=false`, and `SYSTEM_STATUS_TOKEN` in **Preview** scope only.

---

## 6. Repository Code Verification Status (`VERIFIED` Prior to This Audit File)

No source code, migration SQL, or test files were altered since commit `5e2354c` (only this markdown audit report `PHASE5_MIGRATION_SAFETY_AUDIT.md` was added per Deliverable instruction). Observed results on commit `5e2354c`:
- `npm run lint` (`eslint`): **`VERIFIED`** (exit `0`)
- `npx tsc --noEmit`: **`VERIFIED`** (exit `0`)
- `npm test` (`vitest run`): **`VERIFIED`** (`19` test files, `153` tests passed, mocked DB — live Postgres writes `NOT VERIFIED`)
- `npm run build --webpack`: **`VERIFIED`** (exit `0`, `40/40` static pages)

#!/usr/bin/env node
/**
 * TripSplitter — Live Staging End-to-End Integration Test Harness (10 Workflows)
 *
 * SAFETY GUARD:
 * - Never runs against production (`tripsplitter-delta.vercel.app`) or unapproved Supabase refs.
 * - Requires dedicated staging credentials and explicit owner approval flag:
 *   STAGING_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   SUPABASE_SERVICE_ROLE_KEY (for cleanup only), ALLOW_STAGING_SUPABASE_EXECUTION=I_APPROVE_STAGING_E2E
 */

import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const REQUIRED_ENV = [
  'STAGING_BASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function checkPreflight() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k] || process.env[k].includes('your-'));
  if (missing.length > 0) {
    console.error(`BLOCKED: Missing staging environment variables: ${missing.join(', ')}`);
    process.exit(2);
  }
  if (process.env.ALLOW_STAGING_SUPABASE_EXECUTION !== 'I_APPROVE_STAGING_E2E') {
    console.error('BLOCKED: Set ALLOW_STAGING_SUPABASE_EXECUTION=I_APPROVE_STAGING_E2E after owner approval.');
    process.exit(2);
  }
  const baseUrl = process.env.STAGING_BASE_URL;
  if (baseUrl.includes('tripsplitter-delta.vercel.app')) {
    console.error('ABORTED: Refusing to run E2E harness against production URL.');
    process.exit(3);
  }
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supaUrl.includes('ycfasggikwwmxejhgawf')) {
    console.error('ABORTED: Refusing to run E2E harness against legacy project ycfasggikwwmxejhgawf.');
    process.exit(3);
  }
  if (!supaUrl.includes('dotpmdvxvmsrbzcmkqrp') && process.env.ALLOW_ALT_STAGING_REF !== 'true') {
    console.error('BLOCKED: Set NEXT_PUBLIC_SUPABASE_URL to verified staging ref dotpmdvxvmsrbzcmkqrp (or ALLOW_ALT_STAGING_REF=true).');
    process.exit(2);
  }
}

async function runLiveE2E() {
  checkPreflight();

  const baseUrl = process.env.STAGING_BASE_URL.replace(/\/$/, '');
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const admin = createClient(supaUrl, serviceKey);
  const runId = Date.now().toString(36);
  const pass = `Staging!${runId}Aa1`;

  const users = {
    a: { email: `e2e-a-${runId}@example.com`, id: '', token: '' },
    b: { email: `e2e-b-${runId}@example.com`, id: '', token: '' },
    c: { email: `e2e-c-${runId}@example.com`, id: '', token: '' },
  };

  try {
    // 1. User signup and login (User A, User B, User C outsider)
    for (const key of ['a', 'b', 'c']) {
      const client = createClient(supaUrl, anonKey);
      const { data: signedUp, error: signErr } = await client.auth.signUp({
        email: users[key].email,
        password: pass,
      });
      assert.ifError(signErr);
      assert.ok(signedUp.user?.id, `User ${key} signup failed`);
      users[key].id = signedUp.user.id;
      const { data: loggedIn, error: loginErr } = await client.auth.signInWithPassword({
        email: users[key].email,
        password: pass,
      });
      assert.ifError(loginErr);
      assert.ok(loggedIn.session?.access_token, `User ${key} login session missing`);
      users[key].token = loggedIn.session.access_token;
    }
    console.log('PASS [1/10] User signup and login verified');

    // 2. Session persistence and logout (verify persistence, then signOut revokes session on isolated client)
    const sessionCheckClient = createClient(supaUrl, anonKey);
    const { data: sessionLogin, error: sessionLoginErr } = await sessionCheckClient.auth.signInWithPassword({
      email: users.a.email,
      password: pass,
    });
    assert.ifError(sessionLoginErr);
    assert.ok(sessionLogin.session?.access_token);
    const { data: persistedUser } = await sessionCheckClient.auth.getUser(sessionLogin.session.access_token);
    assert.equal(persistedUser.user?.id, users.a.id);
    const { error: signOutErr } = await sessionCheckClient.auth.signOut();
    assert.ifError(signOutErr);
    const { data: postLogoutSession } = await sessionCheckClient.auth.getSession();
    assert.equal(postLogoutSession.session, null);
    console.log('PASS [2/10] Session persistence and logout verified');

    const clientA = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${users.a.token}` } },
    });

    // 3. Profile creation and updates
    const { data: profileRow, error: profFetchErr } = await clientA
      .from('profiles')
      .select('id, display_name, upi_id')
      .eq('id', users.a.id)
      .single();
    assert.ifError(profFetchErr);
    assert.equal(profileRow.id, users.a.id);
    const { error: profUpdErr } = await clientA
      .from('profiles')
      .update({ display_name: 'Staging Lead A', upi_id: 'staginga@okicici' })
      .eq('id', users.a.id);
    assert.ifError(profUpdErr);
    console.log('PASS [3/10] Profile auto-creation and update verified');

    // 4. Trip creation and retrieval
    const { data: trip, error: tripErr } = await clientA
      .from('trips')
      .insert({
        title: `Staging Trip ${runId}`,
        destination: 'Manali',
        start_date: '2026-12-10',
        end_date: '2026-12-14',
        budget: 18000,
        created_by: users.a.id,
      })
      .select()
      .single();
    assert.ifError(tripErr);
    assert.ok(trip?.id);
    console.log('PASS [4/10] Trip creation and retrieval verified');

    // 5. Trip invitations and membership
    const inviteCode = `TS-${runId.toUpperCase()}`;
    const { error: invErr } = await clientA.from('trip_invitations').insert({
      trip_id: trip.id,
      invited_by: users.a.id,
      invite_code: inviteCode,
      email: users.b.email,
      role: 'member',
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    assert.ifError(invErr);
    const clientB = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${users.b.token}` } },
    });
    const { data: accepted, error: accErr } = await clientB.rpc('accept_trip_invitation', {
      p_invite_code: inviteCode,
    });
    assert.ifError(accErr);
    assert.equal(accepted.tripId, trip.id);
    console.log('PASS [5/10] Trip invitation creation & acceptance verified');

    // 6. Expense creation and splitting (equal 1000 + exact/custom)
    const { data: expData, error: expErr } = await clientA.rpc('create_expense_with_splits', {
      p_trip_id: trip.id,
      p_vendor_name: 'Cafe Manali',
      p_vendor_upi_id: 'cafemanali@okaxis',
      p_total_amount: 1000,
      p_total_amount_paise: 100000,
      p_split_type: 'EQUAL',
      p_notes: 'E2E dinner',
      p_splits: [
        { userId: users.a.id, amountOwed: 500, amountOwedPaise: 50000 },
        { userId: users.b.id, amountOwed: 500, amountOwedPaise: 50000 },
      ],
      p_idempotency_key: `e2e-exp-${runId}`,
    });
    assert.ifError(expErr);
    assert.ok(expData?.expense?.id);
    console.log('PASS [6/10] Expense creation and splits RPC verified');

    // 7. Settlement calculations & persistence
    const { data: settlementRow, error: settErr } = await clientB
      .from('settlements')
      .insert({
        trip_id: trip.id,
        from_user_id: users.b.id,
        to_user_id: users.a.id,
        amount: 500,
        amount_paise: 50000,
        status: 'manually_reported_paid',
      })
      .select()
      .single();
    assert.ifError(settErr);
    assert.equal(settlementRow.status, 'manually_reported_paid');
    console.log('PASS [7/10] Settlement persistence verified');

    // 8. Booking creation
    const { data: bookingRow, error: bookErr } = await clientA
      .from('bookings')
      .insert({
        trip_id: trip.id,
        title: 'Snow Valley Stay',
        vendor_name: 'Snow Valley Resorts',
        category: 'Hotel',
        amount: 4500,
        amount_paise: 450000,
        status: 'Draft',
        booked_by: users.a.id,
      })
      .select()
      .single();
    assert.ifError(bookErr);
    assert.equal(bookingRow.status, 'Draft');
    console.log('PASS [8/10] Booking creation verified');

    // 9. User preferences
    const { data: prefRow, error: prefErr } = await clientA
      .from('user_preferences')
      .upsert({ user_id: users.a.id, preferred_language: 'hi', email_notifications: false })
      .select()
      .single();
    assert.ifError(prefErr);
    assert.equal(prefRow.preferred_language, 'hi');
    console.log('PASS [9/10] User preferences verified');

    // 10. Cross-user authorization and RLS (User C outsider cannot see trip or expenses; User B cannot escalate role)
    const clientC = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${users.c.token}` } },
    });
    const { data: cTrips } = await clientC.from('trips').select('id').eq('id', trip.id);
    assert.equal((cTrips || []).length, 0, 'Outsider User C must not view User A trip via RLS');
    const { data: cExpenses } = await clientC.from('expenses').select('id').eq('trip_id', trip.id);
    assert.equal((cExpenses || []).length, 0, 'Outsider User C must not view expenses via RLS');
    const { error: selfEscalateErr } = await clientB
      .from('trip_members')
      .update({ role: 'admin' })
      .eq('trip_id', trip.id)
      .eq('user_id', users.b.id);
    assert.ok(selfEscalateErr, 'Non-admin User B must not self-escalate to admin');

    // Optional HTTP check against preview baseUrl
    const statusRes = await fetch(`${baseUrl}/api/system/status`).catch(() => null);
    console.log(`PASS [10/10] Cross-user RLS verified (preview status HTTP=${statusRes ? statusRes.status : 'skipped'})`);
  } finally {
    // Clean up test accounts & cascading staging test data
    for (const u of Object.values(users)) {
      if (u.id) {
        await admin.auth.admin.deleteUser(u.id).catch(() => {});
      }
    }
  }
}

runLiveE2E().catch((err) => {
  console.error('LIVE E2E FAILED:', err);
  process.exit(1);
});

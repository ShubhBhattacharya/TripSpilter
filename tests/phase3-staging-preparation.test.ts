import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/supabase/client', () => ({
  isSupabaseConfigured: false,
  createClient: () => {
    throw new Error('Not configured');
  },
}));

vi.mock('../src/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('Not configured');
  },
}));

import { POST as createTrip } from '../src/app/api/trips/route';
import { GET as getExpenses, POST as createExpense } from '../src/app/api/expenses/route';
import { PATCH as patchSplit } from '../src/app/api/expenses/splits/[id]/route';

describe('Phase 3: Safe Fail-Closed API Persistence & Reproducible Staging E2E Harness Verification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails closed with 503 on unconfigured trip, expense, and split mutation routes unless NEXT_PUBLIC_DEMO_MODE=true', async () => {
    const tripRes = await createTrip(
      new Request('http://localhost/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Manali Staging Check',
          destination: 'Manali',
          startDate: '2026-12-01',
          endDate: '2026-12-05',
          budget: 15000,
        }),
      })
    );
    expect(tripRes.status).toBe(503);

    const getExpRes = await getExpenses(
      new Request('http://localhost/api/expenses?tripId=33333333-3333-4333-8333-333333333333')
    );
    expect(getExpRes.status).toBe(503);

    const postExpRes = await createExpense(
      new Request('http://localhost/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: '33333333-3333-4333-8333-333333333333',
          vendorName: 'Cafe',
          vendorUpiId: 'cafe@okaxis',
          totalAmount: 100,
          splitType: 'EQUAL',
          splits: [{ userId: '11111111-1111-4111-8111-111111111111', amountOwed: 100 }],
        }),
      })
    );
    expect(postExpRes.status).toBe(503);

    const patchSplitRes = await patchSplit(
      new Request('http://localhost/api/expenses/splits/44444444-4444-4444-8444-444444444444', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'manually_reported_paid' }),
      }),
      { params: Promise.resolve({ id: '44444444-4444-4444-8444-444444444444' }) }
    );
    expect(patchSplitRes.status).toBe(503);

    // Explicit NEXT_PUBLIC_DEMO_MODE=true continues operating in isolated demo mode cleanly
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    const demoTripRes = await createTrip(
      new Request('http://localhost/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Manali Demo Check',
          destination: 'Manali',
          startDate: '2026-12-01',
          endDate: '2026-12-05',
          budget: 15000,
        }),
      })
    );
    expect(demoTripRes.status).toBe(201);
    expect((await demoTripRes.json()).isDemo).toBe(true);
  });

  it('provides a reproducible 10-step live staging E2E harness that blocks execution without staging env and owner approval', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/live-staging-e2e.mjs');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const src = fs.readFileSync(scriptPath, 'utf8');

    for (const marker of [
      'PASS [1/10]',
      'PASS [2/10]',
      'PASS [3/10]',
      'PASS [4/10]',
      'PASS [5/10]',
      'PASS [6/10]',
      'PASS [7/10]',
      'PASS [8/10]',
      'PASS [9/10]',
      'PASS [10/10]',
      'ycfasggikwwmxejhgawf',
      'tripsplitter-delta.vercel.app',
    ]) {
      expect(src).toContain(marker);
    }

    const res = spawnSync(process.execPath, [scriptPath], {
      env: { ...process.env, STAGING_BASE_URL: '', NEXT_PUBLIC_SUPABASE_URL: '' },
      encoding: 'utf8',
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('BLOCKED:');
  });
});

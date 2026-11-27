import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET as getSystemStatus } from '../src/app/api/system/status/route';

describe('Item 3: Gated /api/system/status endpoint', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-non-placeholder';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses crypto.timingSafeEqual for admin token comparison', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/system/status/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/timingSafeEqual/);
  });

  it('returns 404 in production when X-Admin-Token is missing, wrong, or SYSTEM_STATUS_TOKEN is unset', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.SYSTEM_STATUS_TOKEN = 'super-secret-admin-status-token-123';

    const noHeaderRes = await getSystemStatus(new Request('http://localhost/api/system/status'));
    expect(noHeaderRes.status).toBe(404);

    const wrongRes = await getSystemStatus(
      new Request('http://localhost/api/system/status', {
        headers: { 'x-admin-token': 'wrong-token' },
      })
    );
    expect(wrongRes.status).toBe(404);

    delete process.env.SYSTEM_STATUS_TOKEN;
    const unsetTokenRes = await getSystemStatus(
      new Request('http://localhost/api/system/status', {
        headers: { 'x-admin-token': 'super-secret-admin-status-token-123' },
      })
    );
    expect(unsetTokenRes.status).toBe(404);
  });

  it('returns 200 with booleans only in production when X-Admin-Token matches SYSTEM_STATUS_TOKEN', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.SYSTEM_STATUS_TOKEN = 'super-secret-admin-status-token-123';

    const res = await getSystemStatus(
      new Request('http://localhost/api/system/status', {
        headers: { 'X-Admin-Token': 'super-secret-admin-status-token-123' },
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.supabase).toBe(true);
    expect(Object.keys(json).length).toBeGreaterThan(0);
    for (const [key, val] of Object.entries(json)) {
      expect(typeof val, `Expected ${key} to be boolean`).toBe('boolean');
    }
  });

  it('returns 200 with booleans only in non-production environments', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const res = await getSystemStatus(new Request('http://localhost/api/system/status'));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.supabase).toBe(true);
    for (const [key, val] of Object.entries(json)) {
      expect(typeof val, `Expected ${key} to be boolean`).toBe('boolean');
    }
  });
});

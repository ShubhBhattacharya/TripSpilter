import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();

describe('Item 8: Launch checklist & remaining-readiness documentation', () => {
  it('documents required Vercel Production/Preview env vars and ordered migrations in docs/launch-checklist.md', () => {
    const checklistPath = path.join(ROOT, 'docs', 'launch-checklist.md');
    expect(fs.existsSync(checklistPath)).toBe(true);
    const md = fs.readFileSync(checklistPath, 'utf8');

    for (const key of [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PAYMENT_PROVIDER_API_KEY',
      'PAYMENT_PROVIDER_API_SECRET',
      'PAYMENT_PROVIDER_WEBHOOK_SECRET',
      'SYSTEM_STATUS_TOKEN',
      '20261128000001_expense_splits_immutable_amounts.sql',
      '20261128000002_payment_webhook_transaction_rpc.sql',
    ]) {
      expect(md, `Missing ${key} in docs/launch-checklist.md`).toContain(key);
    }
    expect(md).toContain('supabase db push');
  });

  it('documents every item status, test file, and blocker accurately without readiness percentages in docs/remaining-readiness.md', () => {
    const reportPath = path.join(ROOT, 'docs', 'remaining-readiness.md');
    expect(fs.existsSync(reportPath)).toBe(true);
    const md = fs.readFileSync(reportPath, 'utf8');

    for (const item of [
      'item1-expense-splits-trigger.test.ts',
      'item2-payment-webhook-atomic.test.ts',
      'item3-system-status-gate.test.ts',
      'item4-repo-hygiene.test.ts',
      'item5-legal-pages.test.ts',
      'item6-copy-brand-standard.test.ts',
      'item7-ci-reconcile.test.ts',
      'blocked',
    ]) {
      expect(md, `Missing ${item} in docs/remaining-readiness.md`).toContain(item);
    }
    expect(md).not.toMatch(/readiness\s*:\s*\d+%/i);
  });
});

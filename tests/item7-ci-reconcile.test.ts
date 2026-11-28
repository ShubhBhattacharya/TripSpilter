import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();

describe('Item 7: Linux CI workflow and baseline test count reconciliation', () => {
  it('configures .github/workflows/ci.yml on ubuntu-latest with ci, lint, typecheck, test, and webpack build', () => {
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain('runs-on: ubuntu-latest');
    expect(ci).toContain('npm ci');
    expect(ci).toContain('npm run lint');
    expect(ci).toContain('npx tsc --noEmit');
    expect(ci).toContain('npm test');
    expect(ci).toContain('npm run build --webpack');
  });

  it('documents SYSTEM_STATUS_TOKEN in .env.example', () => {
    const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
    expect(envExample).toMatch(/^SYSTEM_STATUS_TOKEN=/m);
  });
});

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();

describe('Item 4: Repository hygiene, .gitignore, and LF .gitattributes', () => {
  it('defines .gitattributes with * text=auto eol=lf', () => {
    const attrPath = path.join(ROOT, '.gitattributes');
    expect(fs.existsSync(attrPath)).toBe(true);
    const content = fs.readFileSync(attrPath, 'utf8');
    expect(content).toMatch(/^\*\s+text=auto\s+eol=lf$/m);
  });

  it('ignores .vercel/, .next/, temp_office_extract/, tsconfig.tsbuildinfo, report.pdf, and TripSpilter/ in .gitignore', () => {
    const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    const lines = gitignore.split(/\r?\n/).map((l) => l.trim());
    for (const required of [
      '.vercel/',
      '.next/',
      'temp_office_extract/',
      'tsconfig.tsbuildinfo',
      'report.pdf',
      'TripSpilter/',
    ]) {
      expect(lines, `.gitignore missing ${required}`).toContain(required);
    }
  });

  it('tracks zero excluded artifact or secret files in git index', () => {
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
    const forbidden = tracked.filter((f) =>
      /^(\.vercel\/|\.next\/|temp_office_extract\/|TripSpilter\/|tsconfig\.tsbuildinfo$|report\.pdf$)/.test(f)
    );
    expect(forbidden).toEqual([]);
  });
});

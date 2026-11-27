import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

vi.mock('../src/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    signOut: async () => {},
  }),
}));

const SRC_ROOT = path.resolve(process.cwd(), 'src');

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Item 6: Standardized TripSplit brand, honest copy, estimates, and external link labels', () => {
  it('contains zero banned phrases or legacy TripSplitter brand names across src/', () => {
    const files = collectSourceFiles(SRC_ROOT);
    const bannedPatterns: Array<{ name: string; regex: RegExp }> = [
      { name: 'Zero-Escrow / Zero Escrow', regex: /zero[- ]escrow/i },
      { name: 'Wallet Float', regex: /(0%|no|zero)\s+wallet\s+float|wallet\s+float/i },
      { name: 'Zero Wallet Escrow', regex: /zero\s+wallet\s+escrow/i },
      { name: 'Zero Float Risk', regex: /zero\s+float\s+risk/i },
      { name: 'verified down to ₹0.01', regex: /verified down to ₹0\.01/i },
      { name: 'Live Rates button copy', regex: /Live Rates/ },
      { name: 'TripSplitter brand', regex: /\bTripSplitter\b/ },
    ];

    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(process.cwd(), file);
      const content = fs.readFileSync(file, 'utf8');
      for (const { name, regex } of bannedPatterns) {
        if (regex.test(content)) {
          violations.push(`${rel} matched ${name}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('uses "tripsplit" in package.json and sets TripSplit title + openGraph tags in layout.tsx', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
    ) as { name: string };
    expect(pkg.name).toBe('tripsplit');

    const layoutSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/layout.tsx'),
      'utf8'
    );
    expect(layoutSrc).toContain('TripSplit');
    expect(layoutSrc).toMatch(/openGraph\s*:\s*\{/);
  });

  it('hides Insurance (Soon) tab, replaces Live Rates with Search hotels (external), and labels Est. prices as Indicative estimate with review date', async () => {
    const { TravelTopNav } = await import('../src/components/portal/TravelTopNav');
    const navHtml = renderToStaticMarkup(
      React.createElement(TravelTopNav, {
        activeCategory: 'hotels',
        onSelectCategory: () => {},
        wishlistCount: 0,
        wishlistDestinations: [],
        onRemoveWishlist: () => {},
      })
    );
    expect(navHtml).not.toContain('Insurance');
    expect(navHtml).not.toContain('>Soon<');
    expect(navHtml).toContain('TripSplit');
    expect(navHtml).not.toContain('TripSplitter');

    const { StaysAndPartnersSection } = await import(
      '../src/components/portal/StaysAndPartnersSection'
    );
    const staysHtml = renderToStaticMarkup(
      React.createElement(StaysAndPartnersSection, {
        isWishlisted: () => false,
        onToggleWishlist: () => {},
      })
    );
    expect(staysHtml).not.toContain('Live Rates');
    expect(staysHtml).toContain('Search hotels');
    expect(staysHtml).toMatch(/external/i);

    const { DestinationCollections } = await import(
      '../src/components/portal/DestinationCollections'
    );
    const collectionsHtml = renderToStaticMarkup(
      React.createElement(DestinationCollections, {
        isWishlisted: () => false,
        onToggleWishlist: () => {},
      })
    );
    expect(collectionsHtml).toContain('Indicative estimate');
    expect(collectionsHtml).toMatch(/reviewed\s+2026-11-27/i);

    const { PlatformTrustFooter } = await import(
      '../src/components/portal/PlatformTrustFooter'
    );
    const footerHtml = renderToStaticMarkup(React.createElement(PlatformTrustFooter));
    expect(footerHtml).toContain('You pay merchants directly. TripSplit does not hold your money.');
    expect(footerHtml).toContain('Split to the exact paisa.');
    expect(footerHtml).not.toContain('TripSplitter');
  });
});

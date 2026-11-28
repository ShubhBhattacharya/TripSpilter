import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

const COUNSEL_BANNER = 'Draft — [TO BE REVIEWED BY COUNSEL BEFORE PUBLIC LAUNCH]';

describe('Item 5: Legal and trust pages (/privacy, /terms, /refunds, /contact)', () => {
  it('renders /privacy with visible counsel-review draft banner', async () => {
    const mod = await import('../src/app/privacy/page');
    const html = renderToStaticMarkup(React.createElement(mod.default));
    expect(html).toContain(COUNSEL_BANNER);
  });

  it('renders /terms with visible counsel-review draft banner', async () => {
    const mod = await import('../src/app/terms/page');
    const html = renderToStaticMarkup(React.createElement(mod.default));
    expect(html).toContain(COUNSEL_BANNER);
  });

  it('renders /refunds with counsel banner and grievance officer placeholders', async () => {
    const mod = await import('../src/app/refunds/page');
    const html = renderToStaticMarkup(React.createElement(mod.default));
    expect(html).toContain(COUNSEL_BANNER);
    expect(html).toContain('[GRIEVANCE_OFFICER_NAME]');
    expect(html).toContain('[GRIEVANCE_OFFICER_EMAIL]');
    expect(html).toContain('[RESPONSE_TIME_SLA]');
  });

  it('renders /contact with counsel banner and grievance officer placeholders', async () => {
    const mod = await import('../src/app/contact/page');
    const html = renderToStaticMarkup(React.createElement(mod.default));
    expect(html).toContain(COUNSEL_BANNER);
    expect(html).toContain('[GRIEVANCE_OFFICER_NAME]');
    expect(html).toContain('[GRIEVANCE_OFFICER_EMAIL]');
    expect(html).toContain('[RESPONSE_TIME_SLA]');
  });

  it('links /refunds and /contact from PlatformTrustFooter', async () => {
    const mod = await import('../src/components/portal/PlatformTrustFooter');
    const html = renderToStaticMarkup(React.createElement(mod.PlatformTrustFooter));
    expect(html).toContain('href="/refunds"');
    expect(html).toContain('href="/contact"');
  });
});

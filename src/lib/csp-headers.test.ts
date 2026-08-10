import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain .mjs config, no types
import nextConfig from '../../next.config.mjs';

// The CSP lives in next.config.mjs as data (an array of header rules), so the
// framing contract that makes the admin preview iframe work — and the
// third-party allowances Cloudflare injects into every HTML response — can be
// asserted here without booting a server.

type HeaderRule = {
  source: string;
  has?: Array<{ type: string; key: string }>;
  headers: Array<{ key: string; value: string }>;
};

async function getRules(): Promise<HeaderRule[]> {
  return (await nextConfig.headers()) as HeaderRule[];
}

function csp(rule: HeaderRule): string {
  const h = rule.headers.find((x) => x.key === 'Content-Security-Policy');
  if (!h) throw new Error(`no CSP header on rule ${rule.source}`);
  return h.value;
}

function directive(cspValue: string, name: string): string {
  const d = cspValue
    .split(';')
    .map((s) => s.trim())
    .find((s) => s === name || s.startsWith(`${name} `));
  if (d === undefined) throw new Error(`no ${name} directive in: ${cspValue}`);
  return d;
}

describe('base CSP (all visitors)', () => {
  it('allows the Cloudflare Web Analytics beacon script', async () => {
    const rules = await getRules();
    const base = rules.find((r) => r.source === '/:path*' && !r.has)!;
    expect(directive(csp(base), 'script-src')).toContain('https://static.cloudflareinsights.com');
  });

  it('allows the beacon to report to cloudflareinsights.com', async () => {
    const rules = await getRules();
    const base = rules.find((r) => r.source === '/:path*' && !r.has)!;
    expect(directive(csp(base), 'connect-src')).toContain('https://cloudflareinsights.com');
  });

  it('keeps the public site unframeable and its frame-src Google-only', async () => {
    const rules = await getRules();
    const base = rules.find((r) => r.source === '/:path*' && !r.has)!;
    expect(directive(csp(base), 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp(base), 'frame-src')).not.toContain("'self'");
  });
});

describe('admin-session CSP (furor_admin cookie rule)', () => {
  async function adminRule(): Promise<HeaderRule> {
    const rules = await getRules();
    return rules.find((r) => r.has?.some((h) => h.type === 'cookie' && h.key === 'furor_admin'))!;
  }

  it('lets admin pages frame the site itself (preview drawer, split review)', async () => {
    // frame-ancestors 'self' makes the site frameable, but the FRAMING page's
    // own frame-src must also allow 'self' or the browser blocks the load —
    // this is exactly the "Framing 'https://dancehyderabad.com/' violates
    // frame-src" console error.
    expect(directive(csp(await adminRule()), 'frame-src')).toContain("'self'");
  });

  it('still permits the Google Maps embeds while an admin is signed in', async () => {
    const d = directive(csp(await adminRule()), 'frame-src');
    expect(d).toContain('https://www.google.com');
    expect(d).toContain('https://maps.google.com');
  });

  it('relaxes frame-ancestors to self only', async () => {
    expect(directive(csp(await adminRule()), 'frame-ancestors')).toBe("frame-ancestors 'self'");
  });
});

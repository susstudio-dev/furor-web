import { describe, expect, it } from 'vitest';
import { pathToRegexp } from 'path-to-regexp';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain .mjs config, no types
import nextConfig from '../../next.config.mjs';

// The edge-cache decision — what a SHARED cache is permitted to store — lives
// in next.config.mjs as data (an array of header rules), same as the CSP
// tested in csp-headers.test.ts. Resolved here with no server boot, using the
// same path-to-regexp engine Next compiles `source` patterns with, so a later
// refactor that widens the exclusion (or narrows the cookie gating) fails a
// test instead of silently making admin HTML edge-cacheable.

type Condition = { type: string; key: string };
type HeaderRule = {
  source: string;
  has?: Condition[];
  missing?: Condition[];
  headers: Array<{ key: string; value: string }>;
};

async function getRules(): Promise<HeaderRule[]> {
  return (await nextConfig.headers()) as HeaderRule[];
}

function matchesCookies(rule: HeaderRule, cookies: Set<string>): boolean {
  for (const c of rule.has ?? []) {
    if (c.type === 'cookie' && !cookies.has(c.key)) return false;
  }
  for (const c of rule.missing ?? []) {
    if (c.type === 'cookie' && cookies.has(c.key)) return false;
  }
  return true;
}

// Mirrors the "later matching rule wins per header key" contract the config
// file's own comments rely on: walk every rule in declared order and keep
// the last value set for `key` by a rule whose `source` and cookie
// conditions both match.
function resolveHeader(
  rules: HeaderRule[],
  path: string,
  key: string,
  cookies: Set<string> = new Set(),
): string | undefined {
  let value: string | undefined;
  for (const rule of rules) {
    if (!pathToRegexp(rule.source).test(path)) continue;
    if (!matchesCookies(rule, cookies)) continue;
    const h = rule.headers.find((x) => x.key === key);
    if (h) value = h.value;
  }
  return value;
}

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';

describe('edge cache Cache-Control (next.config.mjs headers())', () => {
  it('makes the home page eligible for the shared edge cache', async () => {
    const rules = await getRules();
    expect(resolveHeader(rules, '/', 'Cache-Control')).toBe(PUBLIC_CACHE);
  });

  it('keeps /admin on no-store', async () => {
    const rules = await getRules();
    expect(resolveHeader(rules, '/admin', 'Cache-Control')).toBe('no-store, private');
  });

  it('keeps a nested admin page on no-store', async () => {
    const rules = await getRules();
    expect(resolveHeader(rules, '/admin/labels', 'Cache-Control')).toBe('no-store, private');
  });

  it('keeps the admin save API on no-store', async () => {
    const rules = await getRules();
    expect(resolveHeader(rules, '/api/admin/save', 'Cache-Control')).toBe('no-store, private');
  });

  it('never makes "/" cacheable for a visitor holding the admin cookie', async () => {
    const rules = await getRules();
    const value = resolveHeader(rules, '/', 'Cache-Control', new Set(['furor_admin']));
    // No rule sets Cache-Control for this combination today — an admin
    // session on a public path falls through with no explicit override. The
    // load-bearing assertion is the first one: whatever the value is, it must
    // never be the shared-cache value above.
    expect(value).not.toBe(PUBLIC_CACHE);
    expect(value).toBeUndefined();
  });

  it('never makes "/" cacheable for a visitor holding the preview cookie', async () => {
    const rules = await getRules();
    const value = resolveHeader(rules, '/', 'Cache-Control', new Set(['furor_preview']));
    expect(value).not.toBe(PUBLIC_CACHE);
    expect(value).toBe('private, no-store');
  });
});

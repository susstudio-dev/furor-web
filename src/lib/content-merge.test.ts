import { describe, expect, it } from 'vitest';
import { mergeWithSeed } from './content-merge';

describe('mergeWithSeed', () => {
  it('fills a missing key from the seed', () => {
    expect(mergeWithSeed({ site: {} }, { site: {}, hero: { headline: 'x' } })).toMatchObject({
      hero: { headline: 'x' },
    });
  });

  it('lets saved values win over the seed', () => {
    expect(mergeWithSeed({ site: { title: 'saved' } }, { site: { title: 'seed', tagline: 't' } })).toEqual({
      site: { title: 'saved', tagline: 't' },
    });
  });

  it('takes arrays whole from saved without splicing in seed items', () => {
    expect(mergeWithSeed({ batches: [{ id: 'b_1' }] }, { batches: [{ id: 'seed' }, { id: 'other' }] })).toEqual({
      batches: [{ id: 'b_1' }],
    });
  });

  // Restoring a pre-migration snapshot must NOT inject the seed's promos or
  // theme: sync-seed bakes a developer's live local content into the seed.
  it('never seeds campaigns or theme', () => {
    const merged = mergeWithSeed({ site: {} }, { site: {}, campaigns: [{ id: 'c1' }], theme: { preset: 'x' } }) as Record<
      string,
      unknown
    >;
    expect(merged.campaigns).toBeUndefined();
    expect(merged.theme).toBeUndefined();
  });

  it('still seeds a nested key that merely shares a reserved name', () => {
    const merged = mergeWithSeed({ pages: {} }, { pages: { theme: 'nested-is-unrelated' } }) as {
      pages: { theme?: string };
    };
    expect(merged.pages.theme).toBe('nested-is-unrelated');
  });

  it('keeps saved campaigns and theme when the saved document has them', () => {
    const merged = mergeWithSeed({ campaigns: [{ id: 'live' }], theme: { preset: 'p' } }, { campaigns: [{ id: 'seed' }] }) as {
      campaigns: { id: string }[];
      theme: { preset: string };
    };
    expect(merged.campaigns).toEqual([{ id: 'live' }]);
    expect(merged.theme).toEqual({ preset: 'p' });
  });

  it('refuses prototype keys', () => {
    const merged = mergeWithSeed(JSON.parse('{"__proto__":{"polluted":true}}'), {}) as Record<string, unknown>;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(merged.polluted).toBeUndefined();
  });
});

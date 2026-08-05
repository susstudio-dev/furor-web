import { describe, expect, it } from 'vitest';
import { diffToOps } from './diff-ops';

const base = () => ({
  version: 1,
  site: { title: 'Furor', tagline: 'Dance for life' },
  danceStyles: [
    { id: 'a', displayOrder: 1 },
    { id: 'b', displayOrder: 2 },
  ],
  pages: { home: { closingCta: { headline: 'Come dance' } } },
});

describe('diffToOps', () => {
  it('emits nothing for an unchanged document', () => {
    expect(diffToOps(base(), base())).toEqual([]);
  });

  it('emits nothing when a field was changed and changed back', () => {
    const next = base();
    next.site.tagline = 'temp';
    next.site.tagline = 'Dance for life';
    expect(diffToOps(base(), next)).toEqual([]);
  });

  it('emits a set for a changed non-collection branch', () => {
    const next = base();
    next.pages.home.closingCta.headline = 'Come dance with us';
    expect(diffToOps(base(), next)).toEqual([
      { op: 'set', path: 'pages', value: next.pages },
    ]);
  });

  it('emits a setList for a changed collection', () => {
    const next = base();
    next.danceStyles[0].displayOrder = 9;
    expect(diffToOps(base(), next)).toEqual([
      { op: 'setList', path: 'danceStyles', value: next.danceStyles },
    ]);
  });

  // Reordering is the case the client-side shallow-copy bug used to lose.
  it('emits a list op when only the order changed', () => {
    const next = base();
    next.danceStyles = [
      { id: 'b', displayOrder: 1 },
      { id: 'a', displayOrder: 2 },
    ];
    expect(diffToOps(base(), next)).toHaveLength(1);
  });

  it('never emits an op for the schema version literal', () => {
    const next = base();
    (next as { version: number }).version = 2;
    expect(diffToOps(base(), next)).toEqual([]);
  });

  it('ignores prototype keys in a submitted document', () => {
    const next = JSON.parse('{"site":{"title":"x"},"__proto__":{"polluted":true}}');
    const ops = diffToOps({ site: { title: 'y' } }, next);
    expect(ops.every((o) => !o.path.includes('__proto__'))).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('is insensitive to key order', () => {
    expect(diffToOps({ site: { a: 1, b: 2 } }, { site: { b: 2, a: 1 } })).toEqual([]);
  });
});

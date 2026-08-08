import { describe, expect, it } from 'vitest';
import { InvalidPathError, formatPath, parsePath } from './patch-path';

describe('parsePath', () => {
  it('parses a dotted key path', () => {
    expect(parsePath('site.whatsappNumber')).toEqual([
      { kind: 'key', key: 'site' },
      { kind: 'key', key: 'whatsappNumber' },
    ]);
  });

  it('parses an id-addressed collection segment', () => {
    expect(parsePath('batches[id=b_7].priceInr')).toEqual([
      { kind: 'id', key: 'batches', id: 'b_7' },
      { kind: 'key', key: 'priceInr' },
    ]);
  });

  it('parses a numeric index for order-is-data arrays', () => {
    expect(parsePath('pages.faqs.sections[2].heading')).toEqual([
      { kind: 'key', key: 'pages' },
      { kind: 'key', key: 'faqs' },
      { kind: 'index', key: 'sections', index: 2 },
      { kind: 'key', key: 'heading' },
    ]);
  });

  // The single most important test in this file: mergeWithSeed's guard is
  // read-path only, and Zod cannot undo prototype mutation because __proto__
  // is never an own key.
  it.each(['pages.__proto__.x', 'batches.constructor.y', 'a.prototype.b'])(
    'rejects the reserved segment in %s',
    (path) => {
      expect(() => parsePath(path)).toThrow(InvalidPathError);
    },
  );

  it.each(['', '$', '.', 'a..b', 'a[]', 'a[id=]', 'a[-1]', 'a b'])(
    'rejects the malformed path %j',
    (path) => {
      expect(() => parsePath(path)).toThrow(InvalidPathError);
    },
  );
});

describe('formatPath', () => {
  it('round-trips every segment kind', () => {
    for (const path of ['site.whatsappNumber', 'batches[id=b_7].priceInr', 'pages.faqs.sections[2].heading']) {
      expect(formatPath(parsePath(path))).toBe(path);
    }
  });
});

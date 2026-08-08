import { describe, expect, it } from 'vitest';
import { hashOf, mayWrite, newLineage, parseMeta } from './storage-version-core';

describe('hashOf', () => {
  it('is deterministic and distinguishes content', () => {
    expect(hashOf('a')).toBe(hashOf('a'));
    expect(hashOf('a')).not.toBe(hashOf('b'));
  });
});

describe('mayWrite', () => {
  it('accepts a write whose expected hash matches the current bytes', () => {
    expect(mayWrite('current', { hash: hashOf('current') })).toBe(true);
  });

  it('rejects a write based on stale bytes', () => {
    expect(mayWrite('current', { hash: hashOf('older') })).toBe(false);
  });

  it('accepts the first write when no sidecar exists yet', () => {
    expect(mayWrite('current', null)).toBe(true);
  });
});

describe('parseMeta', () => {
  it('reads lineage and rev from R2 custom metadata', () => {
    expect(parseMeta({ lineage: 'L1', rev: '41' })).toEqual({ lineage: 'L1', rev: 41 });
  });

  // Documents written before versioning existed carry no metadata. They must
  // read as a distinct lineage at rev 0 rather than throwing or silently
  // colliding with a real lineage.
  it('falls back for a document written before versioning existed', () => {
    expect(parseMeta(undefined)).toEqual({ lineage: 'legacy', rev: 0 });
    expect(parseMeta({})).toEqual({ lineage: 'legacy', rev: 0 });
  });

  it('ignores a non-numeric rev rather than producing NaN', () => {
    expect(parseMeta({ lineage: 'L1', rev: 'nonsense' })).toEqual({ lineage: 'L1', rev: 0 });
  });
});

describe('newLineage', () => {
  it('produces a fresh identifier each time', () => {
    expect(newLineage()).not.toBe(newLineage());
  });
});

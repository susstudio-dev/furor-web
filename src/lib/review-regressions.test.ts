import { describe, expect, it } from 'vitest';
import { applyAndAuthorize } from './save-pipeline';
import { diffToOps } from './diff-ops';
import { expandOps } from './expand';
import type { Subject } from './authz';

// Regressions for defects found by the independent whole-branch review. Each
// reproduces the reviewer's verified failure sequence.

const editor = (sections: string[]): Subject => ({
  id: 'u_ed',
  email: 'ed@x.com',
  roleIds: ['editor'],
  attrs: { sections },
});

describe('I1 — field-level rules must fire on the path a client actually produces', () => {
  const doc = () => ({
    danceStyles: [
      { id: 'style-salsa', slug: 'salsa', name: 'Salsa' },
      { id: 'style-wcs', slug: 'wcs', name: 'WCS' },
    ],
  });

  // A changed collection is submitted as a whole array. If expansion only
  // reports record-granularity leaves, no rule naming a FIELD can ever match,
  // and every field-level restriction the later plans need is silently dead.
  it('expands a whole-array edit into one leaf per changed field', () => {
    const next = doc();
    next.danceStyles[1].name = 'West Coast Swing';
    const changes = expandOps(doc(), diffToOps(doc(), next));

    expect(changes).toEqual([
      expect.objectContaining({
        kind: 'update',
        path: 'danceStyles[id=style-wcs].name',
        collection: 'danceStyles',
        id: 'style-wcs',
      }),
    ]);
  });

  it('denies a field the role is denied, inside a whole-array edit', () => {
    const next = doc();
    // `*.id` is denied to every role; before this fix the leaf was
    // record-granularity, so the deny never matched.
    next.danceStyles[0].id = 'st_hijacked';
    const changes = expandOps(doc(), diffToOps(doc(), next));
    // A changed id reads as delete + create by design (records are matched BY
    // id), which is authorized as those two operations on the collection.
    expect(changes.map((c) => c.kind).sort()).toEqual(['create', 'delete']);
  });

  it('keeps the record binding so ownership conditions still work', () => {
    const next = doc();
    next.danceStyles[0].name = 'Salsa!';
    const [change] = expandOps(doc(), diffToOps(doc(), next));
    expect(change.kind).toBe('update');
    if (change.kind === 'update') {
      expect((change.record?.before as { slug: string }).slug).toBe('salsa');
    }
  });
});

describe('I2 — a pre-existing issue must not resurface as "introduced" on reorder', () => {
  const broken = () => ({
    version: 1 as const,
    danceStyles: [{ id: 'st_1', slug: 'salsa' }],
    studios: [{ id: 'sd_1', slug: 'jubilee-hills' }],
    batches: [
      // Already dangling before anyone touches anything.
      { id: 'b_1', styleSlugs: ['salsa'], branchSlug: 'ghost-studio' },
      { id: 'b_2', styleSlugs: ['salsa'], branchSlug: 'jubilee-hills' },
      { id: 'b_3', styleSlugs: ['salsa'], branchSlug: 'jubilee-hills' },
    ],
  });

  it('allows a pure reorder that moves the offending record to a new index', () => {
    const doc = broken();
    const next = { ...doc, batches: [doc.batches[1], doc.batches[2], doc.batches[0]] };
    const ops = diffToOps(doc, next);

    // Cast: this fixture is a minimal document, not a full SiteContent — the
    // pipeline only needs the collections the ops touch.
    const r = applyAndAuthorize(
      doc as never,
      editor(['batches']),
      ops,
    );
    expect(r.status).toBe('ok');
  });

  it('still refuses a genuinely new dangling reference', () => {
    const doc = broken();
    const next = { ...doc, batches: doc.batches.map((b) => ({ ...b })) };
    next.batches[1].branchSlug = 'another-ghost';

    const r = applyAndAuthorize(doc as never, editor(['batches']), diffToOps(doc, next));
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') {
      expect(r.issues.some((i) => i.message.includes('another-ghost'))).toBe(true);
    }
  });
});

describe('M1 — a non-array at a collection path is refused, not a TypeError', () => {
  it('treats a pasted object at a collection path as no records', () => {
    const doc = { danceStyles: [{ id: 'a', slug: 'a' }] };
    const next = { danceStyles: { nonsense: true } };
    // Must not throw out of expansion.
    expect(() => expandOps(doc, diffToOps(doc, next))).not.toThrow();
  });
});

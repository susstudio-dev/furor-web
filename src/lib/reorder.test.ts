import { describe, expect, it } from 'vitest';
import { diffToOps } from './diff-ops';
import { expandOps } from './expand';

// Regression for the reorder that used to be lost.
//
// StylesEditor / StudiosEditor / CustomPagesEditor all did `arr.slice()` (a
// SHALLOW copy) and then renumbered `displayOrder` in place, mutating the very
// objects the loaded document still referenced. The visible order changed
// while the base quietly changed with it.
//
// Today's server-side diff compares whole arrays, so it still notices the new
// order. The mutation is nonetheless a live hazard: any diff that compares
// records BY ID — which is what a client-side editor hook does — sees two
// identical records and emits nothing. These tests pin the invariant that
// move() leaves its input untouched.

type Row = { id: string; displayOrder: number };

/** The old, broken shape. */
function moveShallow(rows: Row[], idx: number, dir: -1 | 1): Row[] {
  const next = rows.slice();
  const target = idx + dir;
  [next[idx], next[target]] = [next[target], next[idx]];
  next.forEach((s, i) => (s.displayOrder = i + 1));
  return next;
}

/** The fixed shape now used by all three editors. */
function moveCopied(rows: Row[], idx: number, dir: -1 | 1): Row[] {
  const next = rows.map((s) => ({ ...s }));
  const target = idx + dir;
  [next[idx], next[target]] = [next[target], next[idx]];
  next.forEach((s, i) => (s.displayOrder = i + 1));
  return next;
}

const rows = (): Row[] => [
  { id: 'salsa', displayOrder: 1 },
  { id: 'bachata', displayOrder: 2 },
];

describe('reordering a list', () => {
  it('leaves the source rows untouched when copied properly', () => {
    const source = rows();
    moveCopied(source, 0, 1);
    expect(source).toEqual([
      { id: 'salsa', displayOrder: 1 },
      { id: 'bachata', displayOrder: 2 },
    ]);
  });

  it('shows the shallow copy corrupting the source rows', () => {
    const source = rows();
    moveShallow(source, 0, 1);
    // Same array order, but the displayOrder values were rewritten underneath.
    expect(source.map((r) => r.displayOrder)).toEqual([2, 1]);
  });

  it('produces a save op for the reorder', () => {
    const doc = { danceStyles: rows() };
    const next = { danceStyles: moveCopied(doc.danceStyles, 0, 1) };
    expect(diffToOps(doc, next)).toHaveLength(1);
    expect(next.danceStyles.map((r) => r.id)).toEqual(['bachata', 'salsa']);
  });

  it('expands the reorder into a reorder leaf the authorizer can see', () => {
    const doc = { danceStyles: rows() };
    const ops = diffToOps(doc, { danceStyles: moveCopied(doc.danceStyles, 0, 1) });
    const kinds = expandOps(doc, ops).map((c) => c.kind);
    expect(kinds).toContain('reorder');
  });
});

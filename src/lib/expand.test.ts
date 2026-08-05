import { describe, expect, it } from 'vitest';
import { expandOps } from './expand';

const base = () => ({
  site: { whatsappNumber: '918886072572' },
  instructors: [
    { id: 'i_1', shortBio: 'A', social: { instagram: '' } },
    { id: 'i_2', shortBio: 'B', social: { instagram: '' } },
  ],
  batches: [
    { id: 'b_1', branchSlug: 'jubilee-hills', razorpayLink: 'https://rzp.io/1' },
    { id: 'b_5', branchSlug: 'gachibowli', razorpayLink: 'https://rzp.io/5' },
  ],
});

describe('expandOps', () => {
  it('expands a scalar set into one update', () => {
    expect(expandOps(base(), [{ op: 'set', path: 'site.whatsappNumber', value: '910000000000' }])).toEqual([
      {
        kind: 'update',
        path: 'site.whatsappNumber',
        before: '918886072572',
        after: '910000000000',
      },
    ]);
  });

  it('emits nothing when the value is unchanged', () => {
    expect(expandOps(base(), [{ op: 'set', path: 'site.whatsappNumber', value: '918886072572' }])).toEqual([]);
  });

  // The parent-path escape: one whole-array write must become per-record
  // changes, or a record-scoped rule has nothing to bind to.
  it('expands a whole-list write into per-record changes', () => {
    const changes = expandOps(base(), [
      {
        op: 'setList',
        path: 'instructors',
        value: [
          { id: 'i_1', shortBio: 'A', social: { instagram: '' } },
          { id: 'i_2', shortBio: 'HACKED', social: { instagram: 'x' } },
          { id: 'i_3', shortBio: 'new', social: { instagram: '' } },
        ],
      },
    ]);
    const kinds = changes.map((c) => `${c.kind}:${'id' in c ? c.id : ''}`);
    expect(kinds).toContain('update:i_2');
    expect(kinds).toContain('create:i_3');
    expect(kinds).not.toContain('update:i_1');
  });

  it('reports a deletion when a record disappears from a list write', () => {
    expect(
      expandOps(base(), [
        { op: 'setList', path: 'instructors', value: [{ id: 'i_1', shortBio: 'A', social: { instagram: '' } }] },
      ]),
    ).toEqual([expect.objectContaining({ kind: 'delete', collection: 'instructors', id: 'i_2' })]);
  });

  it('reports a reorder without reporting field updates', () => {
    expect(expandOps(base(), [{ op: 'reorder', path: 'instructors', ids: ['i_2', 'i_1'] }])).toEqual([
      expect.objectContaining({ kind: 'reorder', collection: 'instructors' }),
    ]);
  });

  it('carries the containing record on a field update inside a collection', () => {
    const [change] = expandOps(base(), [{ op: 'set', path: 'instructors[id=i_2].shortBio', value: 'C' }]);
    expect(change).toMatchObject({
      kind: 'update',
      collection: 'instructors',
      id: 'i_2',
      path: 'instructors[id=i_2].shortBio',
    });
  });

  // The branch-hop: the record state must reflect the WHOLE envelope, so an
  // authorizer checking `record.before` sees the pre-hop branch.
  it('reports record state before and after the entire envelope', () => {
    const [change] = expandOps(base(), [
      { op: 'set', path: 'batches[id=b_5].branchSlug', value: 'jubilee-hills' },
      { op: 'set', path: 'batches[id=b_5].razorpayLink', value: 'https://pay.attacker.example' },
    ]);
    expect(change).toMatchObject({ collection: 'batches', id: 'b_5' });
    expect((change as { record: { before: { branchSlug: string } } }).record.before.branchSlug).toBe('gachibowli');
    expect((change as { record: { after: { branchSlug: string } } }).record.after.branchSlug).toBe('jubilee-hills');
  });

  it('is insensitive to key order when deciding what changed', () => {
    const changes = expandOps(base(), [
      {
        op: 'setList',
        path: 'instructors',
        value: [
          { social: { instagram: '' }, shortBio: 'A', id: 'i_1' },
          { social: { instagram: '' }, shortBio: 'B', id: 'i_2' },
        ],
      },
    ]);
    expect(changes).toEqual([]);
  });
});

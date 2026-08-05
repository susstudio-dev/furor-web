import { describe, expect, it } from 'vitest';
import { PatchError, applyOps, type Op } from './patch';

const base = () => ({
  site: { whatsappNumber: '918886072572', email: '' },
  batches: [
    { id: 'b_1', time: '9:30 AM', priceInr: 6000, razorpayLink: 'https://rzp.io/1' },
    { id: 'b_2', time: '6:30 PM', priceInr: 7000, razorpayLink: null },
  ],
  welcome: { tracks: [{ key: 'latin', whenTime: '9:30' }, { key: 'wcs', whenTime: '18:30' }] },
});

describe('applyOps', () => {
  it('sets a scalar without mutating the input', () => {
    const doc = base();
    const next = applyOps(doc, [{ op: 'set', path: 'site.whatsappNumber', value: '910000000000' }]);
    expect(next.site.whatsappNumber).toBe('910000000000');
    expect(doc.site.whatsappNumber).toBe('918886072572');
  });

  it('sets a field on an id-addressed record', () => {
    const next = applyOps(base(), [{ op: 'set', path: 'batches[id=b_2].priceInr', value: 7500 }]);
    expect(next.batches[1].priceInr).toBe(7500);
    expect(next.batches[0].priceInr).toBe(6000);
  });

  // null, '' and absent are all distinct in the schema (razorpayLink,
  // seatsLeft, stats.studentsThisWeek), so clearing must be explicit.
  it('clears an optional field with an explicit null', () => {
    const next = applyOps(base(), [{ op: 'set', path: 'batches[id=b_1].razorpayLink', value: null }]);
    expect(next.batches[0].razorpayLink).toBeNull();
  });

  it('replaces a whole list', () => {
    const value = [{ id: 'b_2', time: '7:00 PM', priceInr: 7000, razorpayLink: null }];
    const next = applyOps(base(), [{ op: 'setList', path: 'batches', value }]);
    expect(next.batches).toHaveLength(1);
    expect(next.batches[0].id).toBe('b_2');
  });

  it('appends a record', () => {
    const next = applyOps(base(), [
      { op: 'insert', path: 'batches', value: { id: 'b_3', time: '8 AM', priceInr: 5000, razorpayLink: null } },
    ]);
    expect(next.batches.map((b) => b.id)).toEqual(['b_1', 'b_2', 'b_3']);
  });

  it('removes a record by id', () => {
    const next = applyOps(base(), [{ op: 'remove', path: 'batches', id: 'b_1' }]);
    expect(next.batches.map((b) => b.id)).toEqual(['b_2']);
  });

  it('reorders by id list', () => {
    const next = applyOps(base(), [{ op: 'reorder', path: 'batches', ids: ['b_2', 'b_1'] }]);
    expect(next.batches.map((b) => b.id)).toEqual(['b_2', 'b_1']);
  });

  it('supports a collection keyed by something other than id', () => {
    const next = applyOps(base(), [{ op: 'set', path: 'welcome.tracks[id=wcs].whenTime', value: '19:00' }]);
    expect(next.welcome.tracks[1].whenTime).toBe('19:00');
  });

  it('throws when an id does not resolve', () => {
    expect(() => applyOps(base(), [{ op: 'set', path: 'batches[id=nope].time', value: 'x' }])).toThrow(
      PatchError,
    );
  });

  it('throws when a reorder omits an id', () => {
    expect(() => applyOps(base(), [{ op: 'reorder', path: 'batches', ids: ['b_2'] }])).toThrow(PatchError);
  });

  it('throws when the path is not an id-addressed collection', () => {
    expect(() => applyOps(base(), [{ op: 'remove', path: 'site', id: 'x' }])).toThrow(PatchError);
  });

  it('refuses reserved segments and does not pollute the prototype', () => {
    const ops: Op[] = [{ op: 'set', path: 'site.__proto__.polluted', value: true }];
    expect(() => applyOps(base(), ops)).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

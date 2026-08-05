import { describe, expect, it } from 'vitest';
import { integrityIssues } from './integrity';

const doc = () => ({
  danceStyles: [
    { id: 'st_1', slug: 'salsa' },
    { id: 'st_2', slug: 'bachata' },
  ],
  studios: [{ id: 'sd_1', slug: 'jubilee-hills', styleSlugs: ['salsa'] }],
  batches: [{ id: 'b_1', slug: undefined, styleSlugs: ['salsa'], branchSlug: 'jubilee-hills' }],
  instructors: [{ id: 'i_1', branchSlugs: ['jubilee-hills'], styleSlugs: ['bachata'] }],
  testimonials: [{ id: 't_1', styleSlug: 'salsa' }],
  stories: [{ id: 's_1', slug: 'a-night' }],
  customPages: [{ id: 'c_1', slug: 'refund-policy' }],
});

type Doc = ReturnType<typeof doc>;
const check = (d: unknown) => integrityIssues(d as Doc);

describe('integrityIssues', () => {
  it('passes a consistent document', () => {
    expect(check(doc())).toEqual([]);
  });

  // Every lookup in the codebase is a first-match .find(), and slugs are the
  // authorizer's join keys — a duplicate silently shadows another record.
  it('flags a duplicate slug within a collection', () => {
    const d = doc();
    d.customPages.push({ id: 'c_2', slug: 'refund-policy' });
    expect(check(d)).toEqual([
      expect.objectContaining({ path: ['customPages', 1, 'slug'] }),
    ]);
  });

  it('flags a duplicate id within a collection', () => {
    const d = doc();
    d.batches.push({ id: 'b_1', slug: undefined, styleSlugs: ['salsa'], branchSlug: 'jubilee-hills' });
    expect(check(d)).toEqual([expect.objectContaining({ path: ['batches', 1, 'id'] })]);
  });

  it('does not confuse identical slugs in different collections', () => {
    const d = doc();
    d.stories.push({ id: 's_2', slug: 'salsa' }); // same slug as a dance style
    expect(check(d)).toEqual([]);
  });

  // Two non-overlapping patches can orphan each other's references: one deletes
  // a style while another adds a batch pointing at it.
  it('flags a batch pointing at a missing dance style', () => {
    const d = doc();
    d.batches[0].styleSlugs = ['kizomba'];
    expect(check(d)).toEqual([
      expect.objectContaining({ path: ['batches', 0, 'styleSlugs', 0] }),
    ]);
  });

  it('flags a batch pointing at a missing studio', () => {
    const d = doc();
    d.batches[0].branchSlug = 'gachibowli';
    expect(check(d)).toEqual([expect.objectContaining({ path: ['batches', 0, 'branchSlug'] })]);
  });

  it('flags an instructor pointing at a missing studio or style', () => {
    const d = doc();
    d.instructors[0].branchSlugs = ['nowhere'];
    d.instructors[0].styleSlugs = ['nope'];
    expect(check(d)).toHaveLength(2);
  });

  it('flags a testimonial pointing at a missing style but allows an empty one', () => {
    const d = doc();
    d.testimonials[0].styleSlug = '';
    expect(check(d)).toEqual([]);
    d.testimonials[0].styleSlug = 'nope';
    expect(check(d)).toHaveLength(1);
  });
});

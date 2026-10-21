import { describe, expect, it } from 'vitest';
import { matchPath } from './glob';

describe('matchPath', () => {
  it('matches an exact path', () => {
    expect(matchPath('site.whatsappNumber', 'site.whatsappNumber')).toBe(true);
  });

  it('grants a whole subtree from a prefix', () => {
    expect(matchPath('batches', 'batches[id=b_7].priceInr')).toBe(true);
    expect(matchPath('pages', 'pages.faqs.sections[2].heading')).toBe(true);
  });

  // Regression: a grant on `stories` must not leak into a sibling key that
  // merely starts with the same characters.
  it('does not match a sibling key with a shared prefix', () => {
    expect(matchPath('stories', 'storiesArchive[id=x].title')).toBe(false);
    expect(matchPath('site', 'sitemapSettings.x')).toBe(false);
  });

  it('treats * as exactly one segment', () => {
    expect(matchPath('pages.*.intro', 'pages.about.intro')).toBe(true);
    expect(matchPath('pages.*.intro', 'pages.about.moments.intro')).toBe(false);
  });

  it('treats ** as any remaining segments', () => {
    expect(matchPath('pages.**', 'pages.about.moments.photos[0].alt')).toBe(true);
    expect(matchPath('**', 'anything.at.all')).toBe(true);
  });

  // A deny on `theme.**` must also stop a write to the bare parent, or the
  // deny is trivially bypassed by writing the whole object at once.
  it('matches the bare parent of a ** pattern', () => {
    expect(matchPath('theme.**', 'theme')).toBe(true);
  });

  it('ignores id and index addressing when matching', () => {
    expect(matchPath('instructors', 'instructors[id=i_3].shortBio')).toBe(true);
  });

  // A grant on one field must not authorize writing the record that holds it.
  it('does not let a deeper pattern match a shallower path', () => {
    expect(matchPath('batches.priceInr', 'batches[id=b_7]')).toBe(false);
  });

  it('matches the id-deny pattern against a record id write but not a create', () => {
    expect(matchPath('*.id', 'batches[id=b_1].id')).toBe(true);
    expect(matchPath('*.id', 'batches[id=b_1]')).toBe(false);
  });
});

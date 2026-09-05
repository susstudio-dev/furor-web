import { describe, expect, it } from 'vitest';
import { resolveVoices, socialFactsLine } from './la-rumba-page';
import type { Testimonial } from './content-schema';

const t = (id: string): Testimonial =>
  ({ id, studentName: id, photo: '', text: `${id} text`, styleSlug: '', publishedAt: '2026-01-01' }) as Testimonial;

describe('socialFactsLine', () => {
  it('joins the facts the tonight block owns', () => {
    expect(
      socialFactsLine({
        when: 'Every Saturday · 7 PM',
        venueName: 'Over the Moon Brew Co',
        venueLocality: 'Gachibowli, Hyderabad',
      }),
    ).toBe('Every Saturday · 7 PM · Over the Moon Brew Co · Gachibowli, Hyderabad');
  });

  // Blank hides the element, everywhere in this document. A venue that has not
  // been filled in must not render as a dangling separator.
  it('drops blanks instead of printing empty separators', () => {
    expect(
      socialFactsLine({ when: 'Every Saturday · 7 PM', venueName: '', venueLocality: '  ' }),
    ).toBe('Every Saturday · 7 PM');
  });

  it('returns an empty string when nothing is known', () => {
    expect(socialFactsLine({ when: '', venueName: '', venueLocality: '' })).toBe('');
  });
});

describe('resolveVoices', () => {
  it('returns the named testimonials in the order the page names them', () => {
    const all = [t('a'), t('b'), t('c')];
    expect(resolveVoices(all, ['c', 'a']).map((x) => x.id)).toEqual(['c', 'a']);
  });

  // The owner can delete a testimonial from /admin at any time. The page must
  // skip the gap, not render an undefined blockquote — the same tolerance
  // pages.home.rumba.testimonialId already has.
  it('skips an id that no longer exists', () => {
    expect(resolveVoices([t('a')], ['gone', 'a']).map((x) => x.id)).toEqual(['a']);
  });

  it('returns nothing when the page names nothing', () => {
    expect(resolveVoices([t('a')], [])).toEqual([]);
  });
});

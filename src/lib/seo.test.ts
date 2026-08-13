import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';
import { fitDescription, fitTitle, SEO_DESC_CHARS, SEO_TITLE_CHARS } from './seo';

const doc = () => SiteContentSchema.parse(seed);

// Every page object that carries its own SERP title and description. Kept as a
// literal list rather than Object.keys(c.pages) so a future page that forgets
// the fields fails here instead of silently opting out.
const PAGE_KEYS = [
  'home',
  'about',
  'faqs',
  'contact',
  'instructorsPage',
  'stories',
  'danceStyles',
  'batches',
  'privacy',
  'terms',
] as const;

describe('SEO budgets', () => {
  // Exported so /admin's counter and the render-time trim cannot drift apart:
  // an editor who sees "57/57" must be seeing the number fitTitle enforces.
  it('exports the title budget fitTitle already enforces', () => {
    expect(SEO_TITLE_CHARS).toBe(57);
  });

  // Advisory only. The render-time description limit is pixels (DESC_PX),
  // because that is Google's real limit — but pixels are not something an
  // editor can count while typing, and 155 is the figure every SEO tool shows.
  it('exports an advisory description budget for the admin counter', () => {
    expect(SEO_DESC_CHARS).toBe(155);
  });
});

describe('page SEO fields', () => {
  it('gives every page object a seoTitle and a seoDescription', () => {
    const c = doc();
    for (const k of PAGE_KEYS) {
      expect(typeof c.pages[k].seoTitle).toBe('string');
      expect(typeof c.pages[k].seoDescription).toBe('string');
    }
  });

  // Blank is the whole migration story: an unedited document keeps rendering
  // the literal each route already shipped, so this task changes nothing a
  // visitor or a crawler can see.
  it('ships them blank, so today’s literals still decide what renders', () => {
    const c = doc();
    for (const k of PAGE_KEYS) {
      expect(c.pages[k].seoTitle).toBe('');
      expect(c.pages[k].seoDescription).toBe('');
    }
  });

  it('gives the confirmation page its own blank seoTitle', () => {
    expect(doc().welcome.seoTitle).toBe('');
  });

  it('keeps an admin-written value over the blank default', () => {
    const c = doc();
    c.pages.about.seoTitle = 'Our story';
    c.pages.about.seoDescription = 'Nine years of Latin dance in Hyderabad.';
    const again = SiteContentSchema.parse(c);
    expect(again.pages.about.seoTitle).toBe('Our story');
    expect(again.pages.about.seoDescription).toBe('Nine years of Latin dance in Hyderabad.');
  });
});

describe('fitTitle and fitDescription still govern admin-written copy', () => {
  // The point of routing the new fields through the existing helpers rather
  // than around them: an over-long admin title is trimmed, never shipped broken.
  it('trims an over-long admin title rather than shipping it broken', () => {
    const long = 'A Very Long Admin Written Page Title That Nobody Would Sensibly Ship';
    expect(fitTitle(long, 'Furor — Dance Hyderabad').absolute.length).toBeLessThanOrEqual(61);
  });

  it('lets a substantial admin description stand on its own', () => {
    const written =
      'Salsa, Bachata and West Coast Swing classes in Jubilee Hills, Hyderabad, for people who have never danced a single step before.';
    expect(fitDescription(written, 'fallback support copy')).toBe(written);
  });
});

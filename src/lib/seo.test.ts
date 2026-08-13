import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';
import { fitDescription, fitTitle, SEO_DESC_CHARS, SEO_TITLE_CHARS } from './seo';
import { PAGE_SEO_DEFAULTS, resolvePageMeta, type PageMetaKey } from './page-meta';

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

const BRAND = 'Furor — Dance Hyderabad';
const blank = { seoTitle: '', seoDescription: '', brand: BRAND };

describe('PAGE_SEO_DEFAULTS', () => {
  it('covers every route that owns its own metadata', () => {
    expect(Object.keys(PAGE_SEO_DEFAULTS).sort()).toEqual(
      [
        'about',
        'batches',
        'contact',
        'danceStyles',
        'faqs',
        'home',
        'instructorsPage',
        'privacy',
        'stories',
        'terms',
        'welcome',
      ].sort(),
    );
  });

  // fitDescription trims to a PIXEL budget, so a support sentence that is
  // comfortably under 155 characters can still come back with an ellipsis.
  // Every shipped one must survive untouched, or this plan silently rewrites
  // a snippet it promised not to change.
  it('ships support descriptions that fitDescription leaves alone', () => {
    for (const [key, v] of Object.entries(PAGE_SEO_DEFAULTS)) {
      expect([key, fitDescription('', v.description)]).toEqual([key, v.description]);
    }
  });
});

describe('resolvePageMeta', () => {
  // THE regression this module exists to prevent. Today /about emits
  // `title: 'About'` and Next's layout template appends " · <brand>". Routing
  // it through fitTitle bypasses the template, so it must produce the same
  // 31-character string — byte for byte — or every SERP title on the site
  // silently changes.
  it('reproduces the title the layout template renders today', () => {
    const cases: [PageMetaKey, string][] = [
      ['about', 'About · Furor — Dance Hyderabad'],
      ['batches', 'Batches & Pricing · Furor — Dance Hyderabad'],
      ['faqs', 'FAQs · Furor — Dance Hyderabad'],
      ['contact', 'Contact · Furor — Dance Hyderabad'],
      ['instructorsPage', 'Instructors · Furor — Dance Hyderabad'],
      ['danceStyles', 'Dance Styles · Furor — Dance Hyderabad'],
      ['stories', 'Stories · Furor — Dance Hyderabad'],
    ];
    for (const [key, expected] of cases) {
      expect([key, resolvePageMeta(key, blank).title.absolute]).toEqual([key, expected]);
    }
  });

  it('lets an admin-written title win over everything else', () => {
    const meta = resolvePageMeta('about', {
      ...blank,
      seoTitle: 'Our story',
      derivedTitle: 'Derived',
    });
    expect(meta.title.absolute).toBe('Our story · Furor — Dance Hyderabad');
  });

  // Home builds "<two lead styles> Classes in Hyderabad" from live records;
  // privacy and terms prefer their own intro headline. A derived title beats
  // the shipped fallback and loses to an admin one.
  it('prefers a derived title over the shipped fallback', () => {
    expect(
      resolvePageMeta('home', { ...blank, derivedTitle: 'Salsa & Bachata Classes' })
        .title.absolute,
    ).toBe('Salsa & Bachata Classes · Furor — Dance Hyderabad');
    expect(resolvePageMeta('home', blank).title.absolute).toBe(
      'Dance Classes in Hyderabad · Furor — Dance Hyderabad',
    );
  });

  it('resolves the description admin-first, then derived, then support alone', () => {
    const written =
      'Salsa, Bachata and West Coast Swing classes in Jubilee Hills, Hyderabad, for people who have never danced a step.';
    expect(
      resolvePageMeta('about', { ...blank, seoDescription: written, derivedDescription: 'ignored' })
        .description,
    ).toBe(written);
    expect(resolvePageMeta('about', { ...blank, derivedDescription: written }).description).toBe(
      written,
    );
    expect(resolvePageMeta('about', blank).description).toBe(PAGE_SEO_DEFAULTS.about.description);
  });

  it('lets a route override the shipped support sentence', () => {
    const meta = resolvePageMeta('home', {
      ...blank,
      supportDescription: 'Salsa, Bachata & West Coast Swing classes in Jubilee Hills, Hyderabad.',
    });
    expect(meta.description).toBe(
      'Salsa, Bachata & West Coast Swing classes in Jubilee Hills, Hyderabad.',
    );
  });

  // Clearing a field in /admin leaves an empty string; a fat-fingered space
  // must behave the same way, not ship a one-space title.
  it('treats a whitespace-only value as unset', () => {
    expect(resolvePageMeta('faqs', { ...blank, seoTitle: '   ' }).title.absolute).toBe(
      'FAQs · Furor — Dance Hyderabad',
    );
    expect(resolvePageMeta('faqs', { ...blank, seoDescription: ' \n ' }).description).toBe(
      PAGE_SEO_DEFAULTS.faqs.description,
    );
  });

  it('still trims an over-long admin title instead of shipping it broken', () => {
    const meta = resolvePageMeta('about', {
      ...blank,
      seoTitle: 'A Very Long Admin Written Page Title That Nobody Would Sensibly Ship Anywhere',
    });
    expect(meta.title.absolute.length).toBeLessThanOrEqual(61);
    expect(meta.title.absolute.endsWith('…')).toBe(true);
  });
});

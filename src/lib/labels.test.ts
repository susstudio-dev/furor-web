import { describe, expect, it } from 'vitest';
import { HeroSchema, LabelsSchema, type Labels } from './content-schema';
import {
  enquiryDefaultLabel,
  LABEL_DEFAULTS,
  label,
  PILL_CHAR_LIMIT,
  PILL_KEYS,
} from './labels';

const labels = (over: Partial<Labels> = {}): Labels => LabelsSchema.parse(over);

describe('LabelsSchema', () => {
  // Pinned budget. The spec allows ~50 cross-cutting strings because every
  // public request runs a full SiteContentSchema.parse under a 10ms CPU cap
  // and Zod cost scales with node count. The 12 filter* keys deliberately
  // live on the batches page instead of here.
  it('parses an empty object into the full shipped label set', () => {
    expect(Object.keys(labels())).toHaveLength(61);
  });

  // The four screen-reader labels Plan 2's header/footer rewrite must consume
  // instead of hardcoding. They have no render site today; they exist so the
  // rewrite has something editable to point at.
  it('carries the social aria labels the icon links will need', () => {
    const l = labels();
    expect(l.ariaSocialInstagram).toBe('Furor on Instagram');
    expect(l.ariaSocialFacebook).toBe('Furor on Facebook');
    expect(l.ariaSocialYoutube).toBe('Furor on YouTube');
    expect(l.ariaSocialWhatsapp).toBe('Furor on WhatsApp');
  });

  // The deduplication payoff: "Chat on WhatsApp" ships at 10 render sites and
  // "DM on Instagram" at 8.
  it('reproduces the enquiry CTA literals exactly', () => {
    const l = labels();
    expect(l.ctaChatWhatsapp).toBe('Chat on WhatsApp');
    expect(l.ctaEnquireWhatsapp).toBe('Enquire on WhatsApp');
    expect(l.ctaDmInstagram).toBe('DM on Instagram');
    expect(l.ctaBookFoundation).toBe('Book my first class');
    expect(l.ctaBookTrial).toBe('Book my first class');
  });

  it('carries the nav item set that Header and Footer both render', () => {
    const l = labels();
    expect(l.navHome).toBe('Home');
    expect(l.navDanceStyles).toBe('Dance Styles');
    expect(l.navBatches).toBe('Batches & Pricing');
    expect(l.navBlog).toBe('Blog');
    expect(l.navExplore).toBe('Explore');
  });

  // The live inconsistency this key exists to kill: QuickEnroll prints the raw
  // enum "Filling Fast" while BatchesBrowser hardcodes "Filling fast" — two
  // casings of one word on one site.
  it('gives the status enums one display casing', () => {
    const l = labels();
    expect(l.badgeFillingFast).toBe('Filling fast');
    expect(l.badgeOpen).toBe('Open');
    expect(l.badgeClosed).toBe('Closed');
  });

  it('keeps a stored value over the default', () => {
    const l = labels({ ctaChatWhatsapp: 'Message us' });
    expect(l.ctaChatWhatsapp).toBe('Message us');
    expect(l.ctaDmInstagram).toBe('DM on Instagram');
  });
});

describe('LABEL_DEFAULTS', () => {
  it('is derived from the schema, so it can never drift from it', () => {
    expect(LABEL_DEFAULTS).toEqual(labels());
  });
});

describe('label', () => {
  it('returns the stored value when the studio has set one', () => {
    expect(label(labels({ ctaChatWhatsapp: 'Message us' }), 'ctaChatWhatsapp')).toBe('Message us');
  });

  // The whole point of the fallback: clearing a field in the admin must
  // restore the shipped copy, never render an empty button.
  it('falls back to the shipped literal when the field is empty', () => {
    expect(label(labels({ ctaChatWhatsapp: '' }), 'ctaChatWhatsapp')).toBe('Chat on WhatsApp');
  });

  it('treats a whitespace-only value as empty', () => {
    expect(label(labels({ ctaBookTrial: '   ' }), 'ctaBookTrial')).toBe('Book my first class');
  });

  it('every field falls back to its own shipped literal, not a shared one', () => {
    const blank = Object.fromEntries(
      Object.keys(LABEL_DEFAULTS).map((k) => [k, '']),
    ) as Labels;
    for (const key of Object.keys(LABEL_DEFAULTS) as (keyof typeof LABEL_DEFAULTS)[]) {
      expect(label(blank, key)).toBe(LABEL_DEFAULTS[key]);
    }
  });

  // Defence in depth, not theory: content.ts merges stored bytes with the seed
  // before parsing, but a document hand-edited at /admin/json can still be
  // short a key, and an empty button is a conversion bug.
  it('survives a document missing the key entirely', () => {
    expect(label({} as Labels, 'ctaEnquire')).toBe('Enquire');
  });
});

describe('PILL_KEYS', () => {
  // .pill is whitespace-nowrap (globals.css) and several call sites sit inside
  // overflow-clip wrappers, so a long value razor-cuts itself with no warning
  // to whoever typed it. The admin shows a character hint for exactly these.
  it('names exactly the labels that render inside a .pill', () => {
    expect([...PILL_KEYS].sort()).toEqual([
      'badgeClosed',
      'badgeFillingFast',
      'badgeFirstTimersWelcome',
      'badgeOpen',
    ]);
  });

  it('every pill key is a real label key', () => {
    for (const k of PILL_KEYS) expect(LABEL_DEFAULTS[k]).toBeTypeOf('string');
  });

  it('pins the pill budget the admin hint counts against', () => {
    expect(PILL_CHAR_LIMIT).toBe(24);
  });
});

// The exact resolution EnquiryCTA performs, lifted out as a pure function so
// the chokepoint has a test even though no test in this repo renders a
// component. This one function is what removes "Chat on WhatsApp" from ten
// render sites and "DM on Instagram" from eight.
describe('enquiryDefaultLabel', () => {
  it('gives the batch-row variant its own WhatsApp verb', () => {
    expect(enquiryDefaultLabel('whatsapp', 'batch-row', labels())).toBe('Enquire on WhatsApp');
  });

  it('gives every other WhatsApp variant the shared verb', () => {
    expect(enquiryDefaultLabel('whatsapp', 'primary', labels())).toBe('Chat on WhatsApp');
    expect(enquiryDefaultLabel('whatsapp', 'secondary', labels())).toBe('Chat on WhatsApp');
    expect(enquiryDefaultLabel('whatsapp', 'link', labels())).toBe('Chat on WhatsApp');
    expect(enquiryDefaultLabel('whatsapp', 'icon', labels())).toBe('Chat on WhatsApp');
  });

  it('gives Instagram its own verb regardless of variant', () => {
    expect(enquiryDefaultLabel('instagram', 'primary', labels())).toBe('DM on Instagram');
    expect(enquiryDefaultLabel('instagram', 'batch-row', labels())).toBe('DM on Instagram');
  });

  it('follows an edited label across every WhatsApp render site at once', () => {
    const edited = labels({ ctaChatWhatsapp: 'Message us on WhatsApp' });
    expect(enquiryDefaultLabel('whatsapp', 'primary', edited)).toBe('Message us on WhatsApp');
    expect(enquiryDefaultLabel('whatsapp', 'link', edited)).toBe('Message us on WhatsApp');
    // batch-row keeps its own key, so one edit cannot silently rewrite two.
    expect(enquiryDefaultLabel('whatsapp', 'batch-row', edited)).toBe('Enquire on WhatsApp');
  });
});

describe('HeroSchema.posterAlt', () => {
  // Not decorative: this is the one photo that shows a visitor what a Furor
  // night actually looks like, so it carries a real description rather than
  // the alt="" an audit flagged. The default is the literal Hero.tsx ships.
  it('defaults to the description shipping today', () => {
    const h = HeroSchema.parse({ headline: 'x', subHeadline: 'y' });
    expect(h.posterAlt).toBe(
      'Couples dancing Salsa together on a busy social floor at a Furor Latin night in Hyderabad',
    );
  });

  it('keeps an edited description', () => {
    const h = HeroSchema.parse({ headline: 'x', subHeadline: 'y', posterAlt: 'Bachata class' });
    expect(h.posterAlt).toBe('Bachata class');
  });
});

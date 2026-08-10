import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';

const labels = (over: Partial<Labels> = {}): Labels => LabelsSchema.parse(over);

describe('LabelsSchema', () => {
  // Pinned budget. The spec allows ~50 cross-cutting strings because every
  // public request runs a full SiteContentSchema.parse under a 10ms CPU cap
  // and Zod cost scales with node count. The 12 filter* keys deliberately
  // live on the batches page instead of here.
  it('parses an empty object into the full shipped label set', () => {
    expect(Object.keys(labels())).toHaveLength(56);
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
    expect(l.ctaBookTrial).toBe('Book my trial class');
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

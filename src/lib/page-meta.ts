import { fitDescription, fitTitle } from './seo';

// The eleven routes that own their own <title> and meta description. Every
// other route derives both from a record it already renders (a dance style, a
// story, a custom page), so there is nothing here to make editable.
export type PageMetaKey =
  | 'home'
  | 'about'
  | 'batches'
  | 'faqs'
  | 'contact'
  | 'instructorsPage'
  | 'danceStyles'
  | 'stories'
  | 'privacy'
  | 'terms'
  | 'welcome';

/**
 * The literals each route shipped before seoTitle / seoDescription existed.
 *
 * One home, on purpose. The same string used to appear in the route (as
 * fitDescription's second argument), and would otherwise also appear as the
 * schema default and as the admin placeholder — three copies, two of which
 * drift the first time anyone edits the wrong one. The schema defaults are
 * blank and both the route and /admin read from here instead.
 *
 * `home`'s title and description are the DEGENERATE case: the route always
 * passes derivedTitle / supportDescription built from the live dance styles,
 * and these values are only what a document with no styles at all would show.
 */
export const PAGE_SEO_DEFAULTS: Record<PageMetaKey, { title: string; description: string }> = {
  home: {
    title: 'Dance Classes in Hyderabad',
    description: 'Dance classes in Jubilee Hills, Hyderabad.',
  },
  about: {
    title: 'About',
    description:
      'The story of Furor — Hyderabad’s home for Salsa, Bachata and West Coast Swing.',
  },
  batches: {
    title: 'Batches & Pricing',
    description:
      'Upcoming Salsa, Bachata and West Coast Swing batches in Hyderabad with transparent pricing.',
  },
  faqs: {
    title: 'FAQs',
    description:
      'Answers on classes, batches, pricing and getting started at Furor Dance Hyderabad.',
  },
  contact: {
    title: 'Contact',
    description:
      'Get in touch with Furor Dance Hyderabad — WhatsApp, Instagram, email or visit the Jubilee Hills studio.',
  },
  instructorsPage: {
    title: 'Instructors',
    description:
      'Meet the instructors behind Furor’s Salsa, Bachata and West Coast Swing classes in Hyderabad.',
  },
  danceStyles: {
    title: 'Dance Styles',
    description:
      'Salsa, Bachata and West Coast Swing classes in Jubilee Hills, Hyderabad — find the style that fits you.',
  },
  stories: {
    title: 'Stories',
    description: 'Read what a night on the Furor floor actually looks like.',
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How Furor Dance Hyderabad collects, uses and protects your information.',
  },
  terms: {
    title: 'Terms & Services',
    description:
      'Terms of service for Furor Dance Hyderabad — classes, payments, conduct and refunds.',
  },
  welcome: {
    title: 'You’re in — Furor Hyderabad',
    description: 'Your intake details and next steps.',
  },
};

export interface PageMetaInput {
  /** The admin-written SERP title. Blank or whitespace-only means "not set". */
  seoTitle: string;
  /** The admin-written SERP description. Blank means "not set". */
  seoDescription: string;
  /** content.site.title — fitTitle spends whatever budget is left on it. */
  brand: string;
  /** A title this route builds from live records (home's lead styles, the
   *  legal pages' own intro headline). Beaten by seoTitle, beats the shipped
   *  fallback. */
  derivedTitle?: string;
  /** The page copy this route fed fitDescription before seoDescription existed
   *  — an intro lead, a first paragraph. Beaten by seoDescription. */
  derivedDescription?: string;
  /** Overrides the shipped support sentence. Only the home route needs it: its
   *  support line names the live dance styles. */
  supportDescription?: string;
}

function firstNonBlank(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c.trim();
  }
  return '';
}

/**
 * Resolve one route's title and description.
 *
 * Precedence, for both: what the studio typed in /admin, then what the route
 * derives from live records, then the literal it shipped. The result still goes
 * through fitTitle / fitDescription, so an over-long admin title is trimmed at
 * a word boundary rather than cut mid-word by the SERP — and a thin admin
 * description keeps the editor's words and gains the support sentence behind
 * them instead of being replaced by it.
 */
export function resolvePageMeta(
  key: PageMetaKey,
  input: PageMetaInput,
): { title: { absolute: string }; description: string } {
  const shipped = PAGE_SEO_DEFAULTS[key];
  return {
    title: fitTitle(
      firstNonBlank(input.seoTitle, input.derivedTitle, shipped.title),
      input.brand,
    ),
    description: fitDescription(
      firstNonBlank(input.seoDescription, input.derivedDescription),
      firstNonBlank(input.supportDescription, shipped.description),
    ),
  };
}

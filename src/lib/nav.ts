import { label, type LabelKey, type Labels } from './labels';

export interface NavItem {
  /** Stable and structural. Every branch in Header keys on THIS, never on the
   *  rendered text — the text is admin-editable and can be renamed at will. */
  id: string;
  /** A route, not copy. Renaming it would break bookmarks and inbound links,
   *  so hrefs are deliberately not exposed in /admin. */
  href: string;
  /** Fallback only, for an id with no mapped label key. */
  defaultLabel: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', href: '/', defaultLabel: 'Home' },
  { id: 'about', href: '/about', defaultLabel: 'About' },
  { id: 'dance-styles', href: '/dance-styles', defaultLabel: 'Dance Styles' },
  { id: 'instructors', href: '/instructors', defaultLabel: 'Instructors' },
  { id: 'batches', href: '/batches', defaultLabel: 'Batches & Pricing' },
  { id: 'blog', href: '/stories', defaultLabel: 'Blog' },
  { id: 'faqs', href: '/faqs', defaultLabel: 'FAQs' },
  { id: 'contact', href: '/contact', defaultLabel: 'Contact' },
];

// Kept off NavItem on purpose: deriving the key from the id by string
// transform ("dance-styles" -> "navDanceStyles") would be a silent break the
// day someone adds an id that does not transform cleanly.
const NAV_LABEL_KEY: Record<string, LabelKey> = {
  home: 'navHome',
  about: 'navAbout',
  'dance-styles': 'navDanceStyles',
  instructors: 'navInstructors',
  batches: 'navBatches',
  blog: 'navBlog',
  faqs: 'navFaqs',
  contact: 'navContact',
};

export function navLabel(item: NavItem, labels: Labels): string {
  const key = NAV_LABEL_KEY[item.id];
  return key ? label(labels, key) : item.defaultLabel;
}

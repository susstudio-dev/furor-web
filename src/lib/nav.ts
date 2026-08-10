import { label, type LabelKey, type Labels } from './labels';

export interface NavItem {
  /** Stable and structural. Every branch in Header keys on THIS, never on the
   *  rendered text — the text is admin-editable and can be renamed at will. */
  id: string;
  /** A route, not copy. Renaming it would break bookmarks and inbound links,
   *  so hrefs are deliberately not exposed in /admin. */
  href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', href: '/' },
  { id: 'about', href: '/about' },
  { id: 'dance-styles', href: '/dance-styles' },
  { id: 'instructors', href: '/instructors' },
  { id: 'batches', href: '/batches' },
  { id: 'blog', href: '/stories' },
  { id: 'faqs', href: '/faqs' },
  { id: 'contact', href: '/contact' },
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
  return label(labels, NAV_LABEL_KEY[item.id]);
}

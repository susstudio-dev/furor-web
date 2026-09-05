import type { Testimonial } from './content-schema';

/** The subset of `content.tonight` the page's fact strip reads. Structural
 *  rather than a slice of SiteContent, matching `Bookable` in book-label.ts:
 *  this module needs three strings, not the whole content schema. */
export interface SocialFacts {
  when: string;
  venueName: string;
  venueLocality: string;
}

/**
 * The single line of fact under the page's headline.
 *
 * Built here rather than interpolated in JSX so the blank-hiding rule is
 * tested once instead of trusted at four call sites. An unfilled venue must
 * not render as "Every Saturday · 7 PM · ·" — the dangling separators are how
 * a half-configured document looks broken rather than merely incomplete.
 */
export function socialFactsLine(t: SocialFacts): string {
  return [t.when, t.venueName, t.venueLocality]
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(' · ');
}

/**
 * The testimonials this page names, in the order it names them.
 *
 * Order comes from the page, not from the testimonial list, so the owner can
 * lead with whichever voice suits the social without reordering the whole
 * collection. Ids that no longer resolve are skipped: the owner can delete a
 * testimonial in /admin at any time, and a page that renders an empty
 * blockquote for a deleted id is worse than one that quietly shows fewer.
 */
export function resolveVoices(testimonials: Testimonial[], ids: string[]): Testimonial[] {
  const out: Testimonial[] = [];
  for (const id of ids) {
    const found = testimonials.find((t) => t.id === id);
    if (found) out.push(found);
  }
  return out;
}

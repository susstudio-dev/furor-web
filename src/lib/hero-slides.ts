/**
 * A hero slide.
 *
 * Structurally typed, and deliberately NOT derived from content-schema: this
 * module is imported by a public `'use client'` component, and a value import
 * of the schema would drag zod (~13KB gz) into the bundle of every route —
 * the exact regression `client-bundle.test.ts` exists to catch.
 */
export type Slide =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'video'; posterSrc: string; posterAlt: string; webmUrl: string; mp4Url: string };

/** What the hero reads slides out of — the two fields, nothing else. */
export interface HeroSlideSource {
  heroSlides: Slide[];
  heroPhoto: { src: string; alt: string };
}

/**
 * How long an image slide holds before the slider advances.
 *
 * A constant rather than an admin field: nobody has asked to tune it, every
 * editable field is one more thing the owner must understand, and a wrong
 * value here is a one-line change. A video slide ignores this entirely — it
 * advances when the clip ends, so a shot is never cut mid-movement.
 */
export const SLIDE_HOLD_MS = 5000;

/** Whether a slide has enough filled in to render anything at all. */
function renderable(s: Slide): boolean {
  return s.kind === 'image'
    ? s.src.trim() !== ''
    : s.webmUrl.trim() !== '' || s.mp4Url.trim() !== '';
}

/**
 * The slides the hero actually renders.
 *
 * Two jobs, and the second is what makes this feature safe to ship.
 *
 * It drops slides that cannot render — an image with no source, a video with
 * neither URL — so a half-filled admin row degrades to absence rather than to
 * a broken frame on a real business's page.
 *
 * And it falls back to `heroPhoto` when nothing usable remains. `heroSlides`
 * defaults to empty, so EVERY document in production is in that state the day
 * this ships: they all resolve to the single photograph they already showed.
 * No migration, no backfill, no ordering constraint between deploying the code
 * and editing the content. `heroPhoto` is retired from the admin but kept in
 * the schema for exactly this reason.
 */
export function resolveSlides(p: HeroSlideSource): Slide[] {
  const usable = p.heroSlides.filter(renderable);
  if (usable.length > 0) return usable;
  if (p.heroPhoto.src.trim() === '') return [];
  return [{ kind: 'image', src: p.heroPhoto.src, alt: p.heroPhoto.alt }];
}

/**
 * Whether these slides need the interactive slider mounted.
 *
 * False for the one case that describes every untouched page — a single image
 * — and the route then renders plain static markup. That is not an
 * optimisation detail: it means shipping this feature cannot regress the hero
 * of a page whose owner has not opted in, because such a page is not merely
 * rendered identically, it is SERVED identically, with no client component, no
 * timer, no observers and no slider JS.
 *
 * True for a lone video, because static markup renders an `<Img>` and cannot
 * play a clip.
 */
export function needsSlider(slides: Slide[]): boolean {
  if (slides.length > 1) return true;
  return slides.length === 1 && slides[0].kind === 'video';
}

/** Next index, wrapping. Returns 0 for lists that cannot advance so callers
 *  need no special case. */
export function advanceIndex(current: number, total: number): number {
  if (total <= 1) return 0;
  return (current + 1) % total;
}

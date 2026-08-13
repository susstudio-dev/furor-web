import type { SiteContent } from './content-schema';
import { todayIso } from './format';
import { levelRank } from './batch-order';

export function visibleBatches(content: SiteContent) {
  const today = todayIso();
  return content.batches
    .filter((b) => b.startDate >= today && b.status !== 'Closed')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function batchesForStyle(content: SiteContent, styleSlug: string) {
  return visibleBatches(content).filter((b) => b.styleSlugs.includes(styleSlug));
}

export function batchesForBranch(content: SiteContent, branchSlug: string) {
  return visibleBatches(content).filter((b) => b.branchSlug === branchSlug);
}

/**
 * The batch to show for each dance style on the home page's per-style strip.
 *
 * Level first, date second — the same rule `compareByLevel` already applies on
 * /batches and in QuickEnroll. This surface used to pick purely by date, so a
 * style whose soonest class was Advanced put an Advanced card in front of
 * someone who had never danced. Where no Foundation batch exists the next
 * lowest level is shown with `isFallback` set, so the card can say so
 * honestly rather than quietly offering a beginner the wrong room.
 *
 * A style with no visible batch is absent from the map — callers render their
 * own "coming soon" state.
 */
export function nextBatchPerStyle(content: SiteContent) {
  type Batch = ReturnType<typeof visibleBatches>[number];
  const map = new Map<string, { batch: Batch; isFallback: boolean }>();

  // visibleBatches() is already sorted by startDate ascending, so for a given
  // level the first one seen is the soonest; we only replace on a better level.
  for (const b of visibleBatches(content)) {
    for (const slug of b.styleSlugs) {
      const held = map.get(slug);
      if (!held || levelRank(b.level) < levelRank(held.batch.level)) {
        map.set(slug, { batch: b, isFallback: b.level !== 'Foundation' });
      }
    }
  }
  return map;
}

// Resolve a batch's styleSlugs into a human label, e.g. "Salsa + Bachata".
// Skips unknown slugs gracefully.
export function batchStyleLabel(
  content: SiteContent,
  styleSlugs: string[],
): string {
  const names = styleSlugs
    .map((slug) => content.danceStyles.find((s) => s.slug === slug)?.name)
    .filter((n): n is string => !!n);
  return names.length ? names.join(' + ') : styleSlugs.join(' + ');
}

export function styleBySlug(content: SiteContent, slug: string) {
  return content.danceStyles.find((s) => s.slug === slug);
}

export function studioBySlug(content: SiteContent, slug: string) {
  return content.studios.find((s) => s.slug === slug);
}

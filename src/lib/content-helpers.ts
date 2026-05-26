import type { SiteContent } from './content-schema';
import { todayIso } from './format';

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

export function nextBatchPerStyle(content: SiteContent) {
  const map = new Map<string, ReturnType<typeof visibleBatches>[number]>();
  for (const b of visibleBatches(content)) {
    for (const slug of b.styleSlugs) {
      if (!map.has(slug)) map.set(slug, b);
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

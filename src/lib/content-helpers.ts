import type { SiteContent } from './content-schema';
import { todayIso } from './format';

export function visibleBatches(content: SiteContent) {
  const today = todayIso();
  return content.batches
    .filter((b) => b.startDate >= today && b.status !== 'Closed')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function batchesForStyle(content: SiteContent, styleSlug: string) {
  return visibleBatches(content).filter((b) => b.styleSlug === styleSlug);
}

export function batchesForBranch(content: SiteContent, branchSlug: string) {
  return visibleBatches(content).filter((b) => b.branchSlug === branchSlug);
}

export function nextBatchPerStyle(content: SiteContent) {
  const map = new Map<string, ReturnType<typeof visibleBatches>[number]>();
  for (const b of visibleBatches(content)) {
    if (!map.has(b.styleSlug)) map.set(b.styleSlug, b);
  }
  return map;
}

export function styleBySlug(content: SiteContent, slug: string) {
  return content.danceStyles.find((s) => s.slug === slug);
}

export function studioBySlug(content: SiteContent, slug: string) {
  return content.studios.find((s) => s.slug === slug);
}

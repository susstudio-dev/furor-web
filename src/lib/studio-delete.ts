import type { SiteContent } from './content-schema';

// Deleting a studio is never just "drop the row". Batches and instructors
// point at it BY SLUG, and integrityIssues() (write path) refuses any save
// that introduces an unresolvable reference — so the naive filter produced a
// 400 naming batches the owner never touched, from a screen that offers no way
// to fix them. The two references are not the same kind of thing:
//
//  - `batches[].branchSlug` is required (schema: min 1). A batch cannot exist
//    without a branch, so there is no honest repair to make on the owner's
//    behalf: the deletion is blocked until those batches are moved or removed.
//  - `instructors[].branchSlugs` is a plain list that may be empty. Dropping
//    the deleted studio from it IS the repair, so we make it here rather than
//    leaving a dangling slug behind.

export interface StudioBlocker {
  batchId: string;
  label: string;
}

export type StudioDeletion =
  | { ok: true; next: SiteContent; instructorsTouched: number }
  | { ok: false; blockers: StudioBlocker[] };

/** How a batch reads in a sentence an owner can act on. */
function batchLabel(content: SiteContent, batch: SiteContent['batches'][number]): string {
  const names = batch.styleSlugs.map(
    (slug) => content.danceStyles.find((s) => s.slug === slug)?.name ?? slug,
  );
  const styles = names.join(' + ') || 'Untitled';
  return `${styles} · ${batch.level} · ${batch.daysOfWeek.join('/')} ${batch.time}`.trim();
}

/**
 * The document as it should look once `studioId` is gone — or the batches that
 * stand in the way. Pure, so the editor can ask before it mutates state and
 * the answer can be tested without a browser.
 */
export function planStudioDeletion(content: SiteContent, studioId: string): StudioDeletion {
  const studio = content.studios.find((s) => s.id === studioId);
  if (!studio) return { ok: false, blockers: [] };

  const blockers = content.batches
    .filter((b) => b.branchSlug === studio.slug)
    .map((b) => ({ batchId: b.id, label: batchLabel(content, b) }));
  if (blockers.length > 0) return { ok: false, blockers };

  let instructorsTouched = 0;
  const instructors = content.instructors.map((ins) => {
    if (!ins.branchSlugs.includes(studio.slug)) return ins;
    instructorsTouched++;
    return { ...ins, branchSlugs: ins.branchSlugs.filter((s) => s !== studio.slug) };
  });

  return {
    ok: true,
    instructorsTouched,
    next: {
      ...content,
      studios: content.studios.filter((s) => s.id !== studioId),
      instructors,
    },
  };
}

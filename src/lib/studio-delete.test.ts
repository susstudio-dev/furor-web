import { describe, it, expect } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { diffToOps } from './diff-ops';
import { applyAndAuthorize } from './save-pipeline';
import { planStudioDeletion } from './studio-delete';
import type { Subject } from './authz';

const owner: Subject = { id: 'u_1', email: 'o@x.com', roleIds: ['owner'], attrs: {} };
const doc = (): SiteContent => SiteContentSchema.parse(seed);

/** The studio screen's own delete, as it used to be: drop the row and save. */
function naiveDelete(c: SiteContent, id: string): SiteContent {
  return { ...c, studios: c.studios.filter((s) => s.id !== id) };
}

function save(base: SiteContent, next: SiteContent) {
  return applyAndAuthorize(base, owner, diffToOps(base, next));
}

describe('deleting a studio', () => {
  it('used to be refused by the integrity check, naming records the owner never touched', () => {
    const c = doc();
    const studio = c.studios.find((s) => c.batches.some((b) => b.branchSlug === s.slug))!;
    const r = save(c, naiveDelete(c, studio.id));
    expect(r.status).toBe('invalid');
  });

  it('is blocked, with the batches named, while batches still run there', () => {
    const c = doc();
    const studio = c.studios.find((s) => c.batches.some((b) => b.branchSlug === s.slug))!;
    const plan = planStudioDeletion(c, studio.id);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.blockers.length).toBeGreaterThan(0);
    expect(plan.blockers[0].label).toBeTruthy();
  });

  it('drops the studio from every instructor, and the save goes through', () => {
    const c = doc();
    // A studio nothing is scheduled at, but an instructor still teaches at.
    const studio = c.studios[0];
    const free: SiteContent = {
      ...c,
      batches: c.batches.filter((b) => b.branchSlug !== studio.slug),
      instructors: c.instructors.map((i, n) =>
        n === 0 ? { ...i, branchSlugs: [studio.slug] } : i,
      ),
    };

    const plan = planStudioDeletion(free, studio.id);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.instructorsTouched).toBeGreaterThan(0);
    expect(plan.next.studios.some((s) => s.id === studio.id)).toBe(false);
    expect(
      plan.next.instructors.every((i) => !i.branchSlugs.includes(studio.slug)),
    ).toBe(true);

    const r = save(free, plan.next);
    if (r.status !== 'ok') console.log(JSON.stringify(r, null, 1));
    expect(r.status).toBe('ok');
  });

  it('leaves the document untouched when the id is unknown', () => {
    expect(planStudioDeletion(doc(), 'nope').ok).toBe(false);
  });
});

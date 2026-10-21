import { requireSubject } from '@/lib/guard';
import { hasCapability } from '@/lib/authz';
import { getContent } from '@/lib/content';
import { expandOps } from '@/lib/expand';
import { listDrafts } from '@/lib/drafts';
import type { Op } from '@/lib/patch';
import { DraftsList } from './DraftsList';

// The approver signs what will be applied NOW - so the list shows the LIVE
// leaf expansion, never the set frozen at author time. A draft whose ops no
// longer expand cleanly is shown as needing a redo rather than approvable.
async function liveRows(drafts: Awaited<ReturnType<typeof listDrafts>>) {
  const docNow = await getContent();
  return drafts.map((d) => {
    try {
      const changes = expandOps(docNow, d.ops as Op[]);
      return {
        id: d.id,
        note: d.note,
        authorEmail: d.authorEmail,
        createdAt: d.createdAt,
        leafPaths: changes.map((c) => c.path),
        broken: changes.length === 0 ? 'Already applied or nothing left to change.' : null,
      };
    } catch (err) {
      return {
        id: d.id,
        note: d.note,
        authorEmail: d.authorEmail,
        createdAt: d.createdAt,
        leafPaths: d.leafPaths,
        broken: (err as Error).message,
      };
    }
  });
}

export default async function Page() {
  const subject = await requireSubject();
  const canApprove = hasCapability(subject, 'drafts.approve');
  const all = await listDrafts();
  // Reviewers see everything; authors see their own queue.
  const drafts = canApprove ? all : all.filter((d) => d.authorId === subject.id);

  return (
    <div className="p-6 sm:p-10 max-w-4xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Drafts</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Waiting for review</h1>
      <p className="mt-2 text-cream/70 max-w-2xl">
        Editors&rsquo; saves land here instead of going live. Preview shows the draft on the real
        site; approving publishes it through the same checks as a direct save.
      </p>
      <DraftsList drafts={await liveRows(drafts)} canApprove={canApprove} />
    </div>
  );
}

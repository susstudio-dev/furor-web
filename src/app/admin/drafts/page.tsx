import { requireSubject } from '@/lib/guard';
import { hasCapability } from '@/lib/authz';
import { listDrafts } from '@/lib/drafts';
import { DraftsList } from './DraftsList';

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
      <DraftsList
        drafts={drafts.map((d) => ({
          id: d.id,
          title: d.title,
          note: d.note,
          authorEmail: d.authorEmail,
          status: d.status,
          leafPaths: d.leafPaths,
          createdAt: d.createdAt,
          reviewedBy: d.reviewedBy,
        }))}
        canApprove={canApprove}
      />
    </div>
  );
}

import { notFound } from 'next/navigation';
import { requireSubject } from '@/lib/guard';
import { hasCapability } from '@/lib/authz';
import { readDraft } from '@/lib/drafts';
import { SplitReview } from './SplitReview';

// Side-by-side review: the draft's change list on the left, the real public
// site rendering the draft on the right. The iframe works because the
// preview cookie flips the site's framing headers to SAMEORIGIN (see
// next.config.mjs) — for exactly as long as the 15-minute cookie lives.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const subject = await requireSubject();
  const { id } = await params;
  const draft = await readDraft(id);
  if (!draft) notFound();
  const canApprove = hasCapability(subject, 'drafts.approve');
  if (draft.authorId !== subject.id && !canApprove) notFound();

  return (
    <SplitReview
      draft={{
        id: draft.id,
        note: draft.note,
        authorEmail: draft.authorEmail,
        status: draft.status,
        leafPaths: draft.leafPaths,
        createdAt: draft.createdAt,
      }}
      canApprove={canApprove && draft.status === 'open'}
    />
  );
}

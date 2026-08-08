import { notFound } from 'next/navigation';
import { requireSubject } from '@/lib/guard';
import { hasCapability } from '@/lib/authz';
import { getContent } from '@/lib/content';
import { expandOps } from '@/lib/expand';
import { readDraft } from '@/lib/drafts';
import type { Op } from '@/lib/patch';
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

  // The review signs the LIVE expansion - what approving applies now.
  let leafPaths = draft.leafPaths;
  let broken: string | null = null;
  try {
    const changes = expandOps(await getContent(), draft.ops as Op[]);
    leafPaths = changes.map((c) => c.path);
    if (changes.length === 0) broken = 'Already applied or nothing left to change.';
  } catch (err) {
    broken = (err as Error).message;
  }

  return (
    <SplitReview
      draft={{
        id: draft.id,
        note: draft.note,
        authorEmail: draft.authorEmail,
        status: draft.status,
        leafPaths,
        createdAt: draft.createdAt,
      }}
      canApprove={canApprove && broken == null}
    />
  );
}

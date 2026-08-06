import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { BREAK_GLASS_UID } from '@/lib/auth';
import { hasCapability, type Subject } from '@/lib/authz';
import { bustContentCache, CONTENT_KEY, mergeWithSeed } from '@/lib/content';
import { snapshotAfterWrite } from '@/lib/content-write';
import { SiteContentSchema } from '@/lib/content-schema';
import { assessApproval } from '@/lib/drafts-core';
import { listDrafts, readDraft, writeDraft } from '@/lib/drafts';
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
import { readDocWithVersion, writeDocIfMatch, StorageUnavailableError } from '@/lib/storage';
import { versionToken } from '@/lib/storage-version-core';
import { revalidatePublicPages } from '@/lib/revalidate-public';
import { resolveMutationSubject, resolveSubject } from '@/lib/subject';
import { readUserStore } from '@/lib/users';
import seedContent from '@/data/site-content.seed.json';

const MAX_BODY_BYTES = 64 * 1024;

export async function GET() {
  const subject = await resolveSubject();
  if (!subject) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const all = await listDrafts();
  // Reviewers see everything; everyone else sees their own queue.
  const visible = hasCapability(subject, 'drafts.approve')
    ? all
    : all.filter((d) => d.authorId === subject.id);

  return NextResponse.json({
    drafts: visible.map((d) => ({
      id: d.id,
      title: d.title,
      note: d.note,
      authorEmail: d.authorEmail,
      status: d.status,
      leafPaths: d.leafPaths,
      createdAt: d.createdAt,
      reviewedBy: d.reviewedBy,
    })),
  });
}

/** Approve or reject. POST-only with the leaf-path echo — sameSite=lax admits
 *  top-level navigations, so a GET approve link would execute sight-unseen. */
export async function POST(req: Request) {
  const gate = await resolveMutationSubject();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const approver = gate.subject;
  if (!hasCapability(approver, 'drafts.approve')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  if (!contentLengthWithin(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Body too large' }, { status: 413 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    action?: unknown;
    leafPaths?: unknown;
  } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const action = body?.action === 'approve' || body?.action === 'reject' ? body.action : null;
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 });

  const draft = await readDraft(id);
  if (!draft) return NextResponse.json({ error: 'No such draft' }, { status: 404 });
  if (draft.status !== 'open') {
    return NextResponse.json({ error: `Already ${draft.status}` }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === 'reject') {
    await writeDraft({ ...draft, status: 'rejected', reviewedBy: approver.email, reviewedAt: now });
    await audit({ actor: approver.email, action: 'draft_rejected', detail: draft.id });
    return NextResponse.json({ ok: true });
  }

  const echoedLeafPaths = Array.isArray(body?.leafPaths)
    ? (body!.leafPaths as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await readDocWithVersion(CONTENT_KEY);
      if (!current) return NextResponse.json({ error: 'No content document' }, { status: 503 });
      const doc = SiteContentSchema.parse(mergeWithSeed(JSON.parse(current.text), seedContent));

      // The author's CURRENT state — a fired author's queue dies with them.
      let authorRecord: { status: 'active' | 'disabled'; sessionVersion: number } | null = null;
      let authorSubject: Subject | null = null;
      if (draft.authorId === BREAK_GLASS_UID) {
        authorRecord = { status: 'active', sessionVersion: 0 };
        authorSubject = {
          id: BREAK_GLASS_UID,
          email: draft.authorEmail,
          roleIds: ['owner'],
          attrs: {},
          breakGlass: true,
        };
      } else {
        const store = await readUserStore();
        const record = store?.users.find((u) => u.id === draft.authorId) ?? null;
        if (record) {
          authorRecord = { status: record.status, sessionVersion: record.sessionVersion };
          authorSubject = {
            id: record.id,
            email: record.email,
            roleIds: record.roleIds,
            attrs: record.attrs,
          };
        }
      }

      const assessment = assessApproval({
        draft,
        currentDoc: doc,
        authorRecord,
        authorSubject,
        approver,
        echoedLeafPaths,
      });
      if (!assessment.ok) {
        const status = assessment.reason === 'conflict' ? 409 : 403;
        return NextResponse.json({ error: assessment.detail, reason: assessment.reason }, { status });
      }

      const text = JSON.stringify(assessment.next, null, 2);
      const written = await writeDocIfMatch(CONTENT_KEY, text, current.version);
      if (written === null) continue; // lost the CAS — re-read and re-assess once

      await writeDraft({ ...draft, status: 'approved', reviewedBy: approver.email, reviewedAt: now });
      await snapshotAfterWrite(current.text, text, approver.email);
      bustContentCache();
      await audit({
        actor: approver.email,
        action: 'draft_approved',
        detail: `${draft.id} by ${draft.authorEmail} · ${draft.leafPaths.join(', ')}`,
      });
      revalidatePublicPages(assessment.next);
      return NextResponse.json({ ok: true, version: versionToken(written) });
    }
    return NextResponse.json({ error: 'Conflicting writes — try again.' }, { status: 409 });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('draft approval error:', err);
    return NextResponse.json({ error: 'Approval failed — see server logs' }, { status: 500 });
  }
}

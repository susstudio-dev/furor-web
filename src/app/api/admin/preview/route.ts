import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hasCapability } from '@/lib/authz';
import { readDraft } from '@/lib/drafts';
import { mintPreviewToken, PREVIEW_COOKIE, PREVIEW_TTL_SECONDS } from '@/lib/preview-token';
import { sameOrigin } from '@/lib/request-guards';
import { resolveMutationSubject, resolveSubject } from '@/lib/subject';

// Starts and ends a preview session. The cookie is a 15-minute capability to
// see ONE draft overlaid on the public site — only the draft's author or a
// reviewer can mint it.

export async function POST(req: Request) {
  const gate = await resolveMutationSubject();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const subject = gate.subject;
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { draftId?: unknown } | null;
  const draftId = typeof body?.draftId === 'string' ? body.draftId : '';
  if (!draftId) return NextResponse.json({ error: 'draftId required' }, { status: 400 });

  const draft = await readDraft(draftId);
  if (!draft) return NextResponse.json({ error: 'No such draft' }, { status: 404 });
  if (draft.authorId !== subject.id && !hasCapability(subject, 'drafts.approve')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }

  const token = await mintPreviewToken({ draftId, uid: subject.id });
  const c = await cookies();
  c.set(PREVIEW_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PREVIEW_TTL_SECONDS,
  });
  return NextResponse.json({ ok: true, expiresInSeconds: PREVIEW_TTL_SECONDS });
}

export async function DELETE(req: Request) {
  // Clearing a cookie is harmless, but every mutating handler carries the
  // same two guards — one unguarded route is how patterns erode.
  const subject = await resolveSubject();
  if (!subject) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  const c = await cookies();
  c.delete(PREVIEW_COOKIE);
  return NextResponse.json({ ok: true });
}

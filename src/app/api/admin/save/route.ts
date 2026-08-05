import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { applyAndAuthorize } from '@/lib/save-pipeline';
import { diffToOps } from '@/lib/diff-ops';
import { bustContentCache, CONTENT_KEY, mergeWithSeed } from '@/lib/content';
import { snapshotAfterWrite } from '@/lib/content-write';
import { SiteContentSchema } from '@/lib/content-schema';
import { readDocWithVersion, writeDocIfMatch, StorageUnavailableError } from '@/lib/storage';
import { versionToken } from '@/lib/storage-version-core';
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
import { revalidatePublicPages } from '@/lib/revalidate-public';
import { resolveSubject } from '@/lib/subject';
import seedContent from '@/data/site-content.seed.json';

// The whole site-content document is well under 1 MB; 4 MB leaves headroom
// without letting a request balloon the isolate.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const subject = await resolveSubject();
  if (!subject) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  if (!contentLengthWithin(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Content document too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Editors submit the whole document (all of them do today), wrapped with the
  // version token the page was rendered from. The ops are derived server-side
  // by diffing against the document we just read — which is what stops a
  // whole-document POST from being one unauthorized write at the root.
  const envelope = body as { baseVersion?: unknown; document?: unknown };
  const submitted = envelope?.document ?? body;
  const baseVersion = typeof envelope?.baseVersion === 'string' ? envelope.baseVersion : null;

  try {
    // Two attempts: one retry for when someone else's write lands between our
    // read and our conditional write.
    for (let attempt = 0; attempt < 2; attempt++) {
      // NEVER read through getContent() here — its 30 s cache would make a
      // stale base version MATCH, and the save would silently clobber the
      // newer document.
      const current = await readDocWithVersion(CONTENT_KEY);
      if (!current) {
        return NextResponse.json(
          { error: 'No stored content document yet — the first save creates it.' },
          { status: 503 },
        );
      }

      const doc = SiteContentSchema.parse(mergeWithSeed(JSON.parse(current.text), seedContent));
      const ops = diffToOps(doc, submitted);
      if (ops.length === 0) {
        return NextResponse.json({
          ok: true,
          version: versionToken(current.version),
          unchanged: true,
        });
      }

      const result = applyAndAuthorize(doc, subject, ops);

      // Authorization answers before the conflict check, so a subject with no
      // write grants cannot poll 409s as a change-feed oracle.
      if (result.status === 'denied') {
        await audit({
          actor: subject.email,
          action: 'authz_denied',
          detail: result.denied.map((d) => d.path).join(', '),
        });
        return NextResponse.json({ error: 'Not permitted', denied: result.denied }, { status: 403 });
      }
      if (result.status === 'invalid') {
        return NextResponse.json(
          { error: 'Validation failed', issues: result.issues },
          { status: 400 },
        );
      }

      const token = versionToken(current.version);
      if (baseVersion !== null && baseVersion !== token) {
        return NextResponse.json(
          {
            error: 'Someone else saved while you were editing. Reload to get their changes.',
            currentVersion: token,
          },
          { status: 409 },
        );
      }

      const text = JSON.stringify(result.next, null, 2);
      const written = await writeDocIfMatch(CONTENT_KEY, text, current.version);
      if (written === null) continue; // lost the compare-and-swap — re-read once

      await snapshotAfterWrite(current.text, text, subject.email);
      bustContentCache();
      await audit({
        actor: subject.email,
        action: 'save_content',
        detail: `rev ${written.rev} · ${result.changes.map((c) => c.path).join(', ')}`,
      });
      revalidatePublicPages(result.next);

      return NextResponse.json({ ok: true, version: versionToken(written) });
    }

    return NextResponse.json(
      { error: 'Another save landed first — reload and try again.' },
      { status: 409 },
    );
  } catch (err: unknown) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('admin save error:', err);
    return NextResponse.json({ error: 'Save failed — see server logs' }, { status: 500 });
  }
}

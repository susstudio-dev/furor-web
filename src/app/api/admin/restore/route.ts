import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { hasCapability } from '@/lib/authz';
import { bustContentCache } from '@/lib/content';
import { restoreVersion } from '@/lib/content-write';
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
import { revalidatePublicPages } from '@/lib/revalidate-public';
import { StorageUnavailableError } from '@/lib/storage';
import { resolveMutationSubject } from '@/lib/subject';

const MAX_BODY_BYTES = 4 * 1024;

export async function POST(req: Request) {
  const gate = await resolveMutationSubject();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const subject = gate.subject;
  if (!hasCapability(subject, 'versions.restore')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  if (!contentLengthWithin(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Body too large' }, { status: 413 });
  }

  const body = (await req.json().catch(() => null)) as { filename?: string } | null;
  if (!body?.filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });

  try {
    // Restoring runs through the same authorization pipeline as a save, so it
    // cannot revert path sets the restorer is denied.
    const result = await restoreVersion(body.filename, subject);

    if (result.status === 'missing') {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    if (result.status === 'denied') {
      await audit({
        actor: subject.email,
        action: 'authz_denied',
        detail: `restore ${body.filename}: ${result.denied.map((d) => d.path).join(', ')}`,
      });
      return NextResponse.json({ error: 'Not permitted', denied: result.denied }, { status: 403 });
    }
    if (result.status === 'invalid') {
      return NextResponse.json({ error: 'Validation failed', issues: result.issues }, { status: 400 });
    }
    if (result.status === 'conflict') {
      return NextResponse.json(
        { error: 'Someone saved while the restore was running — reload and try again.' },
        { status: 409 },
      );
    }

    bustContentCache();
    await audit({ actor: subject.email, action: 'restore_version', detail: body.filename });
    revalidatePublicPages(result.next);
    return NextResponse.json({ ok: true, version: result.version });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('admin restore error:', err);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
}

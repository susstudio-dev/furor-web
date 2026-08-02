import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { ContentValidationError, saveContent } from '@/lib/content-write';
import { bustContentCache } from '@/lib/content';
import { StorageUnavailableError } from '@/lib/storage';
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
import { revalidatePublicPages } from '@/lib/revalidate-public';

// The whole site-content document is well under 1 MB; 4 MB leaves headroom
// without letting a request balloon the isolate.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  try {
    const saved = await saveContent(body, session.email);
    bustContentCache();
    await audit({ actor: session.email, action: 'save_content', detail: `version ${saved.version}` });
    revalidatePublicPages(saved);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof ContentValidationError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 });
    }
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('admin save error:', err);
    return NextResponse.json({ error: 'Save failed — see server logs' }, { status: 500 });
  }
}

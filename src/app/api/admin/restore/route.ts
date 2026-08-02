import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { bustContentCache } from '@/lib/content';
import { restoreVersion } from '@/lib/content-write';
import { sameOrigin } from '@/lib/request-guards';
import { revalidatePublicPages } from '@/lib/revalidate-public';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Rolling the site back is an owner-grade action.
  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'Owner role required' }, { status: 403 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { filename?: string } | null;
  if (!body?.filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });
  try {
    const restored = await restoreVersion(body.filename, session.email);
    bustContentCache();
    await audit({ actor: session.email, action: 'restore_version', detail: body.filename });
    revalidatePublicPages(restored);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
}

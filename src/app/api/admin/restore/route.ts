import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { restoreVersion } from '@/lib/content-write';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { filename?: string } | null;
  if (!body?.filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });
  try {
    await restoreVersion(body.filename, session.email);
    await audit({ actor: session.email, action: 'restore_version', detail: body.filename });
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
}

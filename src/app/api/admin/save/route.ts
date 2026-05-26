import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { ContentValidationError, saveContent } from '@/lib/content-write';
import { StorageUnavailableError } from '@/lib/storage';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const saved = await saveContent(body, session.email);
    await audit({ actor: session.email, action: 'save_content', detail: `version ${saved.version}` });
    // Site & socials, footer copy and tonight all live in the root layout, so a
    // single layout-level revalidate covers every static page. Dynamic
    // [slug] routes still need explicit calls.
    revalidatePath('/', 'layout');
    revalidatePath('/sitemap.xml');
    for (const s of saved.danceStyles) revalidatePath(`/dance-styles/${s.slug}`);
    for (const s of saved.stories) revalidatePath(`/stories/${s.slug}`);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof ContentValidationError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 });
    }
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('admin save error:', err);
    const message = err instanceof Error ? err.message : 'Save failed';
    // Most common prod misconfig: the Vercel Blob store was created PRIVATE.
    // This app needs a PUBLIC store (uploaded images render via <img> on the
    // public site). Give the exact fix instead of a raw error.
    if (/private store|public access/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Your Vercel Blob store is private. This app needs a PUBLIC Blob store (uploaded images are shown on the public site). In Vercel: disconnect/delete the store, create a new Blob store with public access, connect it to this project, then redeploy.',
        },
        { status: 503 },
      );
    }
    // Authenticated admin route — surfacing the real reason here is helpful.
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}

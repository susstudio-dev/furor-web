import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { ContentValidationError, saveContent } from '@/lib/content-write';

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
    console.error(err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}

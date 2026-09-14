import Link from 'next/link';
import { getContent } from '@/lib/content';
import { LaRumbaPageEditor } from './LaRumbaPageEditor';
import { requireWriteAccess } from '@/lib/guard';

export default async function Page() {
  await requireWriteAccess('pages');
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · La Rumba
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">La Rumba page</h1>
      <p className="mt-2 text-cream/70">
        Edit the copy, photos and calls to action on the public <code>/la-rumba</code> page.
      </p>
      <LaRumbaPageEditor initial={c} />
    </div>
  );
}

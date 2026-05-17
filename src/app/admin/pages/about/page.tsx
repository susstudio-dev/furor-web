import Link from 'next/link';
import { getContent } from '@/lib/content';
import { AboutPageEditor } from './AboutPageEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · About
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">About page</h1>
      <p className="mt-2 text-cream/70">
        Edit the headline, intro paragraphs, photo gallery, stats, timeline, and the closing CTA on the public <code>/about</code> page.
      </p>
      <AboutPageEditor initial={c} />
    </div>
  );
}

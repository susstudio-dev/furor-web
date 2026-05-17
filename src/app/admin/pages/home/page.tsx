import Link from 'next/link';
import { getContent } from '@/lib/content';
import { HomePageEditor } from './HomePageEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-5xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · Home
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">Home page</h1>
      <p className="mt-2 text-cream/70">
        The hardcoded section headers and closing CTA on the home page <code>/</code>. The hero is edited under <Link href="/admin/hero" className="text-ember-400 hover:text-ember-300">Hero</Link>.
      </p>
      <HomePageEditor initial={c} />
    </div>
  );
}

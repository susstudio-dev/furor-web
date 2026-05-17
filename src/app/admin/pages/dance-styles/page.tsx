import Link from 'next/link';
import { getContent } from '@/lib/content';
import { SimpleIntroEditor } from '@/components/admin/SimpleIntroEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">
        <Link href="/admin/pages" className="hover:text-ember-300">Pages</Link> · Dance Styles index
      </p>
      <h1 className="mt-1 display text-3xl font-extrabold">Dance Styles index</h1>
      <p className="mt-2 text-cream/70">
        The headline at the top of <code>/dance-styles</code>. Style copy and hero images are managed under <Link href="/admin/styles" className="text-ember-400 hover:text-ember-300">Dance styles</Link>.
      </p>
      <SimpleIntroEditor initial={c} pageKey="danceStyles" />
    </div>
  );
}

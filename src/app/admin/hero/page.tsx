import Link from 'next/link';
import { getContent } from '@/lib/content';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Hero</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Headline & poster</h1>
      <p className="mt-2 text-cream/70">For now, edit the hero block in the <Link href="/admin/json" className="text-ember-400 hover:text-ember-300">Raw JSON</Link> editor (a per-field editor is coming next).</p>
      <pre className="mt-6 rounded-2xl border border-cream/10 bg-ink-950 p-4 text-xs overflow-auto">{JSON.stringify(c.hero, null, 2)}</pre>
    </div>
  );
}

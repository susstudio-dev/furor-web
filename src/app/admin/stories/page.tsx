import Link from 'next/link';
import { getContent } from '@/lib/content';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Stories</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.stories.length} stories</h1>
      <p className="mt-2 text-cream/70">Add new posts via <Link href="/admin/json" className="text-ember-400 hover:text-ember-300">Raw JSON</Link>. Per-field editor coming next.</p>
    </div>
  );
}

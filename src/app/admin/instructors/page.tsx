import Link from 'next/link';
import { getContent } from '@/lib/content';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Instructors</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.instructors.length} instructors</h1>
      <p className="mt-2 text-cream/70">Edit via <Link href="/admin/json" className="text-ember-400 hover:text-ember-300">Raw JSON</Link> for now.</p>
      <ul className="mt-6 grid gap-2">
        {c.instructors.map((i) => (
          <li key={i.id} className="rounded-xl border border-cream/10 bg-ink-900/40 p-4">
            <p className="display text-lg font-bold">{i.name}</p>
            <p className="text-cream/60 text-sm">{i.role}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

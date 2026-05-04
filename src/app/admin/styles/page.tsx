import Link from 'next/link';
import { getContent } from '@/lib/content';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Dance styles</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.danceStyles.length} styles</h1>
      <p className="mt-2 text-cream/70">Edit copy, FAQs, and ordering. Per-field editor is on the next pass; for now the <Link href="/admin/json" className="text-ember-400 hover:text-ember-300">Raw JSON</Link> editor is the safe path.</p>
      <ul className="mt-6 grid gap-2">
        {c.danceStyles.slice().sort((a, b) => a.displayOrder - b.displayOrder).map((s) => (
          <li key={s.slug} className="rounded-xl border border-cream/10 bg-ink-900/40 p-4 flex items-center justify-between">
            <div>
              <p className="display text-lg font-bold">{s.name}</p>
              <p className="text-cream/60 text-sm">{s.tagline}</p>
            </div>
            <Link href={`/dance-styles/${s.slug}`} className="text-sm text-ember-400 hover:text-ember-300" target="_blank" rel="noopener noreferrer">
              View public →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

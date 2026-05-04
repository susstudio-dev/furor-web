import Link from 'next/link';
import { getContent } from '@/lib/content';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Testimonials</p>
      <h1 className="mt-1 display text-3xl font-extrabold">{c.testimonials.length} testimonials</h1>
      <p className="mt-2 text-cream/70">Edit via <Link href="/admin/json" className="text-ember-400 hover:text-ember-300">Raw JSON</Link> for now.</p>
      <ul className="mt-6 grid gap-2">
        {c.testimonials.map((t) => (
          <li key={t.id} className="rounded-xl border border-cream/10 bg-ink-900/40 p-4">
            <p className="text-cream/90">“{t.text}”</p>
            <p className="mt-2 text-cream/50 text-xs">— {t.studentName}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

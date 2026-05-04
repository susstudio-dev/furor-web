import Link from 'next/link';
import { getContent } from '@/lib/content';

export const metadata = { title: 'Stories' };

export default async function StoriesIndex() {
  const content = await getContent();
  const stories = content.stories.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <section className="container-x pt-20 pb-24">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Stories</p>
      <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight">From the studio.</h1>
      {stories.length === 0 ? (
        <p className="mt-8 text-cream/60">No stories yet — come back soon.</p>
      ) : (
        <ul className="mt-10 divide-y divide-cream/10">
          {stories.map((s) => (
            <li key={s.id} className="py-6">
              <Link href={`/stories/${s.slug}`} className="group block">
                <p className="text-cream/50 text-xs uppercase tracking-widest">
                  {new Date(s.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-1 display text-2xl font-bold group-hover:text-ember-400 transition">{s.title}</p>
                {s.excerpt ? <p className="mt-2 text-cream/70">{s.excerpt}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

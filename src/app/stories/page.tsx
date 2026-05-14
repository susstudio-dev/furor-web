import Link from 'next/link';
import { getContent } from '@/lib/content';

export const metadata = { title: 'Blog' };

export default async function StoriesIndex() {
  const content = await getContent();
  const stories = content.stories.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <section className="container-x pt-20 pb-24">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Blog</p>
      <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight">From the studio.</h1>
      <p className="mt-4 max-w-2xl text-cream/75 text-lg">
        Festivals, socials, bootcamps and the everyday inside Furor Hyderabad.
      </p>
      {stories.length === 0 ? (
        <p className="mt-8 text-cream/60">No posts yet — come back soon.</p>
      ) : (
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {stories.map((s) => (
            <li key={s.id}>
              <Link
                href={`/stories/${s.slug}`}
                className="group block rounded-2xl border border-cream/10 bg-ink-900/40 p-6 transition-colors hover:border-ember-400/40"
              >
                <p className="text-cream/50 text-xs uppercase tracking-widest">
                  {new Date(s.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-2 display text-xl font-bold group-hover:text-ember-400 transition">{s.title}</p>
                {s.excerpt ? <p className="mt-2 text-cream/70 text-sm leading-relaxed">{s.excerpt}</p> : null}
                <p className="mt-4 text-ember-400 text-sm">Read →</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

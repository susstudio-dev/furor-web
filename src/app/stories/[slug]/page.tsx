import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicContent } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { articleLd, breadcrumbLd, fitDescription, fitTitle } from '@/lib/seo';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { label } from '@/lib/labels';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublicContent();
  const story = c.stories.find((s) => s.slug === slug);
  if (!story) return {};
  // Was `story.excerpt || story.body.slice(0, 155)` — a hard mid-word cut with
  // no ellipsis, which is exactly what the comment on truncateAtWord warns off.
  const description = fitDescription(
    story.excerpt || story.body,
    `A story from ${c.site.title} — Salsa, Bachata and West Coast Swing in Jubilee Hills.`,
  );
  return {
    // Story titles are admin-written and run long (the longest is 59 chars on
    // its own); fitTitle spends whatever budget is left on the brand suffix.
    title: fitTitle(story.title, c.site.title),
    description,
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: {
      type: 'article',
      title: story.title,
      description,
      publishedTime: story.publishedAt,
      // A page-level openGraph replaces the layout's wholesale — keep the
      // brand card as fallback or stories without a hero lose og:image.
      images: [story.heroImage || '/og.png'],
    },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getPublicContent();
  const story = content.stories.find((s) => s.slug === slug);
  if (!story) notFound();

  // Newest three siblings. These posts are short by nature, and each one used
  // to be a dead end: one h1, one paragraph, no h2 and no onward link.
  const related = content.stories
    .filter((s) => s.slug !== story.slug)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  return (
    <>
    <article className="container-x pt-20 pb-12 prose prose-invert max-w-3xl">
      <JsonLd data={articleLd(story, content)} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Stories', path: '/stories' },
          { name: story.title, path: `/stories/${story.slug}` },
        ])}
      />
      <p className="text-cream/70 text-xs uppercase tracking-widest">
        {new Date(story.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <h1 className="display text-4xl font-extrabold sm:text-5xl tracking-tight">{story.title}</h1>
      <div className="mt-8 whitespace-pre-line text-cream/85 leading-relaxed">{story.body}</div>
    </article>

    {related.length > 0 ? (
      <section className="container-x pb-12 max-w-3xl">
        <h2 className="display text-sm uppercase tracking-widest text-ember-400">More from the studio</h2>
        <ul className="mt-6 grid gap-3">
          {related.map((s) => (
            <li key={s.id} className="flex">
              <Link
                href={`/stories/${s.slug}`}
                className="group flex w-full flex-col rounded-2xl border border-cream/10 bg-ink-900/40 p-5 transition-colors hover:border-ember-400/40"
              >
                <p className="text-cream/70 text-xs uppercase tracking-widest">
                  {new Date(s.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-1 display text-lg font-bold group-hover:text-ember-400 transition">{s.title}</p>
                {s.excerpt ? <p className="mt-2 text-cream/70 text-sm leading-relaxed">{s.excerpt}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6">
          <Link href="/stories" className="text-ember-400 text-sm hover:underline">
            All stories →
          </Link>
        </p>
      </section>
    ) : null}

    {/* Every story used to dead-end; the next step is now one tap away. */}
    <section className="container-x pb-24 max-w-3xl">
      <div className="hairline pt-6 flex flex-wrap items-center gap-3">
        <EnquiryCTA
          whatsappNumber={content.site.whatsappNumber}
          ctx={{ source: 'primary' }}
          variant="primary"
          labels={content.labels}
          templates={content.site.whatsappTemplates}
        />
        <Link href="/batches" className="btn-secondary">
          {label(content.labels, 'navBatches')}
        </Link>
      </div>
    </section>
    </>
  );
}

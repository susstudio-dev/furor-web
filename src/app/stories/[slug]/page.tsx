import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicContent } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { articleLd, breadcrumbLd, fitDescription, fitTitle } from '@/lib/seo';
import { buildWhatsAppHref } from '@/lib/enquiry';
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

    {/* Every story used to dead-end; the next step is now one tap away.
        This is a hand-rolled anchor rather than <EnquiryCTA> because that
        client component pulls a ~23 KB chunk onto a route that otherwise
        ships almost no app JS, which broke this route's bundle budget. The
        trade-off: this CTA does not fire the GA4 `enquiry_click` event —
        the floating Talk-to-us pill on the same page still does. */}
    <section className="container-x pb-24 max-w-3xl">
      <div className="hairline pt-6 flex flex-wrap items-center gap-3">
        <a
          href={buildWhatsAppHref(
            content.site.whatsappNumber,
            { source: 'primary' },
            content.site.whatsappTemplates,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          <WhatsAppGlyph />
          {label(content.labels, 'ctaChatWhatsapp')}
        </a>
        <Link href="/batches" className="btn-secondary">
          {label(content.labels, 'navBatches')}
        </Link>
      </div>
    </section>
    </>
  );
}

function WhatsAppGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.05 4.91A10 10 0 0 0 4.7 18.13L4 22l3.97-1.04A10 10 0 1 0 19.05 4.91Zm-7 15.13a8.06 8.06 0 0 1-4.1-1.13l-.3-.18-2.36.62.63-2.3-.19-.3A8.07 8.07 0 1 1 12.05 20Zm4.42-6.05c-.24-.12-1.43-.7-1.65-.78s-.38-.12-.55.12-.62.78-.76.94-.28.18-.52.06-1.03-.38-1.96-1.21a7.4 7.4 0 0 1-1.36-1.7c-.14-.24 0-.37.1-.49.1-.1.24-.27.36-.4.12-.13.16-.22.24-.37.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.42-.55-.43h-.47a.92.92 0 0 0-.66.31 2.78 2.78 0 0 0-.87 2.07c0 1.22.89 2.4 1.02 2.57.13.16 1.76 2.69 4.27 3.77.6.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

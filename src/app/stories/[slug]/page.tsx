import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getContent } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { articleLd, breadcrumbLd } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getContent();
  const story = c.stories.find((s) => s.slug === slug);
  if (!story) return {};
  const description = story.excerpt || story.body.slice(0, 155);
  return {
    title: story.title,
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
  const content = await getContent();
  const story = content.stories.find((s) => s.slug === slug);
  if (!story) notFound();

  return (
    <article className="container-x pt-20 pb-24 prose prose-invert max-w-3xl">
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
  );
}

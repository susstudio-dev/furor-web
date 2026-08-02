import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getContent } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { articleLd, breadcrumbLd } from '@/lib/seo';

// On the static GH Pages export every story must be prerendered. On
// Cloudflare Workers we return no params so every request renders live —
// prerendered HTML would freeze admin edits (no ISR machinery on free plan).
export async function generateStaticParams() {
  if (process.env.GH_PAGES !== 'true') return [];
  const c = await getContent();
  return c.stories.map((s) => ({ slug: s.slug }));
}

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
      ...(story.heroImage ? { images: [story.heroImage] } : {}),
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
      <p className="text-cream/50 text-xs uppercase tracking-widest">
        {new Date(story.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <h1 className="display text-4xl font-extrabold sm:text-5xl tracking-tight">{story.title}</h1>
      <div className="mt-8 whitespace-pre-line text-cream/85 leading-relaxed">{story.body}</div>
    </article>
  );
}

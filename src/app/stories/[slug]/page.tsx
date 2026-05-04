import { notFound } from 'next/navigation';
import { getContent } from '@/lib/content';

export async function generateStaticParams() {
  const c = await getContent();
  return c.stories.map((s) => ({ slug: s.slug }));
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getContent();
  const story = content.stories.find((s) => s.slug === slug);
  if (!story) notFound();

  return (
    <article className="container-x pt-20 pb-24 prose prose-invert max-w-3xl">
      <p className="text-cream/50 text-xs uppercase tracking-widest">
        {new Date(story.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <h1 className="display text-4xl font-extrabold sm:text-5xl tracking-tight">{story.title}</h1>
      <div className="mt-8 whitespace-pre-line text-cream/85 leading-relaxed">{story.body}</div>
    </article>
  );
}

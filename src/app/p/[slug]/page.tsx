import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getContent } from '@/lib/content';
import { LegalDoc } from '@/components/LegalDoc';

export async function generateStaticParams() {
  const c = await getContent();
  return c.customPages.filter((p) => p.published).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await getContent();
  const page = c.customPages.find((p) => p.slug === slug && p.published);
  if (!page) return {};
  return {
    title: page.title,
    description: page.seoDescription || page.intro.lead || undefined,
  };
}

export default async function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = await getContent();
  const page = c.customPages.find((p) => p.slug === slug && p.published);
  if (!page) notFound();
  return <LegalDoc intro={page.intro} lastUpdated="" sections={page.sections} />;
}

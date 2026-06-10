import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getContent } from '@/lib/content';
import { CustomPageView } from '@/components/CustomPageView';

// Admin-editable pages live in Blob and are added/edited without a redeploy, so
// they must render per-request — never frozen at build. Statically prerendering
// these (via generateStaticParams) made the build read Blob and bake a 500.html
// for each custom page; it also meant new pages didn't appear until a redeploy.
// (On the GitHub Pages static mirror this whole route is stripped in CI, so
// force-dynamic never conflicts with `output: export`.)
export const dynamic = 'force-dynamic';

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
  return <CustomPageView page={page} />;
}

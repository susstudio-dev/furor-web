import { getPublicContent } from '@/lib/content';
import { LegalDoc } from '@/components/LegalDoc';
import { resolvePageMeta } from '@/lib/page-meta';

export async function generateMetadata() {
  const c = await getPublicContent();
  const meta = resolvePageMeta('terms', {
    seoTitle: c.pages.terms.seoTitle,
    seoDescription: c.pages.terms.seoDescription,
    brand: c.site.title,
    derivedTitle: c.pages.terms.intro.headline,
    derivedDescription: c.pages.terms.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/terms' },
  };
}

// Render per request so admin edits show immediately (export build strips this).
export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const c = await getPublicContent();
  const t = c.pages.terms;
  return <LegalDoc intro={t.intro} lastUpdated={t.lastUpdated} sections={t.sections} />;
}

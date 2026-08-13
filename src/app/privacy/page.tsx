import { getPublicContent } from '@/lib/content';
import { LegalDoc } from '@/components/LegalDoc';
import { resolvePageMeta } from '@/lib/page-meta';

export async function generateMetadata() {
  const c = await getPublicContent();
  const meta = resolvePageMeta('privacy', {
    seoTitle: c.pages.privacy.seoTitle,
    seoDescription: c.pages.privacy.seoDescription,
    brand: c.site.title,
    derivedTitle: c.pages.privacy.intro.headline,
    derivedDescription: c.pages.privacy.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/privacy' },
  };
}

// Render per request so admin edits show immediately (export build strips this).
export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const c = await getPublicContent();
  const p = c.pages.privacy;
  return <LegalDoc intro={p.intro} lastUpdated={p.lastUpdated} sections={p.sections} />;
}

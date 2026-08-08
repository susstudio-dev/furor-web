import { getPublicContent } from '@/lib/content';
import { LegalDoc } from '@/components/LegalDoc';
import { fitDescription, fitTitle } from '@/lib/seo';

export async function generateMetadata() {
  const c = await getPublicContent();
  return {
    title: fitTitle(c.pages.privacy.intro.headline || 'Privacy Policy', c.site.title),
    description: fitDescription(
      c.pages.privacy.intro.lead,
      'How Furor Dance Hyderabad collects, uses and protects your information.',
    ),
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

import { getPublicContent } from '@/lib/content';
import { LegalDoc } from '@/components/LegalDoc';

export async function generateMetadata() {
  const c = await getPublicContent();
  return {
    title: c.pages.terms.intro.headline || 'Terms & Services',
    description:
      c.pages.terms.intro.lead ||
      'Terms of service for Furor Dance Hyderabad — classes, payments, conduct and refunds.',
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

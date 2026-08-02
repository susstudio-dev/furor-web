import { getContent } from '@/lib/content';
import { LegalDoc } from '@/components/LegalDoc';

export async function generateMetadata() {
  const c = await getContent();
  return {
    title: c.pages.terms.intro.headline || 'Terms & Services',
    description:
      c.pages.terms.intro.lead ||
      'Terms of service for Furor Dance Hyderabad — classes, payments, conduct and refunds.',
    alternates: { canonical: '/terms' },
  };
}

export default async function TermsPage() {
  const c = await getContent();
  const t = c.pages.terms;
  return <LegalDoc intro={t.intro} lastUpdated={t.lastUpdated} sections={t.sections} />;
}

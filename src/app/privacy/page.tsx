import { getContent } from '@/lib/content';
import { LegalDoc } from '@/components/LegalDoc';

export async function generateMetadata() {
  const c = await getContent();
  return {
    title: c.pages.privacy.intro.headline || 'Privacy Policy',
    description:
      c.pages.privacy.intro.lead ||
      'How Furor Dance Hyderabad collects, uses and protects your information.',
  };
}

export default async function PrivacyPage() {
  const c = await getContent();
  const p = c.pages.privacy;
  return <LegalDoc intro={p.intro} lastUpdated={p.lastUpdated} sections={p.sections} />;
}

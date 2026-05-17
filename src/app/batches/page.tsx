import { getContent, visibleBatches } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { BatchesBrowser, type BatchRow } from '@/components/BatchesBrowser';

export const metadata = { title: 'Batches & Pricing' };

export default async function BatchesPage() {
  const content = await getContent();
  const visible = visibleBatches(content);

  const rows: BatchRow[] = visible.map((b) => {
    const style = content.danceStyles.find((s) => s.slug === b.styleSlug);
    const branch = content.studios.find((s) => s.slug === b.branchSlug);
    return {
      batch: b,
      styleSlug: b.styleSlug,
      styleName: style?.name ?? b.styleSlug,
      branchSlug: b.branchSlug,
      branchName: branch?.name ?? b.branchSlug,
      neighborhood: branch?.neighborhood ?? '',
    };
  });

  const styles = content.danceStyles
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => ({ slug: s.slug, name: s.name }));
  const studios = content.studios
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => ({ slug: s.slug, name: s.name }));

  const courseLd = visible.map((b) => {
    const style = content.danceStyles.find((s) => s.slug === b.styleSlug);
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: `${style?.name ?? b.styleSlug} ${b.level}`,
      description: style?.description ?? '',
      provider: { '@type': 'Organization', name: content.site.title, url: 'https://www.dancehyderabad.com' },
      startDate: b.startDate,
      offers: { '@type': 'Offer', price: b.priceInr, priceCurrency: 'INR' },
    };
  });

  return (
    <>
      <section className="container-x pt-20 pb-8">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Batches & Pricing</p>
        <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
          What&apos;s open. What it costs. Real seats, real dates.
        </h1>
        <p className="mt-4 text-cream/70 max-w-2xl">
          No forms. Pick a batch, tap WhatsApp, and we&apos;ll confirm in minutes.
        </p>
      </section>

      <BatchesBrowser
        rows={rows}
        styles={styles}
        studios={studios}
        whatsappNumber={content.site.whatsappNumber}
        instagramHandle={content.site.instagramHandle}
      />

      {courseLd.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
    </>
  );
}

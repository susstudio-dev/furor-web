import { getContent, visibleBatches, batchStyleLabel } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { BatchesBrowser, type BatchRow } from '@/components/BatchesBrowser';

export const metadata = { title: 'Batches & Pricing' };

// Render per request so admin edits show immediately (export build strips this).
export const dynamic = 'force-dynamic';

export default async function BatchesPage() {
  const content = await getContent();
  const visible = visibleBatches(content);

  const rows: BatchRow[] = visible.map((b) => {
    const branch = content.studios.find((s) => s.slug === b.branchSlug);
    return {
      batch: b,
      styleSlugs: b.styleSlugs,
      styleName: batchStyleLabel(content, b.styleSlugs),
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
    const firstStyle = content.danceStyles.find((s) => s.slug === b.styleSlugs[0]);
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: `${batchStyleLabel(content, b.styleSlugs)} ${b.level}`,
      description: firstStyle?.description ?? '',
      provider: { '@type': 'Organization', name: content.site.title, url: 'https://www.dancehyderabad.com' },
      startDate: b.startDate,
      offers: { '@type': 'Offer', price: b.priceInr, priceCurrency: 'INR' },
    };
  });

  return (
    <>
      <section className="container-x pt-20 pb-8">
        {content.pages.batches.intro.eyebrow ? (
          <p className="display text-sm uppercase tracking-widest text-ember-400">{content.pages.batches.intro.eyebrow}</p>
        ) : null}
        {content.pages.batches.intro.headline ? (
          <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
            {content.pages.batches.intro.headline}
          </h1>
        ) : null}
        {content.pages.batches.intro.lead ? (
          <p className="mt-4 text-cream/70 max-w-2xl">{content.pages.batches.intro.lead}</p>
        ) : null}
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

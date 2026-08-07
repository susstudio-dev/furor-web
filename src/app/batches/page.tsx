import { getPublicContent, visibleBatches, batchStyleLabel } from '@/lib/content';
import { JsonLd } from '@/components/JsonLd';
import { BatchesBrowser, type BatchRow } from '@/components/BatchesBrowser';
import { fitDescription } from '@/lib/seo';

export async function generateMetadata() {
  const c = await getPublicContent();
  return {
    title: 'Batches & Pricing',
    description: fitDescription(
      c.pages.batches.intro.lead,
      'Upcoming Salsa, Bachata and West Coast Swing batches in Hyderabad with transparent pricing.',
    ),
    alternates: { canonical: '/batches' },
  };
}

// Render per request so admin edits show immediately (export build strips this).
export const dynamic = 'force-dynamic';

export default async function BatchesPage() {
  const content = await getPublicContent();
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

  // Course rich-result shape: startDate belongs on the CourseInstance, not
  // the Course (the flat form fails Google's Rich Results validation).
  const courseLd = visible.map((b) => {
    const firstStyle = content.danceStyles.find((s) => s.slug === b.styleSlugs[0]);
    const branch = content.studios.find((s) => s.slug === b.branchSlug);
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: `${batchStyleLabel(content, b.styleSlugs)} ${b.level}`,
      description: firstStyle?.description ?? '',
      provider: { '@type': 'Organization', name: content.site.title, url: 'https://www.dancehyderabad.com' },
      offers: {
        '@type': 'Offer',
        category: 'Paid',
        price: b.priceInr,
        priceCurrency: 'INR',
        availability:
          b.status === 'Filling Fast'
            ? 'https://schema.org/LimitedAvailability'
            : 'https://schema.org/InStock',
      },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'Onsite',
        startDate: b.startDate,
        ...(branch
          ? { location: { '@type': 'Place', name: branch.name, address: branch.address } }
          : {}),
      },
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

      {/* The browser below carried no heading of its own, so this page shipped
          an h1 and nothing else — no signpost between the intro and the list
          for either readers or crawlers. */}
      <section className="container-x pb-2">
        <h2 className="display text-sm uppercase tracking-widest text-ember-400">Every open batch</h2>
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

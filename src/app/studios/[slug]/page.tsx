import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getContent, batchesForBranch, formatBatchDate, formatInr, studioBySlug } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import { Img } from '@/components/Img';

export async function generateStaticParams() {
  const c = await getContent();
  return c.studios.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getContent();
  const s = studioBySlug(c, slug);
  if (!s) return {};
  return { title: `${s.name} Studio`, description: s.address };
}

export default async function StudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getContent();
  const studio = studioBySlug(content, slug);
  if (!studio) notFound();
  const batches = batchesForBranch(content, studio.slug);
  const ld = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'DanceSchool'],
    name: `${content.site.title} — ${studio.name}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: studio.address,
      addressLocality: 'Hyderabad',
      addressRegion: 'Telangana',
      addressCountry: 'IN',
    },
    geo: { '@type': 'GeoCoordinates', latitude: studio.geo.lat, longitude: studio.geo.lng },
    telephone: studio.telephone,
    openingHours: studio.hours,
  };
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${studio.geo.lat},${studio.geo.lng}`;
  const mapEmbed = `https://www.google.com/maps?q=${studio.geo.lat},${studio.geo.lng}&z=15&output=embed`;

  return (
    <>
      <JsonLd data={ld} />
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Img src={studio.photos[0]} alt="" seed={`studio-${studio.slug}`} label={studio.name} fill priority sizes="100vw" className="object-cover animate-kenburns" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/40 to-ink-950" />
        </div>
        <div className="container-x py-24 sm:py-32">
          <p className="pill bg-ember-500/15 text-ember-400">{studio.neighborhood}</p>
          <h1 className="mt-4 display text-5xl font-extrabold sm:text-7xl tracking-tight">{studio.name}</h1>
          <p className="mt-4 max-w-xl text-lg text-cream/80">{studio.address}</p>
          <p className="mt-1 text-cream/60 text-sm">{studio.hours}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              instagramHandle={content.site.instagramHandle}
              ctx={{ source: 'primary', branch: { slug: studio.slug, name: studio.name } }}
              variant="primary"
              label="Chat on WhatsApp"
            />
            <a className="btn-secondary" href={directions} target="_blank" rel="noopener noreferrer">Get directions</a>
          </div>
        </div>
      </section>

      <section className="container-x py-12 grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-cream/10">
            <Img src={studio.photos[i]} alt="" seed={`studio-${studio.slug}-${i}`} label={studio.name} variant={i as 0 | 1 | 2} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
          </div>
        ))}
      </section>

      <section className="container-x py-12 grid gap-12 lg:grid-cols-2">
        <div>
          <p className="display text-sm uppercase tracking-widest text-ember-400">Find us</p>
          <h2 className="mt-2 display text-3xl font-bold">In the heart of {studio.neighborhood}.</h2>
          <p className="mt-3 text-cream/80">{studio.parkingNotes}</p>
          <p className="mt-2 text-cream/60 text-sm">Phone: <a href={`tel:${studio.telephone.replace(/\s/g, '')}`} className="text-ember-400 hover:text-ember-300">{studio.telephone}</a></p>
        </div>
        <div className="aspect-video overflow-hidden rounded-2xl border border-cream/10">
          <iframe
            src={mapEmbed}
            width="100%"
            height="100%"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`${studio.name} map`}
          />
        </div>
      </section>

      <section className="container-x py-12">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Upcoming batches at {studio.name}</p>
        {batches.length === 0 ? (
          <p className="mt-4 text-cream/70">Next batches coming soon — chat with us to be notified.</p>
        ) : (
          <div className="mt-6 grid gap-3">
            {batches.map((b) => {
              const style = content.danceStyles.find((s) => s.slug === b.styleSlug)!;
              return (
                <div key={b.id} className="grid gap-2 rounded-2xl border border-cream/10 bg-ink-900/40 p-5 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="display text-lg font-semibold">{style.name} · {b.level}</p>
                    <p className="text-cream/70 text-sm">{b.daysOfWeek.join('–')} · {b.time} · starts {formatBatchDate(b.startDate)} · {formatInr(b.priceInr)}</p>
                  </div>
                  <EnquiryCTA
                    whatsappNumber={content.site.whatsappNumber}
                    ctx={{ source: 'batch_row', style: { slug: style.slug, name: style.name }, branch: { slug: studio.slug, name: studio.name }, batch: b }}
                    variant="batch-row"
                    label="Enquire"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

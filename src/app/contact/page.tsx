import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';

export const metadata = {
  title: 'Contact',
  description: 'Get in touch with Furor Dance Hyderabad — WhatsApp, Instagram, email or visit the Jubilee Hills studio.',
};

export default async function ContactPage() {
  const content = await getContent();
  const p = content.pages.contact;
  const studios = content.studios.slice().sort((a, b) => a.displayOrder - b.displayOrder);

  const ld = studios[0]
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Furor Dance Hyderabad',
        address: {
          '@type': 'PostalAddress',
          streetAddress: studios[0].address,
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          postalCode: '500033',
          addressCountry: 'IN',
        },
        telephone: studios[0].telephone,
        email: content.site.email,
        openingHours: studios[0].hours,
        url: 'https://www.dancehyderabad.com',
      }
    : undefined;

  return (
    <>
      {ld ? <JsonLd data={ld} /> : null}
      <section className="container-x pt-20 pb-12">
        {p.intro.eyebrow ? (
          <p className="display text-sm uppercase tracking-widest text-ember-400">{p.intro.eyebrow}</p>
        ) : null}
        {p.intro.headline ? (
          <h1 className="mt-3 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
            {p.intro.headline}
          </h1>
        ) : null}
        {p.intro.lead ? (
          <p className="mt-6 max-w-2xl text-cream/75 text-lg">{p.intro.lead}</p>
        ) : null}
      </section>

      <section className="container-x pb-12 grid gap-6 md:grid-cols-3">
        <a
          href={`https://wa.me/${content.site.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-3xl border border-cream/10 bg-ink-900/40 p-7 transition-colors hover:border-ember-400/50"
        >
          <p className="text-xs uppercase tracking-widest text-cream/50">{p.tiles.whatsappLabel}</p>
          <p className="mt-3 display text-2xl font-bold text-cream">+{content.site.whatsappNumber}</p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">{p.tiles.whatsappBody}</p>
          <p className="mt-5 text-ember-400 text-sm group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
            Start a chat →
          </p>
        </a>

        <a
          href={`mailto:${content.site.email}`}
          className="group rounded-3xl border border-cream/10 bg-ink-900/40 p-7 transition-colors hover:border-ember-400/50"
        >
          <p className="text-xs uppercase tracking-widest text-cream/50">{p.tiles.emailLabel}</p>
          <p className="mt-3 display text-2xl font-bold text-cream break-all">{content.site.email}</p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">{p.tiles.emailBody}</p>
          <p className="mt-5 text-ember-400 text-sm inline-flex items-center gap-1">
            Send an email →
          </p>
        </a>

        <a
          href={`https://instagram.com/${content.site.instagramHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-3xl border border-cream/10 bg-ink-900/40 p-7 transition-colors hover:border-ember-400/50"
        >
          <p className="text-xs uppercase tracking-widest text-cream/50">{p.tiles.instagramLabel}</p>
          <p className="mt-3 display text-2xl font-bold text-cream">@{content.site.instagramHandle}</p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">{p.tiles.instagramBody}</p>
          <p className="mt-5 text-ember-400 text-sm inline-flex items-center gap-1">
            DM us →
          </p>
        </a>
      </section>

      {studios.length > 0 ? (
        <section className="container-x py-16 grid gap-12">
          <p className="text-xs uppercase tracking-widest text-ember-400/90">
            {studios.length === 1 ? 'Visit the studio' : 'Visit our studios'}
          </p>
          {studios.map((studio) => {
            const tel = studio.telephone.replace(/\s/g, '');
            const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studio.address)}`;
            const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(studio.address)}&output=embed`;
            return (
              <div key={studio.id} className="grid gap-6 md:grid-cols-2 items-stretch">
                <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-8 sm:p-10 flex flex-col">
                  <p className="display text-3xl font-bold">{studio.name}</p>
                  <div className="mt-6 space-y-4 text-cream/85">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-cream/50">Address</p>
                      <p className="mt-1 leading-relaxed">{studio.address}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-cream/50">Hours</p>
                      <p className="mt-1">{studio.hours}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-cream/50">Phone</p>
                      <p className="mt-1">{studio.telephone}</p>
                    </div>
                    {studio.parkingNotes ? (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-cream/50">Parking</p>
                        <p className="mt-1 text-cream/80">{studio.parkingNotes}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-auto pt-6 flex flex-wrap gap-3">
                    <a href={directions} target="_blank" rel="noopener noreferrer" className="btn-primary">
                      Get directions
                    </a>
                    <a href={`tel:${tel}`} className="btn-secondary">Call us</a>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-900/40 min-h-[360px]">
                  <iframe
                    src={mapEmbed}
                    title={`Map to ${studio.name}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0 h-full w-full"
                    style={{ border: 0, filter: 'grayscale(0.4) contrast(1.05)' }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {p.closingCta.headline ? (
      <section className="container-x py-16">
        <div className="rounded-3xl bg-gradient-to-br from-ember-700 via-ember-600 to-gold-500 p-10 sm:p-14 text-ink-950">
          <h2 className="display text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl">
            {p.closingCta.headline}
          </h2>
          {p.closingCta.body ? (
            <p className="mt-3 text-ink-950/80 max-w-xl">{p.closingCta.body}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary' }}
              variant="primary"
              label="Chat on WhatsApp"
              className="!bg-ink-950 !text-cream hover:!bg-ink-800"
            />
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              instagramHandle={content.site.instagramHandle}
              ctx={{ source: 'primary' }}
              channel="instagram"
              variant="secondary"
              label="DM on Instagram"
              className="!border-ink-950/40 !text-ink-950 hover:!border-ink-950"
            />
          </div>
        </div>
      </section>
      ) : null}
    </>
  );
}

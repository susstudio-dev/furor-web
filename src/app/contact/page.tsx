import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';

export const metadata = {
  title: 'Contact',
  description: 'Get in touch with Furor Dance Hyderabad — WhatsApp, Instagram, email or visit the Jubilee Hills studio.',
};

export default async function ContactPage() {
  const content = await getContent();
  const studio = content.studios[0];
  const tel = studio?.telephone.replace(/\s/g, '');
  const directions = studio
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studio.address)}`
    : '';
  const mapEmbed = studio
    ? `https://www.google.com/maps?q=${encodeURIComponent(studio.address)}&output=embed`
    : '';

  const ld = studio
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Furor Dance Hyderabad',
        address: {
          '@type': 'PostalAddress',
          streetAddress: studio.address,
          addressLocality: 'Hyderabad',
          addressRegion: 'Telangana',
          postalCode: '500033',
          addressCountry: 'IN',
        },
        telephone: studio.telephone,
        email: content.site.email,
        openingHours: studio.hours,
        url: 'https://www.dancehyderabad.com',
      }
    : undefined;

  return (
    <>
      {ld ? <JsonLd data={ld} /> : null}
      <section className="container-x pt-20 pb-12">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Contact</p>
        <h1 className="mt-3 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
          One tap away. We&apos;re listening.
        </h1>
        <p className="mt-6 max-w-2xl text-cream/75 text-lg">
          WhatsApp is fastest. Email if you&apos;d rather. Walk in if you&apos;re in the neighbourhood.
        </p>
      </section>

      <section className="container-x pb-12 grid gap-6 md:grid-cols-3">
        <a
          href={`https://wa.me/${content.site.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-3xl border border-cream/10 bg-ink-900/40 p-7 transition-colors hover:border-ember-400/50"
        >
          <p className="text-xs uppercase tracking-widest text-cream/50">WhatsApp · fastest</p>
          <p className="mt-3 display text-2xl font-bold text-cream">+91 88860 72572</p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">
            Reply in minutes during studio hours. Slower late nights, but we get to it.
          </p>
          <p className="mt-5 text-ember-400 text-sm group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
            Start a chat →
          </p>
        </a>

        <a
          href={`mailto:${content.site.email}`}
          className="group rounded-3xl border border-cream/10 bg-ink-900/40 p-7 transition-colors hover:border-ember-400/50"
        >
          <p className="text-xs uppercase tracking-widest text-cream/50">Email</p>
          <p className="mt-3 display text-2xl font-bold text-cream break-all">{content.site.email}</p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">
            Best for corporate enquiries, partnerships and longer questions that need attachments.
          </p>
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
          <p className="text-xs uppercase tracking-widest text-cream/50">Instagram</p>
          <p className="mt-3 display text-2xl font-bold text-cream">@{content.site.instagramHandle}</p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">
            DM us on Instagram — see the dance floor before you book a class.
          </p>
          <p className="mt-5 text-ember-400 text-sm inline-flex items-center gap-1">
            DM us →
          </p>
        </a>
      </section>

      {studio ? (
        <section className="container-x py-16">
          <div className="grid gap-6 md:grid-cols-2 items-stretch">
            <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-8 sm:p-10 flex flex-col">
              <p className="text-xs uppercase tracking-widest text-ember-400/90">Visit the studio</p>
              <p className="mt-3 display text-3xl font-bold">{studio.name}</p>
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
        </section>
      ) : null}

      <section className="container-x py-16">
        <div className="rounded-3xl bg-gradient-to-br from-ember-700 via-ember-600 to-gold-500 p-10 sm:p-14 text-ink-950">
          <h2 className="display text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl">
            Ready when you are.
          </h2>
          <p className="mt-3 text-ink-950/80 max-w-xl">
            Tell us which style sounds like you. We&apos;ll handle the rest in WhatsApp — class times, prices, what to bring.
          </p>
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
    </>
  );
}

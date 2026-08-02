import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';

export const metadata = {
  title: 'Contact',
  description: 'Get in touch with Furor Dance Hyderabad — WhatsApp, Instagram, email or visit the Jubilee Hills studio.',
  alternates: { canonical: '/contact' },
};

// The DanceSchool/LocalBusiness JSON-LD is emitted site-wide from the root
// layout (one node per studio, with geo + sameAs) — no page-local copy here.
export default async function ContactPage() {
  const content = await getContent();
  const p = content.pages.contact;
  const studios = content.studios.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  // Long addresses have to wrap somewhere. Offer the break at the "@" so it
  // reads as two halves of an address instead of "…dancehyderabad." / "com",
  // which is what break-all produced.
  const [emailLocal, ...emailRest] = (content.site.email ?? '').split('@');
  const emailDomain = emailRest.join('@');

  return (
    <>
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

      {/* Each tile is a flex column so the "go" link is pushed to the bottom
          with mt-auto. Without it the links follow the body text, and the
          email's two-line address dropped its link ~40px below the others. */}
      {/* 2-up before 3-up: at 768px a three-column grid leaves each tile 161px
          of content, and "+918886072572" needs 175px — it silently overflowed
          its own padding. The third tile orphaning onto row 2 between 640 and
          1023px is the cheaper trade. */}
      <section className="container-x pb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <a
          href={`https://wa.me/${content.site.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col rounded-3xl border border-cream/10 bg-ink-900/40 p-7 transition-colors hover:border-ember-400/50"
        >
          <p className="text-xs uppercase tracking-widest text-cream/70">{p.tiles.whatsappLabel}</p>
          <p className="mt-3 display text-lg md:text-xl font-bold text-cream">
            +{content.site.whatsappNumber}
          </p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">{p.tiles.whatsappBody}</p>
          <span className="mt-auto pt-5 self-start text-ember-400 text-sm inline-flex items-center gap-1">
            Start a chat
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </span>
        </a>

        <a
          href={`mailto:${content.site.email}`}
          className="group flex flex-col rounded-3xl border border-cream/10 bg-ink-900/40 p-7 transition-colors hover:border-ember-400/50"
        >
          <p className="text-xs uppercase tracking-widest text-cream/70">{p.tiles.emailLabel}</p>
          {/* `anywhere`, not `break-word`: only `anywhere` and `break-all`
              reduce an element's min-content contribution, and the unbreakable
              "@dancehyderabad.com" atom was forcing 26px of horizontal page
              scroll at 320px. The <wbr/> keeps the *preferred* break at the @;
              `anywhere` only engages if even the domain half can't fit. */}
          <p className="mt-3 display text-lg md:text-xl font-bold text-cream [overflow-wrap:anywhere]">
            {emailLocal}
            <wbr />
            {emailDomain ? `@${emailDomain}` : ''}
          </p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">{p.tiles.emailBody}</p>
          <span className="mt-auto pt-5 self-start text-ember-400 text-sm inline-flex items-center gap-1">
            Send an email
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </span>
        </a>

        <a
          href={`https://instagram.com/${content.site.instagramHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col rounded-3xl border border-cream/10 bg-ink-900/40 p-7 transition-colors hover:border-ember-400/50"
        >
          <p className="text-xs uppercase tracking-widest text-cream/70">{p.tiles.instagramLabel}</p>
          <p className="mt-3 display text-lg md:text-xl font-bold text-cream">
            @{content.site.instagramHandle}
          </p>
          <p className="mt-3 text-sm text-cream/70 leading-relaxed">{p.tiles.instagramBody}</p>
          <span className="mt-auto pt-5 self-start text-ember-400 text-sm inline-flex items-center gap-1">
            DM us
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </span>
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
                  {/* An <h2>, not a <p>: these are the second-largest type on
                      the page and were leaving the outline as h1 → nothing. */}
                  <h2 className="display text-3xl font-bold">{studio.name}</h2>
                  <div className="mt-6 space-y-4 text-cream/85">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-cream/70">Address</p>
                      <p className="mt-1 leading-relaxed">{studio.address}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-cream/70">Hours</p>
                      <p className="mt-1">{studio.hours}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-cream/70">Phone</p>
                      <p className="mt-1">{studio.telephone}</p>
                    </div>
                    {studio.parkingNotes ? (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-cream/70">Parking</p>
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
        <div className="on-accent accent-panel rounded-3xl p-10 sm:p-14">
          <h2 className="display text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl">
            {p.closingCta.headline}
          </h2>
          {p.closingCta.body ? (
            <p className="mt-3 text-on-ember max-w-xl">{p.closingCta.body}</p>
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
              className="!border-on-ember/45 !text-on-ember hover:!border-on-ember"
            />
          </div>
        </div>
      </section>
      ) : null}
    </>
  );
}

import { getContent } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import { Img } from '@/components/Img';

export const metadata = { title: 'Instructors' };

export default async function InstructorsPage() {
  const content = await getContent();
  const p = content.pages.instructorsPage;
  const personLd = content.instructors.map((i) => ({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: i.name,
    jobTitle: i.role,
    description: i.shortBio,
    sameAs: i.social.instagram ? [i.social.instagram] : undefined,
  }));

  return (
    <>
      <section className="container-x pt-20 pb-8">
        {p.intro.eyebrow ? (
          <p className="display text-sm uppercase tracking-widest text-ember-400">{p.intro.eyebrow}</p>
        ) : null}
        {p.intro.headline ? (
          <h1 className="mt-2 display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
            {p.intro.headline}
          </h1>
        ) : null}
        {p.intro.lead ? (
          <p className="mt-4 max-w-2xl text-cream/75 text-lg">{p.intro.lead}</p>
        ) : null}
      </section>

      <section className="container-x py-10 space-y-10">
        {content.instructors.map((i, idx) => {
          const styleNames = i.styleSlugs
            .map((slug) => content.danceStyles.find((s) => s.slug === slug)?.name)
            .filter(Boolean) as string[];
          const branchNames = i.branchSlugs
            .map((slug) => content.studios.find((s) => s.slug === slug)?.name)
            .filter(Boolean) as string[];
          const paragraphs = i.shortBio.split('\n\n').filter(Boolean);
          return (
            <article
              key={i.id}
              className="rounded-3xl border border-cream/10 bg-ink-900/40 p-6 sm:p-8"
            >
              <header className="flex flex-wrap items-center gap-5">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24">
                  <Img
                    src={i.photo}
                    alt={i.name}
                    seed={`instructor-${i.id}`}
                    label={i.name}
                    variant={(idx % 4) as 0 | 1 | 2 | 3}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="display text-2xl font-bold sm:text-3xl">{i.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-ember-400/90">{i.role}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {styleNames.map((n) => (
                      <span key={n} className="pill bg-cream/5 text-cream/80 text-xs">{n}</span>
                    ))}
                    {branchNames.map((n) => (
                      <span key={n} className="pill bg-ember-500/10 text-ember-400 text-xs">{n}</span>
                    ))}
                  </div>
                </div>
                {i.social.instagram ? (
                  <a
                    href={i.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-ember-400 hover:text-ember-300"
                  >
                    Instagram <span aria-hidden>↗</span>
                  </a>
                ) : null}
              </header>
              <div className="mt-6 border-t border-cream/10 pt-6 max-w-3xl">
                <p className="text-cream/80 leading-relaxed">{paragraphs[0]}</p>
                {paragraphs.length > 1 ? (
                  <details className="group mt-4">
                    <summary className="cursor-pointer list-none inline-flex items-center gap-1 text-sm text-ember-400 hover:text-ember-300 marker:hidden">
                      <span className="group-open:hidden">Know more</span>
                      <span className="hidden group-open:inline">Show less</span>
                      <span aria-hidden className="transition-transform group-open:rotate-180">↓</span>
                    </summary>
                    <div className="mt-4 space-y-4 text-cream/80 leading-relaxed">
                      {paragraphs.slice(1).map((p, n) => (
                        <p key={n}>{p}</p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {content.testimonials.length > 0 ? (() => {
        const styleName = (slug?: string) =>
          slug ? content.danceStyles.find((s) => s.slug === slug)?.name : undefined;
        const [featured, ...rest] = content.testimonials;
        const featuredStyle = styleName(featured.styleSlug);
        return (
          <section className="container-x py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                {p.testimonialsHeader.eyebrow ? (
                  <p className="display text-sm uppercase tracking-widest text-ember-400">{p.testimonialsHeader.eyebrow}</p>
                ) : null}
                {p.testimonialsHeader.headline ? (
                  <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl tracking-tight">
                    {p.testimonialsHeader.headline}
                  </h2>
                ) : null}
              </div>
              <p className="text-cream/60 text-sm">
                {content.testimonials.length} stories · all verified
              </p>
            </div>

            {/* Featured quote */}
            <figure className="mt-12 relative overflow-hidden rounded-3xl border border-ember-400/20 bg-gradient-to-br from-ink-900/80 via-ink-900/60 to-ember-700/10 p-8 sm:p-12">
              <span
                aria-hidden
                className="display absolute -top-6 -left-2 text-[12rem] sm:text-[16rem] leading-none text-ember-500/15 font-extrabold pointer-events-none select-none"
              >
                “
              </span>
              <div className="relative">
                <Stars />
                <blockquote className="mt-6 display text-2xl sm:text-4xl font-semibold text-cream leading-snug tracking-tight max-w-4xl">
                  {featured.text}
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-4">
                  <span className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full bg-ember-500/20 text-ember-300 display text-xl font-bold ring-2 ring-ember-400/30">
                    {featured.studentName.charAt(0)}
                  </span>
                  <div>
                    <p className="display text-lg sm:text-xl text-cream font-semibold">{featured.studentName}</p>
                    {featuredStyle ? (
                      <p className="text-xs uppercase tracking-widest text-ember-400/90">{featuredStyle} · Furor Hyderabad</p>
                    ) : null}
                  </div>
                </figcaption>
              </div>
            </figure>

            {/* Remaining quotes */}
            {rest.length > 0 ? (
              <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((t) => {
                  const sName = styleName(t.styleSlug);
                  return (
                    <figure
                      key={t.id}
                      className="group relative flex flex-col rounded-2xl border border-cream/10 bg-ink-900/40 p-6 transition-colors hover:border-ember-400/40"
                    >
                      <span
                        aria-hidden
                        className="display absolute top-3 right-4 text-5xl leading-none text-ember-400/20 font-extrabold pointer-events-none select-none"
                      >
                        “
                      </span>
                      <Stars small />
                      <blockquote className="mt-4 text-cream/90 leading-relaxed">
                        {t.text}
                      </blockquote>
                      <figcaption className="mt-6 flex items-center gap-3 border-t border-cream/10 pt-4">
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-ember-500/15 text-ember-400 display font-bold">
                          {t.studentName.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="display text-cream font-semibold truncate">{t.studentName}</p>
                          {sName ? (
                            <p className="text-xs uppercase tracking-widest text-ember-400/80">{sName}</p>
                          ) : null}
                        </div>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })() : null}

      {p.closingCta.headline ? (
      <section className="container-x py-16">
        <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-10">
          <h2 className="display text-3xl font-bold">{p.closingCta.headline}</h2>
          {p.closingCta.body ? (
            <p className="mt-2 text-cream/70 max-w-xl">{p.closingCta.body}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary' }}
              variant="primary"
              label="Chat on WhatsApp"
            />
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              instagramHandle={content.site.instagramHandle}
              ctx={{ source: 'primary' }}
              channel="instagram"
              variant="secondary"
              label="DM on Instagram"
            />
          </div>
        </div>
      </section>
      ) : null}

      {personLd.map((d, i) => <JsonLd key={i} data={d} />)}
    </>
  );
}

function Stars({ small }: { small?: boolean }) {
  const size = small ? 14 : 18;
  return (
    <div className="flex gap-0.5 text-gold-400" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.5l2.92 6.32L22 9.9l-5.2 4.86L18.18 22 12 18.4 5.82 22l1.38-7.24L2 9.9l7.08-1.08L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

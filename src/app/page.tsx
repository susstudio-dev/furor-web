import Link from 'next/link';
import { getPublicContent, nextBatchPerStyle, visibleBatches, formatBatchDate, formatInr, batchStyleLabel } from '@/lib/content';
import { resolvePageMeta } from '@/lib/page-meta';
import { heroPoster } from '@/lib/image-variants';

export async function generateMetadata() {
  const c = await getPublicContent();
  const styleNames = c.danceStyles
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => s.name);
  const classes =
    styleNames.length > 1
      ? `${styleNames.slice(0, -1).join(', ')} & ${styleNames[styleNames.length - 1]}`
      : styleNames[0] || 'Dance';
  // Two lead styles, not all three. "Furor — Dance Hyderabad | Salsa, Bachata
  // & West Coast Swing Classes" ran to 71 characters — a SERP shows ~60, so the
  // city was being cut off, which is the one word this page most needs to rank
  // for. West Coast Swing has its own page and stays in the description.
  const lead = styleNames.slice(0, 2).join(' & ') || 'Dance';
  const meta = resolvePageMeta('home', {
    seoTitle: c.pages.home.seoTitle,
    seoDescription: c.pages.home.seoDescription,
    brand: c.site.title,
    derivedTitle: `${lead} Classes in Hyderabad`,
    // Decoupled from hero.subHeadline (spec §6.3). SEO copy should stop
    // dictating what a first-time visitor reads, and the sub-headline is being
    // trimmed to ~130 characters — a meta description is not what it is for.
    derivedDescription: c.site.tagline,
    supportDescription: `${classes} classes in Jubilee Hills, Hyderabad.`,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/' },
  };
}
import { JsonLd } from '@/components/JsonLd';
import { tonightEventLd } from '@/lib/tonight-event';
import { todayIso } from '@/lib/format';
import { Hero } from '@/components/Hero';
import { KineticStrip } from '@/components/KineticStrip';
import { TrialBanner } from '@/components/TrialBanner';
import { StyleFinder } from '@/components/StyleFinder';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { label } from '@/lib/labels';
import { bookLabel } from '@/lib/book-label';
import { TonightTile } from '@/components/TonightTile';
import { RhythmSignature } from '@/components/RhythmSignature';
import { Img } from '@/components/Img';
import { Accentuate } from '@/components/Accentuate';
import { Reveal } from '@/components/Reveal';
import { QuickEnroll } from '@/components/QuickEnroll';
import { StickyTrialBar } from '@/components/StickyTrialBar';
import { BatchActions } from '@/components/BatchActions';

// Render per request so admin edits show immediately and no stale/blip HTML is
// cached. The GitHub Pages export workflow strips this line (static export
// forbids dynamic rendering).
export const dynamic = 'force-dynamic';

// The two hero preload <link>s below need a single-URL `href` — the HTML
// spec's fallback for a browser that ignores imagesrcset/imagesizes.
// `poster.landscape.jpg` is a srcset string (one or more width-tagged URLs);
// this pulls the first URL out of it. `poster.portrait.jpgSrc` already is a
// bare URL, so it needs no help.
function firstUrl(srcSet: string): string {
  return srcSet.split(',')[0].trim().split(' ')[0];
}

export default async function HomePage() {
  const content = await getPublicContent();
  const sortedStyles = content.danceStyles.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  const sortedStudios = content.studios.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  const nextPerStyle = nextBatchPerStyle(content);
  // todayIso() is passed in rather than read inside the builder so the node is
  // deterministic and the IST business date is the one that decides which
  // Saturday is "next".
  const eventLd = tonightEventLd(content, todayIso());
  const h = content.pages.home;
  const bookable = visibleBatches(content);
  const trialFrom = bookable.length ? Math.min(...bookable.map((b) => b.reservationInr)) : null;
  const trialLabel = `${bookLabel('Foundation', content.labels)}${
    trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''
  }`;
  // Resolved here, not inside Hero: Hero is a client component, and
  // importing the variant manifest there would ship it in the client bundle
  // for no reason. Computed once so the preload <link>s below and the prop
  // passed to <Hero> agree on the exact same files.
  const poster = heroPoster(content.hero.posterImage);

  return (
    <>
      {poster ? (
        <>
          {/* Hand-written resource preloads for the hero's LCP image,
              rendered here (a Server Component) rather than inside Hero
              ('use client'). React only hoists a JSX <link> into <head>
              when it carries a real string `href` — react-dom's SSR
              renderer checks `typeof props.href === 'string'` before
              treating a <link> as a hoistable Resource. An earlier version
              of this tag carried only `imageSrcSet` and no `href`, so it
              rendered inert in <body>, after the <picture> it was meant to
              preload. `type`/`media` on each tag match its corresponding
              <source> in Hero's <picture> exactly, so a browser that will
              end up choosing WebP/JPEG simply ignores an AVIF preload it
              can't decode rather than fetching a wasted file. */}
          <link
            rel="preload"
            as="image"
            type="image/avif"
            media="(max-width: 639px)"
            href={poster.portrait.jpgSrc}
            imageSrcSet={poster.portrait.avif}
            imageSizes="100vw"
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            type="image/avif"
            media="(min-width: 640px)"
            href={firstUrl(poster.landscape.jpg)}
            imageSrcSet={poster.landscape.avif}
            imageSizes="100vw"
            fetchPriority="high"
          />
        </>
      ) : null}
      <Hero content={content} poster={poster} />

      {/* Fast lane: join a real batch before the brochure even starts. */}
      <QuickEnroll content={content} trialFrom={trialFrom} />

      {/* The After-Band wrapper: everything below the board shares a container
          whose LAST child is the mobile sticky trial bar — sticky clamping
          makes the bar appear only after the visitor scrolls past the board,
          with zero JS. See StickyTrialBar. */}
      <div className="relative">

      {/* Emitted only when the social's venue, weekday and start time are all
          filled in — see tonight-event.ts. A node without location and
          startDate cannot earn an Event rich result, so we ship none rather
          than assert something we don't know. */}
      {eventLd ? <JsonLd data={eventLd} /> : null}

      {/* La Rumba sits directly under the booking board, not eleven sections
          down. Spec §6.2 chose moving this tile over building a separate
          ribbon: it is richer, already admin-editable, already carries its
          RSVP CTA, and adds no second La Rumba surface to keep in sync. */}
      <TonightTile content={content} />

      <KineticStrip styles={sortedStyles} />

      <TrialBanner content={content} />

      {/* What we teach */}
      {/* `isolate` is load-bearing: without a stacking context the -z-10 child
          below escapes to the root negative layer and paints *underneath*
          .stage-lights, which is why this count was invisible. */}
      {/* overflow-CLIP, not hidden: `hidden` is still a scroll container, and
          the drifting "8" below hangs 40px past the right edge — so any
          scrollIntoView or keyboard focus in this section scrolled it 40px
          left and left every heading and card permanently misaligned. `clip`
          cannot be scrolled. */}
      <section className="container-x py-12 sm:py-16 relative isolate overflow-clip">
        {/* Depth: a giant faint count drifts behind the grid as you scroll —
            the room has layers, not a flat page. Scroll-driven CSS, no JS. */}
        <div
          aria-hidden
          className="drift pointer-events-none absolute -right-10 -top-6 -z-10 hidden select-none sm:block"
        >
          <span className="display block text-[16rem] font-extrabold leading-none text-cream/[0.05]">
            8
          </span>
        </div>
        <Reveal>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <p className="display text-sm uppercase tracking-widest text-ember-400">{h.whatWeTeach.eyebrow}</p>
                <RhythmSignature style="salsa" loop width={84} className="text-ember-500/70" />
              </div>
              <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-xl">
                <Accentuate text={h.whatWeTeach.headline} />
              </h2>
            </div>
            <Link href="/dance-styles" className="btn-secondary magnetic">
              {label(content.labels, 'ctaAllStyles')}
            </Link>
          </div>
        </Reveal>
          <Reveal stagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sortedStyles.map((s) => (
            <Link
              key={s.slug}
              href={`/dance-styles/${s.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-900/40"
            >
              <div className="relative aspect-[4/5]">
                <Img
                  src={s.heroImage}
                  alt={s.name}
                  seed={`style-${s.slug}`}
                  label={s.name}
                  fill
                  className="object-cover object-[center_30%] transition duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="flex items-center justify-between">
                  <p className="display text-3xl font-bold text-cream">{s.name}</p>
                  <RhythmSignature style={s.slug} width={120} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-1 text-sm text-cream/70">{s.tagline}</p>
                <p className="mt-4 inline-flex items-center text-ember-400 text-sm">
                  {label(content.labels, 'ctaExplore')}
                </p>
              </div>
            </Link>
          ))}
          </Reveal>
      </section>

      {/* Next batches strip */}
      <section className="container-x py-12">
        <Reveal>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <p className="display text-sm uppercase tracking-widest text-ember-400">{h.nextBatches.eyebrow}</p>
                <RhythmSignature style="bachata" loop width={84} className="text-ember-500/70" />
              </div>
              <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">
                {h.nextBatches.headline}
              </h2>
            </div>
            <Link href="/batches" className="btn-secondary magnetic">
              {label(content.labels, 'ctaSeeAllBatches')}
            </Link>
          </div>
        </Reveal>
        <Reveal stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedStyles.map((s) => {
            const hit = nextPerStyle.get(s.slug);
            const b = hit?.batch;
            // True when this style has no Foundation batch and we are showing
            // a higher level instead. Labelled rather than hidden: a beginner
            // should not be quietly pointed at an Advanced room, and an
            // experienced dancer should still find their lane.
            const isFallback = hit?.isFallback ?? false;
            const branch = b ? content.studios.find((st) => st.slug === b.branchSlug) : undefined;
            const combined = b && b.styleSlugs.length > 1;
            return (
              <div
                key={s.slug}
                className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5"
              >
                <p className="display text-xl font-bold">
                  {combined ? batchStyleLabel(content, b!.styleSlugs) : s.name}
                </p>
                {b && branch ? (
                  <>
                    <p className="mt-2 text-sm text-cream/70">
                      {b.level} · {branch.name}
                      {combined ? h.nextBatches.combinedSuffix : ''}
                    </p>
                    {isFallback ? (
                      <p className="mt-1 text-sm text-gold-400">
                        Danced before? No Foundation batch open for {s.name} right now.
                      </p>
                    ) : null}
                    <p className="mt-1 text-cream">{b.daysOfWeek.join('–')} · {b.time}</p>
                    <p className="text-sm text-cream/60 mt-1">
                      {h.nextBatches.starts
                        .replace('{date}', formatBatchDate(b.startDate))
                        .replace('{price}', formatInr(b.priceInr))}
                    </p>
                    {typeof b.seatsLeft === 'number' ? (
                      <p className="pill mt-3 bg-gold-500/15 text-gold-400">
                        {h.nextBatches.seatsLeft.replace('{n}', String(b.seatsLeft))}
                      </p>
                    ) : null}
                    <div className="mt-4">
                      <BatchActions
                        batch={b}
                        style={{ slug: s.slug, name: s.name }}
                        branch={{ slug: branch.slug, name: branch.name }}
                        whatsappNumber={content.site.whatsappNumber}
                        labels={content.labels}
                        templates={content.site.whatsappTemplates}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-cream/60">
                      {label(content.labels, 'emptyNextBatchSoon').replace('{style}', s.name)}
                    </p>
                    <div className="mt-4">
                      <EnquiryCTA
                        whatsappNumber={content.site.whatsappNumber}
                        ctx={{
                          source: 'batch_row',
                          style: { slug: s.slug, name: s.name },
                        }}
                        variant="batch-row"
                        labels={content.labels}
                        templates={content.site.whatsappTemplates}
                        label={label(content.labels, 'ctaNotifyWhatsapp')}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </Reveal>
      </section>

      {/* Why Furor */}
      {content.whyFuror.points.length > 0 ? (
        <section className="container-x py-12 sm:py-16">
          <Reveal>
            <div className="flex items-center gap-3">
              <p className="display text-sm uppercase tracking-widest text-ember-400">{h.whyFurorEyebrow}</p>
              <RhythmSignature style="west-coast-swing" loop width={84} className="text-ember-500/70" />
            </div>
            <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">
              {content.whyFuror.headline}
            </h2>
          </Reveal>
          <Reveal stagger className="mt-12 grid gap-8 md:grid-cols-3">
            {content.whyFuror.points.map((p, i) => (
              <div key={i} className="rounded-2xl border border-cream/10 bg-ink-900/30 p-6">
                <p className="display text-2xl font-bold text-ember-400">0{i + 1}</p>
                <p className="mt-3 display text-xl font-semibold">{p.title}</p>
                <p className="mt-2 text-cream/70">{p.body}</p>
              </div>
            ))}
          </Reveal>
        </section>
      ) : null}

      {h.howItWorks.steps.length > 0 ? (
        <section className="container-x py-12 sm:py-16">
          <Reveal>
            <p className="display text-sm uppercase tracking-widest text-ember-400">{h.howItWorks.eyebrow}</p>
            <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">
              {h.howItWorks.headline}
            </h2>
          </Reveal>
          <Reveal stagger className="mt-12 grid gap-6 md:grid-cols-3">
            {h.howItWorks.steps.map((s, i, arr) => (
              <div key={i} className="relative rounded-2xl border border-cream/10 bg-ink-900/30 p-6">
                <p className="display text-2xl font-bold text-ember-400">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="mt-3 display text-xl font-semibold">{s.title}</p>
                <p className="mt-2 text-cream/70">{s.body}</p>
                {i < arr.length - 1 ? (
                  <span aria-hidden className="hidden md:block absolute top-1/2 -right-3 text-ember-400/50">→</span>
                ) : null}
              </div>
            ))}
          </Reveal>
        </section>
      ) : null}

      {/* Style finder */}
      <StyleFinder content={content} />

      {/* Closing CTA */}
      <section className="container-x py-14 sm:py-20">
        <Reveal className="on-accent accent-panel rounded-3xl p-10 sm:p-16">
          <h2 className="display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
            <Accentuate text={h.closingCta.headline} />
          </h2>
          {h.closingCta.body ? (
            <p className="mt-3 text-on-ember max-w-xl text-lg">{h.closingCta.body}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#start-this-week"
              className="btn-primary !bg-ink-950 !text-cream hover:!bg-ink-800 magnetic"
            >
              {trialLabel}
            </a>
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary' }}
              variant="secondary"
              labels={content.labels}
              templates={content.site.whatsappTemplates}
              label={label(content.labels, 'ctaChatOnWhatsapp')}
              className="!border-on-ember/45 !text-on-ember hover:!border-on-ember magnetic"
            />
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              instagramHandle={content.site.instagramHandle}
              ctx={{ source: 'primary' }}
              channel="instagram"
              variant="secondary"
              labels={content.labels}
              templates={content.site.whatsappTemplates}
              className="!border-on-ember/45 !text-on-ember hover:!border-on-ember magnetic"
            />
          </div>
        </Reveal>
      </section>

      {sortedStudios.length > 0 ? (
        <section id="visit" className="container-x py-12 sm:py-16">
          <Reveal>
            <p className="display text-sm uppercase tracking-widest text-ember-400">{h.visitUs.eyebrow}</p>
            <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl tracking-tight">
              {sortedStudios.length === 1
                ? h.visitUs.headlineTemplate.replace('{neighborhood}', sortedStudios[0].neighborhood)
                : h.visitUs.headlineTemplate.replace(
                    '{neighborhood}',
                    sortedStudios
                      .map((s) => s.neighborhood)
                      .filter((n, i, a) => a.indexOf(n) === i)
                      .join(' & '),
                  )}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-12">
            {sortedStudios.map((s) => {
              const styleNames = s.styleSlugs
                .map((slug) => sortedStyles.find((x) => x.slug === slug)?.name)
                .filter(Boolean) as string[];
              const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`;
              const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(s.address)}&output=embed`;
              const tel = s.telephone.replace(/\s/g, '');
              return (
                <div key={s.id}>
                  <Reveal className="grid gap-6 md:grid-cols-2 items-stretch">
                    <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-8 sm:p-10 flex flex-col">
                      <h3 className="display text-2xl sm:text-3xl font-bold">{s.name}</h3>
                      <p className="mt-1 text-xs uppercase tracking-widest text-ember-400/80">
                        {content.site.title}
                      </p>
                      <div className="mt-6 space-y-4 text-cream/85">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-cream/70">{h.visitUs.addressLabel}</p>
                          <p className="mt-1 leading-relaxed">{s.address}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-widest text-cream/70">{h.visitUs.hoursLabel}</p>
                          <p className="mt-1">{s.hours}</p>
                        </div>
                        {s.parkingNotes ? (
                          <div>
                            <p className="text-xs uppercase tracking-widest text-cream/70">{h.visitUs.parkingLabel}</p>
                            <p className="mt-1 text-cream/80">{s.parkingNotes}</p>
                          </div>
                        ) : null}
                        {styleNames.length > 0 ? (
                          <div>
                            <p className="text-xs uppercase tracking-widest text-cream/70">{h.visitUs.teachHereLabel}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {styleNames.map((n) => (
                                <span key={n} className="pill bg-cream/5 text-cream/80">{n}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-auto pt-6 flex flex-wrap gap-3">
                        <a href={directions} target="_blank" rel="noopener noreferrer" className="btn-primary">
                          {label(content.labels, 'ctaGetDirections')}
                        </a>
                        <a href={`tel:${tel}`} className="btn-secondary">{h.visitUs.callTemplate.replace('{phone}', s.telephone)}</a>
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-900/40 min-h-[360px]">
                      <iframe
                        src={mapEmbed}
                        title={h.visitUs.mapTitle.replace('{studio}', s.name)}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="absolute inset-0 h-full w-full"
                        style={{ border: 0, filter: 'grayscale(0.4) contrast(1.05)' }}
                      />
                    </div>
                  </Reveal>
                  {s.photos.length > 0 ? (
                    <Reveal stagger className="mt-6 grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3">
                      {s.photos.slice(0, 3).map((p, i) => (
                        <div
                          key={`${p}-${i}`}
                          className={`relative aspect-[4/3] overflow-hidden rounded-2xl border border-cream/10 bg-ink-900/40 ${
                            i === 0 ? 'col-span-2 md:col-span-1' : ''
                          }`}
                        >
                          <Img
                            src={p}
                            alt={h.visitUs.photoAlt.replace('{studio}', s.name)}
                            seed={`${s.slug}-${i}`}
                            fill
                            className="object-cover transition duration-700 hover:scale-[1.04]"
                          />
                        </div>
                      ))}
                    </Reveal>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <StickyTrialBar
        whatsappNumber={content.site.whatsappNumber}
        label={trialLabel}
        labels={content.labels}
        templates={content.site.whatsappTemplates}
      />
      </div>
    </>
  );
}

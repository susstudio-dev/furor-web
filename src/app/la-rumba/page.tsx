import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicContent, visibleBatches, formatInr } from '@/lib/content';
import { resolvePageMeta } from '@/lib/page-meta';
import { trialFromInr } from '@/lib/book-label';
import { tonightEventLd } from '@/lib/tonight-event';
import { todayIso } from '@/lib/format';
import { resolveVoices, socialFactsLine } from '@/lib/la-rumba-page';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';

export async function generateMetadata() {
  const c = await getPublicContent();
  const p = c.pages.laRumba;
  const meta = resolvePageMeta('laRumba', {
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    brand: c.site.title,
    derivedDescription: p.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/la-rumba' },
    // A social that is switched off must not be indexed even if a crawler
    // still holds the URL from when it was on.
    ...(c.tonight.enabled ? {} : { robots: { index: false, follow: false } }),
  };
}

// Render per request so admin edits show immediately, matching /about.
export const dynamic = 'force-dynamic';

// The page for the half of the product that classes do not cover: PRODUCT.md's
// "classes teach; La Rumba retains".
//
// The shaping constraint is what we DON'T know. Entry is paid at the venue and
// varies by the night, and the format varies week to week (owner, 2026-08-25),
// so this page cannot publish a schedule or a price and must not invent one. A
// page that hedges four times is worthless, so the variability is made the
// mechanism instead: the permanent facts carry the page and WhatsApp answers
// "what's on this Saturday?" — the only channel that can actually be current.
export default async function LaRumbaPage() {
  const content = await getPublicContent();
  // Same gate RumbaBand and TonightFloat use. A page describing a social that
  // is switched off must not be reachable, not merely empty.
  if (!content.tonight.enabled) notFound();

  const p = content.pages.laRumba;
  const t = content.tonight;
  const facts = socialFactsLine(t);
  const voices = resolveVoices(content.testimonials, p.voices.testimonialIds);
  const trialFrom = trialFromInr(visibleBatches(content));
  const eventLd = tonightEventLd(content, todayIso());

  return (
    <>
      {eventLd ? <JsonLd data={eventLd} /> : null}

      {/* 1 — Hero. The name at wordmark scale over one real photograph. */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Img
            src={p.heroPhoto.src}
            alt={p.heroPhoto.alt}
            seed="la-rumba-hero"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-ink-950/70" />
        </div>
        <div className="container-x py-24 sm:py-32 lg:py-40">
          {p.intro.eyebrow ? (
            <p className="display text-sm uppercase tracking-widest text-ember-400">
              {p.intro.eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 display text-5xl font-extrabold tracking-tight text-cream sm:text-7xl">
            {p.intro.headline}
          </h1>
          {facts ? (
            <p className="mt-4 display text-sm font-semibold uppercase tracking-widest text-gold-400">
              {facts}
            </p>
          ) : null}
          {p.intro.lead ? (
            <p className="mt-4 max-w-2xl text-lg text-cream/80">{p.intro.lead}</p>
          ) : null}
          <div className="mt-8">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'la_rumba_page', customNote: p.weekly.ctaContext }}
              variant="primary"
              labels={content.labels}
              templates={content.site.whatsappTemplates}
              label={p.heroCtaLabel}
            />
          </div>
        </div>
      </section>

      {/* 2 — Reassure. The fears, answered before they are asked. */}
      {p.reassure.items.length > 0 ? (
        <section className="container-x py-16 sm:py-20">
          <Reveal>
            {p.reassure.eyebrow ? (
              <p className="display text-sm uppercase tracking-widest text-ember-400">
                {p.reassure.eyebrow}
              </p>
            ) : null}
            {p.reassure.headline ? (
              <h2 className="mt-2 display text-3xl font-bold sm:text-4xl max-w-2xl">
                {p.reassure.headline}
              </h2>
            ) : null}
          </Reveal>
          <Reveal stagger className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {p.reassure.items.map((item, i) => (
              <div key={`${item.title}-${i}`}>
                <p className="display font-bold text-cream">{item.title}</p>
                <p className="mt-1.5 text-sm text-cream/70">{item.body}</p>
              </div>
            ))}
          </Reveal>
        </section>
      ) : null}

      {/* 3 — Gallery. The strongest asset on the page: real nights. */}
      {p.gallery.photos.length > 0 ? (
        <section className="container-x py-12 sm:py-16">
          <Reveal>
            {p.gallery.eyebrow ? (
              <p className="display text-sm uppercase tracking-widest text-ember-400">
                {p.gallery.eyebrow}
              </p>
            ) : null}
            {p.gallery.headline ? (
              <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">{p.gallery.headline}</h2>
            ) : null}
          </Reveal>
          <Reveal stagger className="mt-8 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            {p.gallery.photos.map((photo, i) => (
              <div
                key={`${photo.src}-${i}`}
                className={`relative overflow-hidden rounded-2xl border border-cream/10 bg-ink-900/40 ${
                  i % 5 === 0 ? 'aspect-[4/3] sm:col-span-2' : 'aspect-square'
                }`}
              >
                <Img
                  src={photo.src}
                  alt={photo.alt}
                  seed={`la-rumba-${i}`}
                  fill
                  className="object-cover transition duration-700 hover:scale-[1.04]"
                />
              </div>
            ))}
          </Reveal>
        </section>
      ) : null}

      {/* 4 — Voices. */}
      {voices.length > 0 ? (
        <section className="container-x py-12 sm:py-16">
          <Reveal>
            {p.voices.eyebrow ? (
              <p className="display text-sm uppercase tracking-widest text-ember-400">
                {p.voices.eyebrow}
              </p>
            ) : null}
            {p.voices.headline ? (
              <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">{p.voices.headline}</h2>
            ) : null}
          </Reveal>
          <Reveal stagger className="mt-8 grid gap-6 md:grid-cols-2">
            {voices.map((v) => (
              <figure key={v.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
                <blockquote className="italic text-cream/85">&ldquo;{v.text}&rdquo;</blockquote>
                <figcaption className="mt-2 text-xs text-cream/55">— {v.studentName}</figcaption>
              </figure>
            ))}
          </Reveal>
        </section>
      ) : null}

      {/* 5 — The spine. What we don't know, said plainly, with the one channel
          that does know attached to it. */}
      <section className="container-x py-12 sm:py-16">
        <Reveal className="rounded-3xl border border-ember-500/30 bg-ember-500/5 p-8 sm:p-12">
          {p.weekly.eyebrow ? (
            <p className="display text-sm uppercase tracking-widest text-ember-400">
              {p.weekly.eyebrow}
            </p>
          ) : null}
          {p.weekly.headline ? (
            <h2 className="mt-2 display text-3xl font-bold sm:text-4xl max-w-2xl">
              {p.weekly.headline}
            </h2>
          ) : null}
          {p.weekly.body ? (
            <p className="mt-3 max-w-2xl text-cream/75">{p.weekly.body}</p>
          ) : null}
          <div className="mt-6">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'la_rumba_page', customNote: p.weekly.ctaContext }}
              variant="primary"
              labels={content.labels}
              templates={content.site.whatsappTemplates}
              label={p.weekly.ctaLabel}
            />
          </div>
        </Reveal>
      </section>

      {/* 6 — Floor to classroom. The price comes from the same helper the board
          uses, so the two surfaces can never print different numbers. */}
      <section className="container-x pb-20 sm:pb-28">
        <Reveal>
          {p.classCta.eyebrow ? (
            <p className="display text-sm uppercase tracking-widest text-ember-400">
              {p.classCta.eyebrow}
            </p>
          ) : null}
          {p.classCta.headline ? (
            <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">{p.classCta.headline}</h2>
          ) : null}
          {p.classCta.body ? <p className="mt-3 max-w-2xl text-cream/75">{p.classCta.body}</p> : null}
          <Link
            href="/batches"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-ember-600 px-5 py-2 text-sm font-semibold text-on-ember transition hover:bg-ember-700"
          >
            {p.classCta.ctaLabel}
            {trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''}
          </Link>
        </Reveal>
      </section>
    </>
  );
}

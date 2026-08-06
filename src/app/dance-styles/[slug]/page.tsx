import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicContent, batchesForStyle, formatBatchDate, formatInr, styleBySlug, batchStyleLabel } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { BatchActions } from '@/components/BatchActions';
import { JsonLd } from '@/components/JsonLd';
import { Img } from '@/components/Img';
import { breadcrumbLd, courseLd, truncateAtWord } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublicContent();
  const s = styleBySlug(c, slug);
  if (!s) return {};
  return {
    title: `${s.name} Classes in Hyderabad`,
    description: truncateAtWord(`${s.tagline} ${s.description}`),
    alternates: { canonical: `/dance-styles/${s.slug}` },
    openGraph: {
      title: `${s.name} Classes in Hyderabad`,
      description: s.tagline,
      // A page-level openGraph replaces the layout's wholesale — keep the
      // brand card as fallback or styles without a hero lose og:image.
      images: [s.heroImage || '/og.png'],
    },
  };
}

export default async function StylePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getPublicContent();
  const style = styleBySlug(content, slug);
  if (!style) notFound();
  const batches = batchesForStyle(content, style.slug);

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: style.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={faqLd} />
      <JsonLd data={courseLd(content, style)} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Dance Styles', path: '/dance-styles' },
          { name: style.name, path: `/dance-styles/${style.slug}` },
        ])}
      />
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Img
            src={style.heroImage}
            alt=""
            seed={`style-${style.slug}`}
            label={style.name}
            fill
            priority
            sizes="100vw"
            // Anchor the subject hard right on portrait mobile so the dancer
            // isn't cropped to the centre of the frame.
            className="object-cover object-[78%_38%] sm:object-[center_30%] animate-kenburns"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/45 to-transparent" />
        </div>
        <div className="container-x pt-16 pb-14 sm:py-24 lg:py-32 max-w-[44rem] sm:max-w-none">
          <h1 className="pill bg-ember-500/15 text-ember-400">
            {style.name}
            <span className="sr-only"> classes in Hyderabad</span>
          </h1>
          <p className="mt-4 display text-[2.4rem] sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight max-w-[18ch] sm:max-w-4xl">{style.tagline}</p>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-cream/80">{style.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              instagramHandle={content.site.instagramHandle}
              ctx={{ source: 'primary', style: { slug: style.slug, name: style.name } }}
              variant="primary"
              label="Chat on WhatsApp"
            />
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              instagramHandle={content.site.instagramHandle}
              ctx={{ source: 'primary', style: { slug: style.slug, name: style.name } }}
              channel="instagram"
              variant="secondary"
              label="DM on Instagram"
            />
          </div>
        </div>
      </section>

      <section className="container-x py-20">
        <h2 className="display text-sm uppercase tracking-widest text-ember-400">Who it&apos;s for</h2>
        <p className="mt-3 display text-2xl sm:text-3xl max-w-3xl text-cream/90">{style.whoItsFor}</p>
      </section>

      <section className="container-x py-12">
        <h2 className="display text-sm uppercase tracking-widest text-ember-400">Level path</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {(['foundation', 'intermediate', 'advanced'] as const).map((k) => (
            <div key={k} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
              <p className="display text-2xl font-bold capitalize text-ember-400">{k}</p>
              <p className="mt-3 text-cream/80">{style.levelOutcomes[k]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x py-12">
        <h2 className="display text-sm uppercase tracking-widest text-ember-400">Upcoming batches</h2>
        {batches.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-cream/10 bg-ink-900/40 p-8">
            <p className="text-cream/80">
              Next {style.name} batch coming soon — chat with us to be notified.
            </p>
            <div className="mt-4">
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                ctx={{ source: 'primary', style: { slug: style.slug, name: style.name } }}
                variant="primary"
                label={`Notify me about ${style.name}`}
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {batches.map((b) => {
              const branch = content.studios.find((s) => s.slug === b.branchSlug)!;
              const combined = b.styleSlugs.length > 1;
              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-4 rounded-2xl border border-cream/10 bg-ink-900/40 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="grid gap-1">
                    <p className="display text-lg font-semibold">
                      {combined ? `${batchStyleLabel(content, b.styleSlugs)} · ` : ''}{b.level} · {branch.name}
                    </p>
                    <p className="text-cream/70 text-sm">
                      {b.daysOfWeek.join('–')} · {b.time} · starts {formatBatchDate(b.startDate)}
                    </p>
                    <p className="text-cream/70 text-sm">{formatInr(b.priceInr)} {b.status === 'Filling Fast' ? <span className="pill ml-2 bg-gold-500/15 text-gold-400">Filling fast</span> : null}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <BatchActions
                      batch={b}
                      style={{ slug: style.slug, name: style.name }}
                      branch={{ slug: branch.slug, name: branch.name }}
                      whatsappNumber={content.site.whatsappNumber}
                      primaryLabelWhenNoLink="Enquire"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {style.faqs.length > 0 ? (
        <section className="container-x py-20">
          <h2 className="display text-sm uppercase tracking-widest text-ember-400">Questions, asked</h2>
          <div className="mt-6 grid gap-3">
            {style.faqs.map((f, i) => (
              <details key={i} className="group rounded-2xl border border-cream/10 bg-ink-900/40 p-5">
                <summary className="cursor-pointer display text-lg font-semibold text-cream marker:hidden">{f.q}</summary>
                <p className="mt-3 text-cream/80">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

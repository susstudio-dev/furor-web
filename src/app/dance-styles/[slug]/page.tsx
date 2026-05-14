import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getContent, batchesForStyle, formatBatchDate, formatInr, styleBySlug } from '@/lib/content';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { JsonLd } from '@/components/JsonLd';
import { Img } from '@/components/Img';
import { RhythmSignature } from '@/components/RhythmSignature';

export async function generateStaticParams() {
  const c = await getContent();
  return c.danceStyles.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getContent();
  const s = styleBySlug(c, slug);
  if (!s) return {};
  return { title: s.name, description: s.tagline };
}

export default async function StylePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getContent();
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
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Img src={style.heroImage} alt="" seed={`style-${style.slug}`} label={style.name} fill priority sizes="100vw" className="object-cover animate-kenburns" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 via-ink-950/45 to-ink-950/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
        </div>
        <div className="container-x py-24 sm:py-32">
          <p className="pill bg-ember-500/15 text-ember-400">{style.name}</p>
          <h1 className="mt-4 display text-5xl font-extrabold sm:text-7xl tracking-tight max-w-4xl">{style.tagline}</h1>
          <p className="mt-6 max-w-2xl text-lg text-cream/80">{style.description}</p>
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
        <p className="display text-sm uppercase tracking-widest text-ember-400">Who it&apos;s for</p>
        <p className="mt-3 display text-2xl sm:text-3xl max-w-3xl text-cream/90">{style.whoItsFor}</p>
      </section>

      <section className="container-x py-12">
        <p className="display text-sm uppercase tracking-widest text-ember-400">Level path</p>
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
        <p className="display text-sm uppercase tracking-widest text-ember-400">Upcoming batches</p>
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
              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-4 rounded-2xl border border-cream/10 bg-ink-900/40 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="grid gap-1">
                    <p className="display text-lg font-semibold">
                      {b.level} · {branch.name}
                    </p>
                    <p className="text-cream/70 text-sm">
                      {b.daysOfWeek.join('–')} · {b.time} · starts {formatBatchDate(b.startDate)}
                    </p>
                    <p className="text-cream/70 text-sm">{formatInr(b.priceInr)} {b.status === 'Filling Fast' ? <span className="pill ml-2 bg-gold-500/15 text-gold-400">Filling fast</span> : null}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <EnquiryCTA
                      whatsappNumber={content.site.whatsappNumber}
                      ctx={{
                        source: 'batch_row',
                        style: { slug: style.slug, name: style.name },
                        branch: { slug: branch.slug, name: branch.name },
                        batch: b,
                      }}
                      variant="batch-row"
                      label="Enquire"
                    />
                    {b.razorpayLink ? (
                      <a className="btn-secondary text-sm" href={b.razorpayLink} target="_blank" rel="noopener noreferrer">Pre-register</a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {style.faqs.length > 0 ? (
        <section className="container-x py-20">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Questions, asked</p>
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

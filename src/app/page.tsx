import Link from 'next/link';
import { getContent, nextBatchPerStyle, formatBatchDate, formatInr } from '@/lib/content';
import { Hero } from '@/components/Hero';
import { KineticStrip } from '@/components/KineticStrip';
import { LiveCounter } from '@/components/LiveCounter';
import { StyleFinder } from '@/components/StyleFinder';
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { TonightTile } from '@/components/TonightTile';
import { RhythmSignature } from '@/components/RhythmSignature';
import { Img } from '@/components/Img';

export default async function HomePage() {
  const content = await getContent();
  const sortedStyles = content.danceStyles.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  const sortedStudios = content.studios.slice().sort((a, b) => a.displayOrder - b.displayOrder);
  const nextPerStyle = nextBatchPerStyle(content);
  const studentsThisWeek = content.site.stats?.studentsThisWeek;
  const showCounter = typeof studentsThisWeek === 'number' && studentsThisWeek > 0;

  return (
    <>
      <Hero content={content} />

      <KineticStrip styles={sortedStyles} />

      {/* What we teach */}
      <section className="container-x py-24 sm:py-28">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="display text-sm uppercase tracking-widest text-ember-400">What we teach</p>
            <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-xl">
              Three dances. A lifetime of nights.
            </h2>
          </div>
          <Link href="/dance-styles" className="btn-secondary">
            All styles
          </Link>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.04]"
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
                  Explore →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Next batches strip */}
      <section className="container-x py-12">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="display text-sm uppercase tracking-widest text-ember-400">Next batches</p>
            <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">
              Doors open. Pick a date.
            </h2>
          </div>
          <Link href="/batches" className="btn-secondary">
            See all batches
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedStyles.map((s) => {
            const b = nextPerStyle.get(s.slug);
            const branch = b ? content.studios.find((st) => st.slug === b.branchSlug) : undefined;
            return (
              <div
                key={s.slug}
                className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5"
              >
                <p className="display text-xl font-bold">{s.name}</p>
                {b && branch ? (
                  <>
                    <p className="mt-2 text-sm text-cream/70">
                      {b.level} · {branch.name}
                    </p>
                    <p className="mt-1 text-cream">{b.daysOfWeek.join('–')} · {b.time}</p>
                    <p className="text-sm text-cream/60 mt-1">
                      Starts {formatBatchDate(b.startDate)} · {formatInr(b.priceInr)}
                    </p>
                    {typeof b.seatsLeft === 'number' ? (
                      <p className="pill mt-3 bg-gold-500/15 text-gold-400">
                        {b.seatsLeft} seats left
                      </p>
                    ) : null}
                    <div className="mt-4">
                      <EnquiryCTA
                        whatsappNumber={content.site.whatsappNumber}
                        ctx={{
                          source: 'batch_row',
                          style: { slug: s.slug, name: s.name },
                          branch: { slug: branch.slug, name: branch.name },
                          batch: b,
                        }}
                        variant="batch-row"
                        label="Enquire on WhatsApp"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-cream/60">
                      Next {s.name} batch coming soon.
                    </p>
                    <div className="mt-4">
                      <EnquiryCTA
                        whatsappNumber={content.site.whatsappNumber}
                        ctx={{
                          source: 'batch_row',
                          style: { slug: s.slug, name: s.name },
                        }}
                        variant="batch-row"
                        label="Notify me on WhatsApp"
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Furor */}
      {content.whyFuror.points.length > 0 ? (
        <section className="container-x py-24 sm:py-28">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Why Furor</p>
          <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">
            {content.whyFuror.headline}
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {content.whyFuror.points.map((p, i) => (
              <div key={i} className="rounded-2xl border border-cream/10 bg-ink-900/30 p-6">
                <p className="display text-2xl font-bold text-ember-400">0{i + 1}</p>
                <p className="mt-3 display text-xl font-semibold">{p.title}</p>
                <p className="mt-2 text-cream/70">{p.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Studios */}
      <section className="container-x py-12">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="display text-sm uppercase tracking-widest text-ember-400">Two studios</p>
            <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">Hyderabad, twice over.</h2>
          </div>
          <Link href="/studios" className="btn-secondary">All studios</Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {sortedStudios.map((s) => (
            <Link
              key={s.slug}
              href={`/studios/${s.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-900/40"
            >
              <div className="relative aspect-[16/9]">
                <Img
                  src={s.photos[0]}
                  alt={s.name}
                  seed={`studio-${s.slug}`}
                  label={s.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="display text-2xl font-bold">{s.name}</p>
                <p className="mt-1 text-sm text-cream/70">{s.address}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Live counter */}
      {showCounter ? (
        <LiveCounter
          value={studentsThisWeek!}
          label="students dancing with us this week"
        />
      ) : null}

      {/* Style finder */}
      <StyleFinder content={content} />

      {/* Testimonials */}
      {content.testimonials.length > 0 ? (
        <section className="container-x py-24 sm:py-28">
          <p className="display text-sm uppercase tracking-widest text-ember-400">In their words</p>
          <h2 className="mt-2 display text-3xl font-bold sm:text-5xl max-w-2xl">
            What our students keep telling us.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {content.testimonials.slice(0, 6).map((t) => (
              <figure
                key={t.id}
                className="rounded-2xl border border-cream/10 bg-ink-900/30 p-6"
              >
                <blockquote className="text-cream/90 leading-relaxed">“{t.text}”</blockquote>
                <figcaption className="mt-4 text-sm text-cream/60">
                  — {t.studentName}
                  {t.styleSlug ? <span className="text-ember-400/70"> · {t.styleSlug}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <TonightTile content={content} />

      {/* Closing CTA */}
      <section className="container-x py-24 sm:py-32">
        <div className="rounded-3xl bg-gradient-to-br from-ember-700 via-ember-600 to-gold-500 p-10 sm:p-16 text-ink-950">
          <h2 className="display text-4xl font-extrabold sm:text-6xl tracking-tight max-w-3xl">
            Ready when you are. We&apos;re one tap away.
          </h2>
          <p className="mt-3 text-ink-950/80 max-w-xl text-lg">
            Tell us which style sounds like you. We&apos;ll handle the rest in WhatsApp — class times, prices, what to bring.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary' }}
              variant="primary"
              label="Chat on WhatsApp"
              className="!bg-ink-950 !text-cream hover:!bg-ink-800 magnetic"
            />
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              instagramHandle={content.site.instagramHandle}
              ctx={{ source: 'primary' }}
              channel="instagram"
              variant="secondary"
              label="DM on Instagram"
              className="!border-ink-950/40 !text-ink-950 hover:!border-ink-950 magnetic"
            />
          </div>
        </div>
      </section>
    </>
  );
}

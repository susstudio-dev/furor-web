import Link from 'next/link';
import type { SiteContent } from '@/lib/content-schema';
import { visibleBatches, formatBatchDate, formatInr } from '@/lib/content';
import { EnquiryCTA } from './EnquiryCTA';
import { Reveal } from './Reveal';
import { RhythmSignature } from './RhythmSignature';

// The fast lane, styled like the lineup board outside a club: it overlaps
// the hero so its glowing top edge peeks above the fold and pulls you in.
// Each batch is an entry pass — one tap to a pre-filled WhatsApp sign-up.
// No account, no form, no payment wall: the studio's real enrolment path,
// front and centre.

export function QuickEnroll({ content }: { content: SiteContent }) {
  const batches = visibleBatches(content).slice(0, 4);
  const styleName = (slug: string) =>
    content.danceStyles.find((s) => s.slug === slug)?.name ?? slug;
  const branchOf = (slug: string) => content.studios.find((s) => s.slug === slug);

  return (
    <section
      id="start-this-week"
      className="container-x relative z-20 -mt-20 scroll-mt-24 pb-2 sm:-mt-28"
    >
      <Reveal className="quick-enroll relative overflow-hidden rounded-[28px] border border-cream/12 bg-ink-900/80 shadow-2xl shadow-ember-700/10 backdrop-blur-2xl">
        {/* Glowing marquee top edge — this is what peeks over the fold. */}
        <div className="h-1.5 w-full bg-gradient-to-r from-ember-600 via-gold-500 to-ember-600" />

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Live "booking open" indicator */}
              <span className="inline-flex items-center gap-2 rounded-full border border-ember-500/30 bg-ember-500/10 px-3 py-1">
                <span className="beat-dot inline-block h-2 w-2 rounded-full bg-ember-500" />
                <span className="display text-[11px] font-bold uppercase tracking-[0.25em] text-ember-400">
                  Booking open
                </span>
              </span>
              <RhythmSignature
                style={batches[0]?.styleSlug ?? 'salsa'}
                loop
                width={90}
                className="hidden text-ember-500/60 sm:inline-block"
              />
            </div>
            <p className="text-sm text-cream/55">
              Sign up in ~30s on WhatsApp · no account, no payment yet
            </p>
          </div>

          <h2 className="mt-4 display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Start dancing <span className="accent">this week.</span>
          </h2>
          <p className="mt-1 text-cream/65">
            Pick a batch below — one tap and you&apos;re on the floor.
          </p>

          {batches.length > 0 ? (
            <>
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {batches.map((b) => {
                  const branch = branchOf(b.branchSlug);
                  const sName = styleName(b.styleSlug);
                  const filling = b.status === 'Filling Fast';
                  return (
                    <div
                      key={b.id}
                      className="enroll-ticket group relative flex flex-col rounded-2xl border border-cream/12 bg-gradient-to-b from-ink-800/80 to-ink-900/60 p-5 transition duration-300 hover:-translate-y-1 hover:border-ember-500/60 hover:shadow-xl hover:shadow-ember-700/15"
                    >
                      {/* Perforated pass edge */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-1/2 h-full w-[2px] -translate-y-1/2 [background:repeating-linear-gradient(to_bottom,rgb(var(--c-cream)/0.25)_0_5px,transparent_5px_11px)]"
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="display text-xl font-bold leading-tight">{sName}</p>
                          <p className="mt-0.5 text-xs uppercase tracking-wider text-cream/55">
                            {b.level}
                          </p>
                        </div>
                        <span
                          className={`pill ${
                            filling
                              ? 'bg-ember-500/20 text-ember-400'
                              : 'bg-gold-500/15 text-gold-400'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="mt-4 space-y-1 text-sm">
                        <p className="text-cream">{b.daysOfWeek.join('–')} · {b.time}</p>
                        <p className="text-cream/60">{branch?.name ?? b.branchSlug}</p>
                        <p className="text-cream/60">
                          {formatBatchDate(b.startDate)} ·{' '}
                          <span className="text-cream/80">{formatInr(b.priceInr)}</span>
                        </p>
                      </div>
                      {typeof b.seatsLeft === 'number' ? (
                        <p className="mt-3 text-xs font-semibold text-ember-400">
                          ● {b.seatsLeft} seat{b.seatsLeft === 1 ? '' : 's'} left
                        </p>
                      ) : (
                        <span className="mt-3 block h-[1px]" />
                      )}
                      <div className="mt-4">
                        <EnquiryCTA
                          whatsappNumber={content.site.whatsappNumber}
                          ctx={{
                            source: 'batch_row',
                            style: { slug: b.styleSlug, name: sName },
                            branch: branch
                              ? { slug: branch.slug, name: branch.name }
                              : undefined,
                            batch: b,
                          }}
                          variant="batch-row"
                          label="Reserve my seat →"
                          className="w-full justify-center magnetic"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-cream/10 pt-5">
                <Link
                  href="#style-finder"
                  className="group inline-flex items-center gap-2 text-sm text-cream/75 transition hover:text-cream"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-cream/20 text-ember-400 transition group-hover:border-ember-500/60">
                    ?
                  </span>
                  Not sure which? Take the 30-second style finder →
                </Link>
                <Link href="/batches" className="btn-secondary magnetic">
                  See all batches &amp; prices
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cream/12 bg-ink-800/60 p-6">
              <div>
                <p className="display text-lg font-bold">New batches drop every week.</p>
                <p className="mt-1 text-sm text-cream/65">
                  Tell us your style — we&apos;ll hold you a seat in the next one.
                </p>
              </div>
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                ctx={{
                  source: 'primary',
                  customNote:
                    'Hi! I want to join a dance batch — please let me know the next start dates.',
                }}
                variant="primary"
                label="Grab a seat on WhatsApp"
                className="magnetic"
              />
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}

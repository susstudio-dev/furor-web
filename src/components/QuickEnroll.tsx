import Link from 'next/link';
import type { SiteContent } from '@/lib/content-schema';
import { visibleBatches, formatBatchDate, formatInr, batchStyleLabel } from '@/lib/content';
import { EnquiryCTA } from './EnquiryCTA';

// The fast lane, styled like the lineup board outside a club: it overlaps
// the hero so its glowing top edge peeks above the fold and pulls you in.
// Each batch is an entry pass — one tap to a pre-filled WhatsApp sign-up.
// No account, no form, no payment wall: the studio's real enrolment path,
// front and centre.

export function QuickEnroll({ content }: { content: SiteContent }) {
  const batches = visibleBatches(content).slice(0, 4);
  const branchOf = (slug: string) => content.studios.find((s) => s.slug === slug);

  return (
    <section
      id="start-this-week"
      className="container-x relative z-20 -mt-20 scroll-mt-24 pb-10 sm:-mt-28 sm:pb-14"
    >
      {/* Deliberately NOT a <Reveal>. This is the conversion card and its whole
          design intent is that its lit edge peeks above the fold — it must
          never wait on an entrance to become visible. Dropping the entrance
          also removes a backdrop-filter that was re-blurring a ~350×1400px
          region on every frame of a translate, over a layer that animates
          opacity forever.

          The glass look is faked on an opaque fill — see .quick-enroll in
          globals.css. At any alpha the hero photograph showed through the top
          of the card on the light theme, where ink-900 is plain white. */}
      <div className="quick-enroll relative overflow-hidden rounded-[28px] border border-cream/12">
        {/* A single lit hairline along the top edge. One hue only: pairing
            ember with gold-500 reads as a red-to-blue rainbow in dark theme,
            where that token is the brand's royal blue. Fades out at both ends
            so it doesn't butt into the corner radius. */}
        <div
          aria-hidden
          className="h-0.5 w-full bg-gradient-to-r from-transparent via-ember-500 to-transparent"
        />

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Solid badge, not a tint. A 10%-alpha ember pill with ember
                  text washed out to near-nothing on the light theme's white
                  card — a live status has to read as live in both themes, so
                  it sits on solid ember with the fixed on-ember foreground. */}
              <span className="inline-flex items-center gap-2 rounded-full bg-ember-600 px-3 py-1.5 shadow-sm shadow-ember-700/30">
                <span className="relative flex h-2 w-2">
                  <span className="beat-ring absolute inset-0 rounded-full bg-on-ember/60" />
                  <span className="relative inline-block h-2 w-2 rounded-full bg-on-ember" />
                </span>
                <span className="display text-[11px] font-bold uppercase tracking-[0.25em] text-on-ember">
                  Booking open
                </span>
              </span>
            </div>
            <p className="text-sm text-cream/70">
              Reserve your seat in ~30s · secure checkout via Razorpay
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
                  const sName = batchStyleLabel(content, b.styleSlugs);
                  const filling = b.status === 'Filling Fast';
                  return (
                    <div
                      key={b.id}
                      className="enroll-ticket group relative flex flex-col rounded-2xl border border-cream/12 bg-gradient-to-b from-ink-800/80 to-ink-900/60 p-5 transition duration-300 hover:-translate-y-1 hover:border-ember-500/60 hover:shadow-xl hover:shadow-ember-700/15"
                    >
                      {/* No perforated stub edge here any more: a 2px dashed
                          rule floating just inside the rounded corner didn't
                          read as a ticket, it read as a rendering artefact.
                          The ticket idea now lives in the card's own shape. */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="display text-xl font-bold leading-tight">{sName}</p>
                          <p className="mt-0.5 text-xs uppercase tracking-wider text-cream/70">
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
                      <div className="mt-auto pt-4">
                        {b.razorpayLink ? (
                          <a
                            href={b.razorpayLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-ember-600 px-4 py-2 text-sm font-semibold text-on-ember transition hover:bg-ember-700 magnetic"
                          >
                            Reserve my seat · {formatInr(b.reservationInr)}
                          </a>
                        ) : (
                          <EnquiryCTA
                            whatsappNumber={content.site.whatsappNumber}
                            ctx={{
                              source: 'batch_row',
                              style: { slug: b.styleSlugs[0], name: sName },
                              branch: branch
                                ? { slug: branch.slug, name: branch.name }
                                : undefined,
                              batch: b,
                            }}
                            variant="batch-row"
                            label="Reserve my seat →"
                            className="w-full justify-center magnetic"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-cream/10 pt-5">
                <Link
                  href="#style-finder"
                  className="group inline-flex min-h-[44px] items-center gap-2 py-2 text-sm text-cream/75 transition hover:text-cream"
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
      </div>
    </section>
  );
}

import Link from 'next/link';
import type { Batch, SiteContent } from '@/lib/content-schema';
import { visibleBatches, formatBatchDate, formatInr, batchStyleLabel } from '@/lib/content';
import { compareByLevel } from '@/lib/batch-order';
import { BookTrialLink } from './BookTrialLink';
import { EnquiryCTA } from './EnquiryCTA';

// The booking board — the conversion surface, styled like the lineup board
// outside a club, overlapping the hero so its lit edge peeks above the fold.
//
// The board sells the ₹500 trial as the product: level-first ordering puts
// Foundation in front of the never-danced visitor (a date-sorted board could
// open with an Advanced card), the first Foundation batch sits under a literal
// spotlight, the trial price leads every card with the program price as quiet
// context, and the count-in strip answers the four documented beginner fears
// at the exact point of decision — resolving, like every dance, on the 1.

/** Up to 3 soonest Foundation batches + 1 soonest higher-level batch, so the
 *  board reads as one obvious beginner lane plus a door for dancers who know
 *  their level. Falls back to a straight level-first slice on sparse data. */
function pickBoard(content: SiteContent): Batch[] {
  const sorted = [...visibleBatches(content)].sort(compareByLevel);
  const foundation = sorted.filter((b) => b.level === 'Foundation');
  const higher = sorted.filter((b) => b.level !== 'Foundation');
  if (foundation.length >= 3 && higher.length >= 1) {
    return [...foundation.slice(0, 3), higher[0]];
  }
  return sorted.slice(0, 4);
}

// Items 5-7 are backed by live site copy (FAQ / hero); item 8's refund promise
// was confirmed by the owner on 2026-08-06 — the truth constraint on this
// codebase is absolute, so none of these lines ship unverified.
function countIn(trialPrice: string | null): { count: string; title: string; body: string }[] {
  return [
    { count: '5', title: 'Come alone.', body: 'No partner needed — partners rotate all class, so you’ll dance with everyone.' },
    { count: '6', title: 'Never danced?', body: 'Foundation assumes zero experience. Most of the room started exactly there.' },
    { count: '7', title: 'Wear anything.', body: 'Anything comfortable you can move in — fresh socks or smooth soles beat fancy shoes.' },
    {
      count: '8',
      title: 'Nothing to lose.',
      body: trialPrice
        ? `If the first class isn’t for you, your ${trialPrice} comes back — just tell us on WhatsApp.`
        : 'If the first class isn’t for you, your token comes back — just tell us on WhatsApp.',
    },
  ];
}

export function QuickEnroll({
  content,
  trialFrom,
}: {
  content: SiteContent;
  /** Cheapest trial across ALL visible batches — computed once in the page so
   *  the hero, the sticky bar and this board can never print two different
   *  refund amounts on one screen. */
  trialFrom: number | null;
}) {
  const batches = pickBoard(content);
  const branchOf = (slug: string) => content.studios.find((s) => s.slug === slug);
  // Real proof at the point of decision — rendered from the content document
  // so the admin stays the source of truth; nothing renders if it's removed.
  const proof =
    content.testimonials.find((t) => t.id === 'test-003') ?? content.testimonials[0] ?? null;
  const proofStyle = proof
    ? content.danceStyles.find((s) => s.slug === proof.styleSlug)?.name
    : null;

  return (
    // The negative margin pulls the card up over the hero's reserved bottom
    // padding so the lit edge and "Booking open" badge sit inside the FIRST
    // viewport. The hero's pb-36/44/48 exists precisely to absorb this.
    <section
      id="start-this-week"
      className="container-x relative z-20 -mt-24 scroll-mt-24 pb-10 sm:-mt-32 lg:-mt-36 sm:pb-14"
    >
      {/* Deliberately NOT a <Reveal>: the conversion card must never wait on an
          entrance. The glass look is faked on an opaque fill — see .quick-enroll
          in globals.css. */}
      <div className="quick-enroll relative overflow-hidden rounded-[28px] border border-cream/12">
        {/* The lit top border — a luminance ramp within ember; the soft glow
            underneath makes it read as light on glass, not a printed rule. */}
        <div aria-hidden className="relative h-[3px] w-full">
          <div className="absolute inset-0 [background:linear-gradient(to_right,transparent,rgb(var(--c-ember-600)/0.9)_28%,rgb(var(--c-ember-400))_50%,rgb(var(--c-ember-600)/0.9)_72%,transparent)]" />
          <div className="absolute inset-x-[14%] inset-y-0 bg-ember-500/50 blur-[6px]" />
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-ember-600 px-3 py-1.5 shadow-sm shadow-ember-700/30">
              <span className="relative flex h-2 w-2">
                <span className="beat-ring absolute inset-0 rounded-full bg-on-ember/60" />
                <span className="relative inline-block h-2 w-2 rounded-full bg-on-ember" />
              </span>
              <span className="display text-[11px] font-bold uppercase tracking-[0.25em] text-on-ember">
                Booking open
              </span>
            </span>
            {/* Batch-agnostic on purpose: not every booking link is a Razorpay
                checkout, so the header makes no per-provider claim. */}
            <p className="text-sm text-cream/70">Book in ~30 seconds</p>
          </div>

          <h2 className="mt-4 display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Start dancing <span className="accent">this week.</span>
          </h2>
          <p className="mt-1 text-cream/65 max-w-2xl">
            {trialFrom != null
              ? `Every batch opens with a ${formatInr(trialFrom)} trial class — come once, meet the room, then decide on the full program.`
              : 'Come once, meet the room, then decide on the full program.'}
          </p>

          {batches.length > 0 ? (
            <>
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {batches.map((b, i) => {
                  const branch = branchOf(b.branchSlug);
                  const sName = batchStyleLabel(content, b.styleSlugs);
                  const filling = b.status === 'Filling Fast';
                  const foundation = b.level === 'Foundation';
                  // The spotlight: the board's first Foundation card gets its
                  // own lit edge and a pool of stage light — the eye lands on
                  // the beginner's default the way a follow spot lands on a
                  // dancer.
                  const spotlit = i === 0 && foundation;
                  const bookLabel = foundation ? 'Book my first class' : 'Book my trial class';
                  return (
                    <div
                      key={b.id}
                      className={`enroll-ticket group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-ember-700/15 ${
                        spotlit
                          ? 'border-ember-500/50 bg-gradient-to-b from-ink-800/80 to-ink-900/60'
                          : 'border-cream/12 bg-gradient-to-b from-ink-800/80 to-ink-900/60 hover:border-ember-500/60'
                      }`}
                    >
                      {spotlit ? (
                        <>
                          <div aria-hidden className="absolute inset-x-0 top-0 h-[2px]">
                            <div className="absolute inset-0 [background:linear-gradient(to_right,transparent,rgb(var(--c-ember-600)/0.9)_25%,rgb(var(--c-ember-400))_50%,rgb(var(--c-ember-600)/0.9)_75%,transparent)]" />
                          </div>
                          <div aria-hidden className="spot-beam pointer-events-none absolute inset-0" />
                        </>
                      ) : null}

                      <div className="relative flex items-start justify-between gap-2">
                        <div>
                          <p className="display text-xl font-bold leading-tight">{sName}</p>
                          {spotlit ? (
                            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-ember-400">
                              Foundation · start here
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs uppercase tracking-wider text-cream/70">
                              {b.level}
                            </p>
                          )}
                        </div>
                        <span
                          className={`pill ${
                            filling ? 'bg-ember-500/20 text-ember-400' : 'bg-gold-500/15 text-gold-400'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>

                      {spotlit ? (
                        <p className="relative mt-2 text-sm text-cream/80">
                          No partner, no experience needed.
                        </p>
                      ) : !foundation ? (
                        <p className="relative mt-2 text-xs text-cream/55">
                          For dancers with the basics down.
                        </p>
                      ) : null}

                      <div className="relative mt-4 space-y-1 text-sm">
                        <p className="text-cream">{b.daysOfWeek.join('–')} · {b.time}</p>
                        <p className="text-cream/60">{branch?.name ?? b.branchSlug}</p>
                        <p className="text-cream/60">Starts {formatBatchDate(b.startDate)}</p>
                      </div>

                      {/* The price flip: the trial IS the product, so its price
                          carries the weight; the program price is context, not
                          the ask. */}
                      <div className="relative mt-3">
                        <p className="text-cream font-semibold">
                          Trial class {formatInr(b.reservationInr)}
                        </p>
                        <p className="text-xs text-cream/60">
                          Full program {formatInr(b.priceInr)} — decide after class one.
                        </p>
                      </div>

                      {typeof b.seatsLeft === 'number' ? (
                        <p className="relative mt-3 text-xs font-semibold text-ember-400">
                          ● {b.seatsLeft} seat{b.seatsLeft === 1 ? '' : 's'} left
                        </p>
                      ) : (
                        <span className="mt-3 block h-[1px]" />
                      )}

                      <div className="relative mt-auto pt-4">
                        {b.razorpayLink ? (
                          <>
                            <BookTrialLink
                              href={b.razorpayLink}
                              batch={b}
                              styleSlug={b.styleSlugs[0]}
                              branchSlug={b.branchSlug}
                              source="quick_enroll"
                              className="magnetic inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-ember-600 px-4 py-2 text-sm font-semibold text-on-ember transition hover:bg-ember-700"
                            >
                              {bookLabel} · {formatInr(b.reservationInr)}
                            </BookTrialLink>
                            <div className="mt-1 text-center">
                              <EnquiryCTA
                                whatsappNumber={content.site.whatsappNumber}
                                ctx={{
                                  source: 'quick_enroll',
                                  style: { slug: b.styleSlugs[0], name: sName },
                                  branch: branch ? { slug: branch.slug, name: branch.name } : undefined,
                                  batch: b,
                                }}
                                variant="link"
                                label="or chat first"
                                className="!min-h-[36px] text-xs"
                              />
                            </div>
                          </>
                        ) : (
                          <EnquiryCTA
                            whatsappNumber={content.site.whatsappNumber}
                            ctx={{
                              source: 'batch_row',
                              style: { slug: b.styleSlugs[0], name: sName },
                              branch: branch ? { slug: branch.slug, name: branch.name } : undefined,
                              batch: b,
                            }}
                            variant="batch-row"
                            label={`${bookLabel} on WhatsApp`}
                            className="w-full justify-center magnetic"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* The count-in, resolved: the hero counts 5-6-7-8 — here the four
                  documented first-class fears take the same four counts, and
                  the resolve lands where every dance does. */}
              <div className="mt-8 border-t border-cream/10 pt-6">
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                  {countIn(trialFrom != null ? formatInr(trialFrom) : null).map((item) => (
                    <div key={item.count} className="relative pl-9">
                      <span
                        aria-hidden
                        className="display absolute left-0 top-0 text-3xl font-extrabold leading-none text-ember-500/35"
                      >
                        {item.count}
                      </span>
                      <p className="display font-semibold leading-tight">{item.title}</p>
                      <p className="mt-1 text-sm leading-snug text-cream/65">{item.body}</p>
                    </div>
                  ))}
                </div>
                <p className="display mt-5 text-right text-sm font-semibold tracking-tight text-ember-400">
                  …and on the 1, you&apos;re dancing.
                </p>
              </div>

              {proof ? (
                <figure className="mt-5 border-t border-cream/10 pt-5">
                  <blockquote className="text-sm italic text-cream/80">
                    &ldquo;{proof.text}&rdquo;
                  </blockquote>
                  <figcaption className="mt-1 text-xs text-cream/55">
                    — {proof.studentName}
                    {proofStyle ? `, ${proofStyle} student` : ''}
                  </figcaption>
                </figure>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-cream/10 pt-5">
                <Link
                  href="#style-finder"
                  className="group inline-flex min-h-[44px] items-center gap-2 py-2 text-sm text-cream/75 transition hover:text-cream"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-cream/20 text-ember-400 transition group-hover:border-ember-500/60">
                    ?
                  </span>
                  Not sure which? Take the 30-second style finder →
                </Link>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  {/* The experienced-dancer lane: featuring Foundation never
                      costs the secondary audience a single tap. */}
                  <Link
                    href="/batches?level=Intermediate,Advanced"
                    className="inline-flex min-h-[44px] items-center py-2 text-sm text-cream/75 transition hover:text-cream"
                  >
                    Danced before? Intermediate &amp; Advanced →
                  </Link>
                  <Link href="/batches" className="btn-secondary magnetic">
                    See all batches &amp; prices
                  </Link>
                </div>
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

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Batch } from '@/lib/content-schema';
import { getPublicContent } from '@/lib/content';
import { PAGE_SEO_DEFAULTS } from '@/lib/page-meta';
import { formatBatchDate, todayIso } from '@/lib/format';
import { resolveWelcomeState } from '@/lib/welcome-confirm';
import { resolveWelcomeBatch } from '@/lib/welcome-tracks';
import { clockLabel, istToUtcStamp, minusMinutes, parseTimeRange } from '@/lib/welcome-time';
import { contactRows } from '@/lib/welcome-contact';
import { WelcomeView, type BatchBundle } from './WelcomeView';

// Post-payment landing page, one per track. Set the matching URL as the
// "redirect after payment" on each Razorpay payment page, e.g.
//   Latin Beginner  → /welcome/latin
//   WCS Beginner     → /welcome/wcs
//
// Multiple batches of the same track (same style, different start dates) can't
// be told apart by style alone, so the redirect can pin the exact batch:
//   /welcome/latin?d=2026-07-12   (the batch's start date — easiest to set)
//   /welcome/latin?b=batch-007    (the batch id)
// With no param we fall back to the next upcoming batch for the track.
//
// Confirmation: Payment PAGES (pages.razorpay.com) redirect with NO query
// params on success, so a bare visit here IS the success case. The failure
// layout appears for any razorpay_payment_link_status other than
// paid/partially_paid (Payment LINKS append the status; unknown values are
// deliberately unconfirmed so a status we don't recognise never reads as
// money received). Preview the failure state with
// ?razorpay_payment_link_status=cancelled. The decision is made SERVER-side
// from searchParams so a cancelled payment never flashes the confirmation
// hero and needs no JavaScript to show the right state.
// noindex — this is a post-registration confirmation, not a public/SEO page.

// Tracks are admin-managed (added/edited in /admin/pages/welcome → Blob), so the
// page renders per-request rather than being frozen at build: a newly added
// track works immediately, with no redeploy. (The GitHub Pages static mirror
// strips this route in CI, so force-dynamic never conflicts with `output:
// export` there.)
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const { track } = await params;
  const content = await getPublicContent();
  const cfg = content.welcome.tracks.find((t) => t.key === track);
  return {
    title: content.welcome.seoTitle.trim() || PAGE_SEO_DEFAULTS.welcome.title,
    description: cfg?.metaDesc || PAGE_SEO_DEFAULTS.welcome.description,
    robots: { index: false, follow: false },
  };
}

// ── time / format helpers ────────────────────────────────────────────────────

const DAY_NAMES: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

function formatDays(days: string[]): string {
  const names = days.map((d) => DAY_NAMES[d] ?? d);
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

// "918886072572" → "+91 88860 72572"
function formatPhoneDisplay(digits: string): string {
  if (digits.length === 12 && digits.startsWith('91')) {
    const n = digits.slice(2);
    return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `+${digits}`;
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export default async function WelcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { track } = await params;
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (typeof value === 'string') query.set(k, value);
  }
  // Decided here, on the server, so a cancelled payment never paints the
  // confirmation hero first — and a no-JS visitor still sees the right state.
  const paymentState = resolveWelcomeState(query);
  const content = await getPublicContent();
  const cfg = content.welcome.tracks.find((t) => t.key === track);
  if (!cfg) notFound();

  const wa = content.site.whatsappNumber;

  // Which batch this visit is about, decided HERE on the server.
  //
  // It used to be decided twice: the server picked a default blind, then a
  // client useEffect tried to re-pin from ?b=/?d= against an already
  // level-filtered list. So the initial HTML always showed the default batch,
  // a no-JS visitor never got past it, and a ?b= naming a batch outside the
  // track's pool matched nothing and silently kept a stranger's date, venue
  // and calendar file. See resolveWelcomeBatch.
  //
  // The pool is the FULL content.batches, not visibleBatches: a confirmation
  // page is a receipt and has to keep resolving for a batch that has already
  // started.
  const { batch: next, pinMissed } = resolveWelcomeBatch({
    batchId: query.get('b'),
    dateIso: query.get('d'),
    batches: content.batches,
    track: cfg,
    today: todayIso(),
  });

  // Everything the page shows for a given batch, precomputed server-side. We
  // build one bundle per candidate batch + a default, and the client picks the
  // right one from the ?d=/?b= param (so this stays static-export safe).
  const buildBundle = (batch: Batch | null): BatchBundle => {
    // No `?? content.studios[0]` fallback. When no batch resolves there is no
    // venue to name, and substituting whichever studio happens to sit first in
    // the array sent paying customers to the wrong address — since the studios
    // reorder that fallback was Jubilee Hills, wrong for every PUP batch. The
    // consumers below already handle `undefined`; an absent address is far
    // better than a confidently wrong one.
    const studio = content.studios.find((s) => s.slug === batch?.branchSlug);
    const venue = studio?.address ?? '';
    const mapUrl = studio
      ? `https://www.google.com/maps/search/?api=1&query=${studio.geo.lat},${studio.geo.lng}`
      : null;
    const range = batch ? parseTimeRange(batch.time) : null;
    const whenDays = batch ? formatDays(batch.daysOfWeek) : cfg.whenDays;
    const whenTime = batch ? batch.time : cfg.whenTime;
    // Derived from the batch's own start time, or — only when there is no
    // batch at all — the track's manual string. NOT `range ? … : cfg.arriveBy`:
    // that mixed sources, so a batch whose `time` failed to parse showed its
    // own real class time beside a DIFFERENT batch's arrival time. When the
    // time is unreadable the line is dropped instead of filled from elsewhere.
    const arriveBy = batch
      ? range
        ? clockLabel(minusMinutes(range.start, 15))
        : ''
      : cfg.arriveBy;
    const intakeDate = batch ? formatBatchDate(batch.startDate) : null;

    let gcalUrl: string | null = null;
    let icsHref: string | null = null;
    if (batch && range) {
      const startStamp = istToUtcStamp(batch.startDate, range.start);
      const endStamp = istToUtcStamp(batch.startDate, range.end);
      const title = `Furor — ${cfg.trackLabel} (first class)`;
      const details = `Your beginner intake at Furor Hyderabad.\nArrive by ${arriveBy} for registration.\nQuestions? WhatsApp ${formatPhoneDisplay(wa)}: https://wa.me/${wa}`;
      gcalUrl =
        `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(title)}` +
        `&dates=${startStamp}/${endStamp}` +
        `&details=${encodeURIComponent(details)}` +
        `&location=${encodeURIComponent(venue)}`;
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Furor Hyderabad//Welcome//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:furor-${track}-${batch.startDate}@furordancehyderabad`,
        `DTSTAMP:${startStamp}`,
        `DTSTART:${startStamp}`,
        `DTEND:${endStamp}`,
        `SUMMARY:${icsEscape(title)}`,
        `LOCATION:${icsEscape(venue)}`,
        `DESCRIPTION:${icsEscape(details)}`,
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(`${cfg.trackLabel} tomorrow`)}`,
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT2H',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(`${cfg.trackLabel} in 2 hours`)}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    }

    return {
      id: batch?.id ?? '',
      startDate: batch?.startDate ?? '',
      intakeDate,
      whenDays,
      whenTime,
      arriveBy,
      venue,
      mapUrl,
      gcalUrl,
      icsHref,
      // Derived from this batch's own studio, so switching bundles switches
      // the whole contact block together — venue, map, phone — instead of
      // leaving a stale address beside a new date.
      contact: contactRows({ studio, site: content.site }),
      welcomeNote: batch?.welcomeNote ?? '',
    };
  };

  // One bundle, resolved. There is no longer a client-side option list to
  // choose from: when `pinMissed` is set, `next` is null and this deliberately
  // builds the empty bundle — no venue, no date, no calendar links — so the
  // page says "we'll confirm the details" instead of confidently printing a
  // different batch's address. A recoverable gap beats a wrong building.
  const bundle = buildBundle(next);

  // One-tap "save contact" (vCard).
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Furor Hyderabad',
    'ORG:Furor Dance Hyderabad',
    `TEL;TYPE=CELL:+${wa}`,
    'END:VCARD',
  ].join('\r\n');
  const vcardHref = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`;

  return (
    <WelcomeView
      track={track}
      trackLabel={cfg.trackLabel}
      copy={content.welcome}
      labels={content.labels}
      waNumber={wa}
      waDisplay={formatPhoneDisplay(wa)}
      vcardHref={vcardHref}
      bundle={bundle}
      pinMissed={pinMissed}
      paymentState={paymentState}
      tonight={
        content.tonight.enabled &&
        content.tonight.headline &&
        content.tonight.when &&
        content.tonight.venueName
          ? {
              headline: content.tonight.headline,
              when: content.tonight.when,
              venueName: content.tonight.venueName,
            }
          : null
      }
    />
  );
}

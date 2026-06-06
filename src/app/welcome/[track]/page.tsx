import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/lib/content';
import { visibleBatches } from '@/lib/content-helpers';
import { formatBatchDate } from '@/lib/format';
import { WelcomeView } from './WelcomeView';

// Post-payment landing page, one per beginner track. Set the matching URL as
// the "redirect after payment" on each Razorpay payment page:
//   Latin Beginner  → /welcome/latin
//   WCS Beginner     → /welcome/wcs
// noindex — this is a post-registration confirmation, not a public/SEO page.

// The set of post-payment tracks is fixed (each maps to a Razorpay "redirect
// after payment" URL), so the static params are hardcoded here — this keeps the
// build from reading admin content during generateStaticParams. The per-track
// labels/timing and all page copy are admin-editable and read at render time
// from content.welcome.
const TRACK_KEYS = ['latin', 'wcs'] as const;

export function generateStaticParams() {
  return TRACK_KEYS.map((track) => ({ track }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const { track } = await params;
  const content = await getContent();
  const cfg = content.welcome.tracks.find((t) => t.key === track);
  return {
    title: 'You’re in — Furor Hyderabad',
    description: cfg?.metaDesc || 'Your intake details and next steps.',
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

interface Clock { h: number; m: number; }

function to24(h: number, mer: string): number {
  if (mer === 'PM' && h !== 12) return h + 12;
  if (mer === 'AM' && h === 12) return 0;
  return h;
}

// Handles both "9:30–10:30 AM" (batch format, single trailing meridiem) and
// "9:30 AM – 10:30 AM" (config format, two meridiems).
function parseTimeRange(time: string): { start: Clock; end: Clock } | null {
  const m = time.match(
    /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–—-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i,
  );
  if (!m) return null;
  const endMer = m[6].toUpperCase();
  const startMer = (m[3] ?? m[6]).toUpperCase();
  return {
    start: { h: to24(parseInt(m[1], 10), startMer), m: parseInt(m[2], 10) },
    end: { h: to24(parseInt(m[4], 10), endMer), m: parseInt(m[5], 10) },
  };
}

function clockLabel({ h, m }: Clock): string {
  const mer = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${mer}`;
}

function minusMinutes({ h, m }: Clock, mins: number): Clock {
  const total = (((h * 60 + m - mins) % 1440) + 1440) % 1440;
  return { h: Math.floor(total / 60), m: total % 60 };
}

// IST wall-clock → UTC iCal stamp (YYYYMMDDTHHMMSSZ). Computed via Date.UTC so
// it is independent of the build/server timezone.
function istToUtcStamp(dateIso: string, clock: Clock): string {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, clock.h, clock.m) - (5 * 60 + 30) * 60 * 1000;
  const dt = new Date(utcMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}T${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}00Z`;
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export default async function WelcomePage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const content = await getContent();
  const cfg = content.welcome.tracks.find((t) => t.key === track);
  if (!cfg) notFound();

  const wa = content.site.whatsappNumber;

  // Intake = next upcoming Foundation batch for this track (prefer weekend in the
  // right time-of-day), so the reminder + details are always accurate.
  const pool = visibleBatches(content).filter(
    (b) => b.level === 'Foundation' && b.styleSlugs.some((s) => cfg.styleSlugs.includes(s)),
  );
  const matchesTod = (b: (typeof pool)[number]) =>
    cfg.weekendTod === 'AM' ? /am/i.test(b.time) : /pm/i.test(b.time);
  const isWeekend = (b: (typeof pool)[number]) => b.daysOfWeek.some((d) => d === 'Sat' || d === 'Sun');
  const next = pool.filter(isWeekend).find(matchesTod) ?? pool.find(isWeekend) ?? pool[0];
  const intakeDate = next ? formatBatchDate(next.startDate) : null;

  // Venue + map: single source of truth = the studio record for the batch's branch.
  const studio = content.studios.find((s) => s.slug === next?.branchSlug) ?? content.studios[0];
  const venue = studio?.address ?? '';
  const mapUrl = studio
    ? `https://www.google.com/maps/search/?api=1&query=${studio.geo.lat},${studio.geo.lng}`
    : null;

  // Timing: prefer the real batch; fall back to the track config.
  const range = next ? parseTimeRange(next.time) : null;
  const whenDays = next ? formatDays(next.daysOfWeek) : cfg.whenDays;
  const whenTime = next ? next.time : cfg.whenTime;
  const arriveBy = range ? clockLabel(minusMinutes(range.start, 15)) : cfg.arriveBy;

  // Add-to-calendar links (only when we have a concrete date + parseable time).
  let gcalUrl: string | null = null;
  let icsHref: string | null = null;
  if (next && range) {
    const startStamp = istToUtcStamp(next.startDate, range.start);
    const endStamp = istToUtcStamp(next.startDate, range.end);
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
      `UID:furor-${track}-${next.startDate}@furordancehyderabad`,
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
      intakeDate={intakeDate}
      whenDays={whenDays}
      whenTime={whenTime}
      arriveBy={arriveBy}
      venue={venue}
      mapUrl={mapUrl}
      waNumber={wa}
      waDisplay={formatPhoneDisplay(wa)}
      gcalUrl={gcalUrl}
      icsHref={icsHref}
      vcardHref={vcardHref}
    />
  );
}

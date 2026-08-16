// Clock arithmetic for the post-payment confirmation page: the "arrive by"
// line, the Google Calendar link and the .ics attachment.
//
// Extracted out of src/app/welcome/[track]/page.tsx so it can be tested. It
// could not be before — the suite collects src/**/*.test.ts and that module
// imports next/navigation — which is exactly how a start time that landed
// after its own end time came to ship unnoticed.

export interface Clock {
  h: number;
  m: number;
}

function to24(h: number, mer: string): number {
  if (mer === 'PM' && h !== 12) return h + 12;
  if (mer === 'AM' && h === 12) return 0;
  return h;
}

const RANGE = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–—-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i;

/**
 * Handles both "9:30–10:30 AM" (batch format, single trailing meridiem) and
 * "9:30 AM – 10:30 AM" (config format, two meridiems).
 *
 * When only the end carries a meridiem the start borrows it — but only while
 * that keeps the range moving forwards. "11:00–1:00 PM" naively became 23:00
 * → 13:00, an eleven-hour-negative class, and both the arrival time and the
 * calendar event were derived from it. A borrowed meridiem that inverts the
 * range is the wrong one, so the other is used.
 *
 * An explicit start meridiem is always obeyed, inverted or not: that is the
 * studio stating something, not this function inferring it.
 */
export function parseTimeRange(time: string): { start: Clock; end: Clock } | null {
  const m = time.match(RANGE);
  if (!m) return null;

  const endMer = m[6].toUpperCase();
  const explicitStartMer = m[3]?.toUpperCase();
  const end: Clock = { h: to24(parseInt(m[4], 10), endMer), m: parseInt(m[5], 10) };

  const startHour = parseInt(m[1], 10);
  const startMin = parseInt(m[2], 10);
  const build = (mer: string): Clock => ({ h: to24(startHour, mer), m: startMin });

  if (explicitStartMer) return { start: build(explicitStartMer), end };

  const borrowed = build(endMer);
  if (borrowed.h * 60 + borrowed.m < end.h * 60 + end.m) return { start: borrowed, end };
  return { start: build(endMer === 'PM' ? 'AM' : 'PM'), end };
}

export function clockLabel({ h, m }: Clock): string {
  const mer = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${mer}`;
}

export function minusMinutes({ h, m }: Clock, mins: number): Clock {
  const total = (((h * 60 + m - mins) % 1440) + 1440) % 1440;
  return { h: Math.floor(total / 60), m: total % 60 };
}

/**
 * IST wall-clock → UTC iCal stamp (YYYYMMDDTHHMMSSZ). Computed via Date.UTC so
 * it is independent of the build/server timezone.
 */
export function istToUtcStamp(dateIso: string, clock: Clock): string {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, clock.h, clock.m) - (5 * 60 + 30) * 60 * 1000;
  const dt = new Date(utcMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}T${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}00Z`;
}

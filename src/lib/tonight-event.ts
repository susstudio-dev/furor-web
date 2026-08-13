// The schema.org Event node for the weekly social.
//
// Google needs BOTH `location` and `startDate` for an event to qualify for
// rich results. `tonight` originally carried neither in a usable form: the
// venue lived as prose inside `body` ("...at Over the Moon Brew Co,
// Gachibowli") and `when` was the human sentence "Every Saturday · 7 PM".
//
// The social runs at a third-party bar, not at either studio, so there is
// nothing in `content.studios` to derive a location from — hence the venue
// fields on TonightSchema rather than a branchSlug.
//
// This builder returns null unless venueName, weekday and startTime are all
// filled. A node that describes an event while omitting what identifies it
// cannot earn a rich result, and shipping one would only assert something we
// do not actually know.
import type { SiteContent } from './content-schema';

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type Weekday = (typeof DAYS)[number];

/**
 * The next date on or after `fromIso` that falls on `weekday`, as YYYY-MM-DD.
 * Returns today when today already is that weekday, and null when `weekday`
 * is unset.
 *
 * Dates are handled as UTC calendar arithmetic on a date-only string, so this
 * never shifts a day because of the runner's timezone — the same class of bug
 * that made new batches appear a day early in the admin.
 */
export function nextWeekdayIso(weekday: string, fromIso: string): string | null {
  const target = DAYS.indexOf(weekday as Weekday);
  if (target === -1) return null;

  const from = new Date(`${fromIso}T00:00:00Z`);
  if (Number.isNaN(from.getTime())) return null;

  const delta = (target - from.getUTCDay() + 7) % 7;
  from.setUTCDate(from.getUTCDate() + delta);
  return from.toISOString().slice(0, 10);
}

export interface TonightEventLd {
  '@context': string;
  '@type': 'Event';
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  eventSchedule: {
    '@type': 'Schedule';
    repeatFrequency: 'P1W';
    byDay: string;
    startTime: string;
    endTime?: string;
  };
  location: {
    '@type': 'Place';
    name: string;
    address?: {
      '@type': 'PostalAddress';
      streetAddress?: string;
      addressLocality?: string;
      addressCountry: 'IN';
    };
  };
}

/**
 * Build the Event node, or null when the structured facts aren't available.
 *
 * `todayIso` is injected rather than read from the clock so the output is
 * deterministic and testable — and so a test can never fail simply because it
 * ran on a Saturday.
 */
export function tonightEventLd(content: SiteContent, todayIso: string): TonightEventLd | null {
  const t = content.tonight;
  if (!t.enabled) return null;

  const venueName = t.venueName.trim();
  const startTime = t.startTime.trim();
  if (!venueName || !t.weekday || !startTime) return null;

  const date = nextWeekdayIso(t.weekday, todayIso);
  if (!date) return null;

  const street = t.venueStreet.trim();
  const locality = t.venueLocality.trim();
  const endTime = t.endTime.trim();
  const description = t.body.trim();

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: t.headline,
    ...(description ? { description } : {}),
    startDate: `${date}T${startTime}`,
    ...(endTime ? { endDate: `${date}T${endTime}` } : {}),
    // The concrete startDate above satisfies the rich-result requirement for
    // the next occurrence; the schedule tells search engines it recurs rather
    // than being a one-off that goes stale next week.
    eventSchedule: {
      '@type': 'Schedule',
      repeatFrequency: 'P1W',
      byDay: `https://schema.org/${t.weekday}`,
      startTime,
      ...(endTime ? { endTime } : {}),
    },
    location: {
      '@type': 'Place',
      name: venueName,
      ...(street || locality
        ? {
            address: {
              '@type': 'PostalAddress' as const,
              ...(street ? { streetAddress: street } : {}),
              ...(locality ? { addressLocality: locality } : {}),
              addressCountry: 'IN' as const,
            },
          }
        : {}),
    },
  };
}

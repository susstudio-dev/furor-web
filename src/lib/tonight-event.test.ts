import { describe, expect, it } from 'vitest';
import { nextWeekdayIso, tonightEventLd } from './tonight-event';
import type { SiteContent } from './content-schema';

// The La Rumba Event node. Google needs both `location` and `startDate` for an
// event to qualify for rich results, and `tonight` originally carried neither:
// the venue lived as prose inside `body` and `when` was the free-text sentence
// "Every Saturday · 7 PM". Rather than emit a node that describes an event
// while omitting what identifies it, the builder returns null unless the
// structured fields are actually filled.

const tonight = (over: Partial<SiteContent['tonight']> = {}) =>
  ({
    enabled: true,
    headline: 'La Rumba · Latin Social',
    body: "Hyderabad's weekly Latin social. All levels welcome.",
    when: 'Every Saturday · 7 PM',
    ctaLabel: 'WhatsApp to RSVP',
    ctaContext: '',
    venueName: 'Over the Moon Brew Co',
    venueStreet: '',
    venueLocality: 'Gachibowli, Hyderabad',
    weekday: 'Saturday',
    startTime: '19:00',
    endTime: '',
    ...over,
  }) as SiteContent['tonight'];

const content = (t: SiteContent['tonight']) => ({ tonight: t }) as SiteContent;

describe('nextWeekdayIso', () => {
  it('returns the next occurrence of that weekday', () => {
    // 2026-08-13 is a Thursday; the next Saturday is the 15th.
    expect(nextWeekdayIso('Saturday', '2026-08-13')).toBe('2026-08-15');
  });

  it('returns today when today already is that weekday', () => {
    expect(nextWeekdayIso('Thursday', '2026-08-13')).toBe('2026-08-13');
  });

  it('wraps across a month boundary', () => {
    // 2026-08-30 is a Sunday; the next Tuesday is 2026-09-01.
    expect(nextWeekdayIso('Tuesday', '2026-08-30')).toBe('2026-09-01');
  });

  it('returns null for an unset weekday', () => {
    expect(nextWeekdayIso('', '2026-08-13')).toBeNull();
  });
});

describe('tonightEventLd', () => {
  it('builds an Event with both location and startDate', () => {
    const ld = tonightEventLd(content(tonight()), '2026-08-13');
    expect(ld?.['@type']).toBe('Event');
    expect(ld?.name).toBe('La Rumba · Latin Social');
    expect(ld?.startDate).toBe('2026-08-15T19:00');
    expect(ld?.location).toMatchObject({
      '@type': 'Place',
      name: 'Over the Moon Brew Co',
    });
  });

  it('marks it as a recurring weekly schedule', () => {
    const ld = tonightEventLd(content(tonight()), '2026-08-13');
    expect(ld?.eventSchedule).toMatchObject({
      '@type': 'Schedule',
      repeatFrequency: 'P1W',
      byDay: 'https://schema.org/Saturday',
    });
  });

  it('includes an end time only when one is set', () => {
    expect(tonightEventLd(content(tonight()), '2026-08-13')?.endDate).toBeUndefined();
    const withEnd = tonightEventLd(content(tonight({ endTime: '23:00' })), '2026-08-13');
    expect(withEnd?.endDate).toBe('2026-08-15T23:00');
  });

  it('returns null when the tile is disabled', () => {
    expect(tonightEventLd(content(tonight({ enabled: false })), '2026-08-13')).toBeNull();
  });

  it('returns null rather than an invalid node when the venue is unset', () => {
    expect(tonightEventLd(content(tonight({ venueName: '' })), '2026-08-13')).toBeNull();
  });

  it('returns null rather than an invalid node when the weekday is unset', () => {
    expect(tonightEventLd(content(tonight({ weekday: '' })), '2026-08-13')).toBeNull();
  });

  it('returns null rather than an invalid node when the start time is unset', () => {
    expect(tonightEventLd(content(tonight({ startTime: '' })), '2026-08-13')).toBeNull();
  });

  it('omits the street line when it is blank rather than emitting an empty field', () => {
    const ld = tonightEventLd(content(tonight()), '2026-08-13');
    expect(JSON.stringify(ld)).not.toContain('streetAddress');
  });

  it('includes the street line when it is set', () => {
    const ld = tonightEventLd(content(tonight({ venueStreet: 'Plot 12, Kondapur Road' })), '2026-08-13');
    expect(JSON.stringify(ld)).toContain('Plot 12, Kondapur Road');
  });
});

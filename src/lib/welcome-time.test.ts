import { describe, expect, it } from 'vitest';
import { clockLabel, istToUtcStamp, minusMinutes, parseTimeRange } from './welcome-time';

// The clock arithmetic behind the confirmation page's "arrive by" line and its
// Google Calendar / .ics links.
//
// It lived inside src/app/welcome/[track]/page.tsx, where vitest could not
// reach it (the suite collects src/**/*.test.ts and that module pulls in
// next/navigation). That is why a start time landing AFTER its own end time
// shipped unnoticed: nothing could assert on it.

describe('parseTimeRange', () => {
  it('reads the batch format, where only the end carries a meridiem', () => {
    expect(parseTimeRange('9:30–10:30 AM')).toEqual({
      start: { h: 9, m: 30 },
      end: { h: 10, m: 30 },
    });
  });

  it('reads the config format, where both ends carry one', () => {
    expect(parseTimeRange('9:30 AM – 10:30 AM')).toEqual({
      start: { h: 9, m: 30 },
      end: { h: 10, m: 30 },
    });
  });

  it('reads an afternoon range that starts at noon', () => {
    expect(parseTimeRange('12:00–2:00 PM')).toEqual({
      start: { h: 12, m: 0 },
      end: { h: 14, m: 0 },
    });
  });

  // THE bug: with one trailing meridiem the start inherits it, so a range
  // crossing noon put the start at 11 PM and the end at 1 PM — eleven hours
  // before its own beginning. The calendar event and the "arrive by" line were
  // both computed from that.
  it('does not inherit PM onto a start time that would then follow the end', () => {
    expect(parseTimeRange('11:00–1:00 PM')).toEqual({
      start: { h: 11, m: 0 },
      end: { h: 13, m: 0 },
    });
  });

  it('handles a late-morning start crossing into the afternoon', () => {
    expect(parseTimeRange('11:30–12:30 PM')).toEqual({
      start: { h: 11, m: 30 },
      end: { h: 12, m: 30 },
    });
  });

  it('still honours an explicit start meridiem even across noon', () => {
    expect(parseTimeRange('11:00 AM – 1:00 PM')).toEqual({
      start: { h: 11, m: 0 },
      end: { h: 13, m: 0 },
    });
  });

  it('accepts an em dash and a plain hyphen as well as an en dash', () => {
    expect(parseTimeRange('9:30—10:30 AM')?.start).toEqual({ h: 9, m: 30 });
    expect(parseTimeRange('9:30-10:30 AM')?.start).toEqual({ h: 9, m: 30 });
  });

  it('returns null for a string it cannot read, rather than guessing', () => {
    expect(parseTimeRange('mornings')).toBeNull();
    expect(parseTimeRange('9:30 to 10:30')).toBeNull();
    expect(parseTimeRange('')).toBeNull();
  });
});

describe('clockLabel', () => {
  it('renders midnight and noon as 12, not 0', () => {
    expect(clockLabel({ h: 0, m: 0 })).toBe('12:00 AM');
    expect(clockLabel({ h: 12, m: 0 })).toBe('12:00 PM');
  });

  it('pads the minutes', () => {
    expect(clockLabel({ h: 9, m: 5 })).toBe('9:05 AM');
  });
});

describe('minusMinutes', () => {
  it('backs up across the hour', () => {
    expect(minusMinutes({ h: 9, m: 30 }, 15)).toEqual({ h: 9, m: 15 });
    expect(minusMinutes({ h: 9, m: 0 }, 15)).toEqual({ h: 8, m: 45 });
  });

  it('wraps backwards past midnight instead of going negative', () => {
    expect(minusMinutes({ h: 0, m: 10 }, 15)).toEqual({ h: 23, m: 55 });
  });
});

describe('istToUtcStamp', () => {
  // Computed via Date.UTC so the stamp is the same whatever timezone the
  // Worker happens to run in.
  it('shifts an IST wall clock back by 5:30 into a UTC iCal stamp', () => {
    expect(istToUtcStamp('2026-07-04', { h: 9, m: 30 })).toBe('20260704T040000Z');
  });

  it('rolls back to the previous day for an early-morning IST time', () => {
    expect(istToUtcStamp('2026-07-04', { h: 5, m: 0 })).toBe('20260703T233000Z');
  });
});

import { describe, expect, it } from 'vitest';
import { nextBatchPerStyle } from './content-helpers';
import type { SiteContent } from './content-schema';

// The per-style strip on the home page. It used to pick purely by date, one
// card per style, which could front an Advanced card to a first-timer — the
// exact thing the level-first ordering exists to prevent. compareByLevel
// already shipped and is used by QuickEnroll and BatchesBrowser; this was the
// one surface still ignoring it.

const future = (days: number) => {
  const d = new Date(Date.now() + 5.5 * 3600e3 + days * 864e5);
  return d.toISOString().slice(0, 10);
};

const batch = (over: Partial<SiteContent['batches'][number]> & { id: string }) =>
  ({
    styleSlugs: ['salsa'],
    level: 'Foundation',
    branchSlug: 'jubilee-hills',
    daysOfWeek: ['Sat'],
    time: '9:30–10:30 AM',
    startDate: future(7),
    priceInr: 6500,
    trialInr: 500,
    seatsLeft: null,
    status: 'Open',
    razorpayLink: null,
    welcomeNote: '',
    ...over,
  }) as SiteContent['batches'][number];

const content = (batches: SiteContent['batches']) => ({ batches }) as SiteContent;

describe('nextBatchPerStyle', () => {
  it('prefers a Foundation batch over an Advanced one that starts sooner', () => {
    const map = nextBatchPerStyle(
      content([
        batch({ id: 'adv', level: 'Advanced', startDate: future(2) }),
        batch({ id: 'found', level: 'Foundation', startDate: future(20) }),
      ]),
    );
    expect(map.get('salsa')?.batch.id).toBe('found');
    expect(map.get('salsa')?.isFallback).toBe(false);
  });

  it('picks the soonest Foundation batch when several exist', () => {
    const map = nextBatchPerStyle(
      content([
        batch({ id: 'later', startDate: future(30) }),
        batch({ id: 'sooner', startDate: future(3) }),
      ]),
    );
    expect(map.get('salsa')?.batch.id).toBe('sooner');
  });

  it('falls back to a higher level when a style has no Foundation batch, and says so', () => {
    const map = nextBatchPerStyle(
      content([batch({ id: 'only-adv', level: 'Advanced', startDate: future(5) })]),
    );
    expect(map.get('salsa')?.batch.id).toBe('only-adv');
    expect(map.get('salsa')?.isFallback).toBe(true);
  });

  it('prefers the lower of two non-Foundation levels when falling back', () => {
    const map = nextBatchPerStyle(
      content([
        batch({ id: 'adv', level: 'Advanced', startDate: future(2) }),
        batch({ id: 'int', level: 'Intermediate', startDate: future(9) }),
      ]),
    );
    expect(map.get('salsa')?.batch.id).toBe('int');
    expect(map.get('salsa')?.isFallback).toBe(true);
  });

  it('omits a style with no visible batch rather than inventing one', () => {
    const map = nextBatchPerStyle(content([batch({ id: 'a', styleSlugs: ['bachata'] })]));
    expect(map.has('salsa')).toBe(false);
    expect(map.has('bachata')).toBe(true);
  });

  it('indexes a combined batch under every style it teaches', () => {
    const map = nextBatchPerStyle(
      content([batch({ id: 'combo', styleSlugs: ['salsa', 'bachata'] })]),
    );
    expect(map.get('salsa')?.batch.id).toBe('combo');
    expect(map.get('bachata')?.batch.id).toBe('combo');
  });

  it('ignores past-dated and closed batches', () => {
    const map = nextBatchPerStyle(
      content([
        batch({ id: 'past', startDate: future(-9) }),
        batch({ id: 'closed', status: 'Closed', startDate: future(1) }),
      ]),
    );
    expect(map.has('salsa')).toBe(false);
  });
});

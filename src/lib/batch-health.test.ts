import { describe, expect, it } from 'vitest';
import { batchHealth, isTrustedPaymentHost } from './batch-health';
import type { SiteContent } from './content-schema';

const batch = (over: Partial<SiteContent['batches'][number]> & { id: string }) =>
  ({
    styleSlugs: ['salsa'], level: 'Foundation', branchSlug: 'jh',
    daysOfWeek: ['Sat'], time: '9:30–10:30 AM', startDate: '2099-01-01',
    priceInr: 6900, trialInr: 500, seatsLeft: null, status: 'Open',
    razorpayLink: null, welcomeNote: '', joinUntil: '',
    ...over,
  }) as SiteContent['batches'][number];

const content = (batches: SiteContent['batches']) =>
  ({
    batches,
    danceStyles: [
      { slug: 'salsa', name: 'Salsa' },
      { slug: 'bachata', name: 'Bachata' },
    ],
  }) as SiteContent;

describe('isTrustedPaymentHost', () => {
  it('accepts razorpay.com, its subdomains, and rzp.io', () => {
    expect(isTrustedPaymentHost('https://pages.razorpay.com/x')).toBe(true);
    expect(isTrustedPaymentHost('https://razorpay.com/x')).toBe(true);
    expect(isTrustedPaymentHost('https://rzp.io/rzp/x')).toBe(true);
  });
  it('rejects everything else, including unparseable values', () => {
    expect(isTrustedPaymentHost('https://forms.gle/abc')).toBe(false);
    expect(isTrustedPaymentHost('https://evilrazorpay.com/x')).toBe(false);
    expect(isTrustedPaymentHost('not a url')).toBe(false);
  });
});

describe('batchHealth', () => {
  it('names styles with zero joinable Foundation batches', () => {
    const h = batchHealth(content([batch({ id: 'a', styleSlugs: ['salsa'] })]), '2026-08-24');
    expect(h.stylesWithoutFoundation).toEqual(['Bachata']);
  });
  it('flags non-Razorpay booking links with their host', () => {
    const h = batchHealth(
      content([batch({ id: 'a', razorpayLink: 'https://forms.gle/abc' })]),
      '2026-08-24',
    );
    expect(h.suspiciousLinks).toEqual([{ batchId: 'a', host: 'forms.gle' }]);
  });
  it('lists lapsed batches but not deliberately Closed ones', () => {
    const h = batchHealth(
      content([
        batch({ id: 'lapsed', startDate: '2026-06-01' }),
        batch({ id: 'closed', startDate: '2026-06-01', status: 'Closed' }),
      ]),
      '2026-08-24',
    );
    expect(h.lapsedBatchIds).toEqual(['lapsed']);
  });
});

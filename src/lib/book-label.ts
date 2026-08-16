import { label, type Labels } from './labels';

/** The fields every booking surface reads off a batch to price its CTA. */
export interface Bookable {
  level: string;
  /** Trial price, or null when this batch runs no trial. */
  trialInr: number | null;
  /** The full programme fee. */
  priceInr: number;
}

/**
 * Whether this batch runs a trial class at all.
 *
 * A `!= null` test, deliberately — not a truthiness test. A free taster
 * (`trialInr: 0`) is still a trial, and `!batch.trialInr` would have quietly
 * reclassified it as "no trial" the day the studio ran one.
 */
export function offersTrial(batch: Pick<Bookable, 'trialInr'>): boolean {
  return batch.trialInr !== null;
}

/**
 * What clicking the booking CTA actually commits you to paying.
 *
 * The only honest number to print on the button, and the only honest `value`
 * to report to GA4. `??` rather than `||` so a ₹0 trial stays ₹0 instead of
 * falling through to the programme fee.
 */
export function bookPriceInr(batch: Pick<Bookable, 'trialInr' | 'priceInr'>): number {
  return batch.trialInr ?? batch.priceInr;
}

/**
 * The cheapest trial on offer, or null when nothing on the board runs one.
 *
 * The single source for every "from ₹X" on the site. Hero.tsx and page.tsx
 * each computed this independently off `reservationInr` — which defaulted to
 * 500 for every batch — so the hero could advertise a trial price no batch
 * actually charged, and the two copies were free to drift apart besides.
 *
 * Null means the price claim is dropped entirely rather than shown as ₹0.
 */
export function trialFromInr(batches: Pick<Bookable, 'trialInr'>[]): number | null {
  const prices = batches.map((b) => b.trialInr).filter((n): n is number => n !== null);
  return prices.length ? Math.min(...prices) : null;
}

/**
 * One source of truth for a booking CTA's copy.
 *
 * BatchActions, QuickEnroll, Hero and the home page each built this same label
 * independently, which is how two of them can drift apart without anyone
 * noticing.
 *
 * Keyed off whether a trial EXISTS, then off level — not off level alone. The
 * old rule handed the word "trial" to every Intermediate and Advanced batch,
 * which are precisely the ones least likely to run one; the studio had no way
 * to say otherwise, because the schema had no way to record it.
 */
export function bookLabel(batch: Pick<Bookable, 'level' | 'trialInr'>, labels: Labels): string {
  if (!offersTrial(batch)) return label(labels, 'ctaBookSeat');
  return batch.level === 'Foundation'
    ? label(labels, 'ctaBookFoundation')
    : label(labels, 'ctaBookTrial');
}

/**
 * The display label for a batch's status.
 *
 * The stored ENUM VALUES ('Open' | 'Filling Fast' | 'Closed') are live URL
 * state in BatchesBrowser — read from ?status=, compared, and shared in
 * bookmarked links. They are structural and never editable. What a visitor
 * READS is editable, and now has exactly one casing site-wide.
 */
export function statusLabel(status: string, labels: Labels): string {
  if (status === 'Filling Fast') return label(labels, 'badgeFillingFast');
  if (status === 'Open') return label(labels, 'badgeOpen');
  if (status === 'Closed') return label(labels, 'badgeClosed');
  return status;
}

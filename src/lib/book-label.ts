import { label, type Labels } from './labels';

/** The fields every booking surface reads off a batch to price its CTA. */
export interface Bookable {
  level: string;
  /** Price of a single first class, or null when the batch sells none. */
  trialInr: number | null;
  /** The full programme fee. */
  priceInr: number;
}

/**
 * Whether this batch actually sells a single first class.
 *
 * Two conditions, and the second one matters as much as the first.
 *
 * `!== null` rather than a truthiness test: a free taster (`trialInr: 0`) is
 * a real offer, and `!batch.trialInr` would have reclassified it as "none"
 * the day the studio ran one.
 *
 * `< priceInr` because a single class priced at or above the whole programme
 * is not an offer — there is nothing to buy that the full fee does not
 * already buy. Production carried exactly that: Intermediate and Advanced
 * batches stored `trialInr` EQUAL to `priceInr`, so the board advertised
 * "First class ₹4,700 / Full program ₹4,700 — decide after class one" to
 * dancers who are not deciding anything — they register, pay in full and
 * show up. Data that says a single class costs the whole programme is a
 * mistake; rendering a contradiction from it is a bug of ours.
 */
export function offersTrial(batch: Pick<Bookable, 'trialInr' | 'priceInr'>): boolean {
  return batch.trialInr !== null && batch.trialInr < batch.priceInr;
}

/**
 * What clicking the booking CTA actually commits you to paying.
 *
 * The only honest number to print on the button, and the only honest `value`
 * to report to GA4. Keyed off `offersTrial` rather than `trialInr ?? price`
 * so a batch whose stored single-class price is not a real discount charges
 * — and reports — the full programme fee it will actually collect.
 */
export function bookPriceInr(batch: Pick<Bookable, 'trialInr' | 'priceInr'>): number {
  return offersTrial(batch) ? (batch.trialInr as number) : batch.priceInr;
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
export function trialFromInr(batches: Pick<Bookable, 'trialInr' | 'priceInr'>[]): number | null {
  const prices = batches.filter(offersTrial).map((b) => b.trialInr as number);
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
export function bookLabel(
  batch: Pick<Bookable, 'level' | 'trialInr' | 'priceInr'>,
  labels: Labels,
): string {
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

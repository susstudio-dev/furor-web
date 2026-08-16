import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';
import { bookLabel, bookPriceInr, offersTrial, statusLabel, trialFromInr } from './book-label';

const labels = (over: Partial<Labels> = {}): Labels => LabelsSchema.parse(over);

// A batch reduced to the two fields the booking CTA reads.
const b = (trialInr: number | null, level = 'Foundation', priceInr = 6900) => ({
  level,
  trialInr,
  priceInr,
});

describe('offersTrial', () => {
  // The whole point of the nullable price: "does this batch have a trial" and
  // "what does the trial cost" are one field, so they cannot disagree.
  it('is true when the batch carries a trial price', () => {
    expect(offersTrial(b(500))).toBe(true);
  });

  it('is false when the trial price is null', () => {
    expect(offersTrial(b(null))).toBe(false);
  });

  // A free taster is still a trial. `?? ` on the price would have swallowed it.
  it('treats a zero-rupee trial as a trial, not as no trial', () => {
    expect(offersTrial(b(0))).toBe(true);
  });
});

describe('bookLabel', () => {
  it('calls a Foundation batch with a trial a first class', () => {
    expect(bookLabel(b(500, 'Foundation'), labels())).toBe('Book my first class');
  });

  it('calls a higher-level batch with a trial a trial class', () => {
    expect(bookLabel(b(500, 'Intermediate'), labels())).toBe('Book my trial class');
    expect(bookLabel(b(500, 'Advanced'), labels())).toBe('Book my trial class');
  });

  // THE reported bug: level was the only input, so every Intermediate and
  // Advanced batch advertised a "trial class" whether or not one was on offer
  // — and those are exactly the batches least likely to run one.
  it('never says "trial" for a batch that has no trial', () => {
    expect(bookLabel(b(null, 'Intermediate'), labels())).toBe('Book my seat');
    expect(bookLabel(b(null, 'Advanced'), labels())).toBe('Book my seat');
  });

  it('never says "trial" for a Foundation batch without one either', () => {
    expect(bookLabel(b(null, 'Foundation'), labels())).toBe('Book my seat');
  });

  it('follows the edited label at every call site at once', () => {
    const edited = labels({ ctaBookFoundation: 'Reserve my first class' });
    expect(bookLabel(b(500, 'Foundation'), edited)).toBe('Reserve my first class');
    expect(bookLabel(b(500, 'Advanced'), edited)).toBe('Book my trial class');
  });

  it('falls back to the shipped default when the label is blank', () => {
    expect(bookLabel(b(500, 'Foundation'), labels({ ctaBookFoundation: '' }))).toBe(
      'Book my first class',
    );
    expect(bookLabel(b(null, 'Advanced'), labels({ ctaBookSeat: '' }))).toBe('Book my seat');
  });
});

describe('bookPriceInr', () => {
  // What the button actually charges — and therefore the only honest number to
  // print on it and to report to GA4 as the conversion value.
  it('is the trial price when the batch runs a trial', () => {
    expect(bookPriceInr(b(500, 'Foundation', 6900))).toBe(500);
  });

  it('is the full program price when the batch has no trial', () => {
    expect(bookPriceInr(b(null, 'Advanced', 6900))).toBe(6900);
  });

  it('keeps a zero-rupee trial at zero rather than falling through to the program price', () => {
    expect(bookPriceInr(b(0, 'Foundation', 6900))).toBe(0);
  });
});

describe('statusLabel', () => {
  // The live inconsistency: QuickEnroll printed the raw enum "Filling Fast",
  // BatchesBrowser hardcoded "Filling fast". Two casings of one word on one
  // site. One function, one casing.
  it('gives the Filling Fast enum exactly one display casing', () => {
    expect(statusLabel('Filling Fast', labels())).toBe('Filling fast');
  });

  it('renders the other statuses', () => {
    expect(statusLabel('Open', labels())).toBe('Open');
    expect(statusLabel('Closed', labels())).toBe('Closed');
  });

  it('is editable without touching the stored enum value', () => {
    expect(statusLabel('Filling Fast', labels({ badgeFillingFast: 'Almost full' }))).toBe(
      'Almost full',
    );
  });

  // An unrecognised status must show something, not an empty chip.
  it('echoes an unknown status rather than blanking the badge', () => {
    expect(statusLabel('Waitlist', labels())).toBe('Waitlist');
  });
});

describe('trialFromInr', () => {
  // The "from ₹X" the hero, the sticky bar and the booking board all print.
  // Hero.tsx and page.tsx each computed this independently off
  // `reservationInr`, which defaulted to 500 for every batch — so a school
  // running no trials at all still advertised "from ₹500".
  it('is the cheapest trial among batches that run one', () => {
    expect(trialFromInr([b(900), b(500), b(1200)])).toBe(500);
  });

  it('ignores batches with no trial when finding the cheapest', () => {
    expect(trialFromInr([b(null, 'Advanced', 6900), b(900)])).toBe(900);
  });

  it('is null when no batch runs a trial, so the copy drops the price claim', () => {
    expect(trialFromInr([b(null), b(null)])).toBeNull();
  });

  it('is null for an empty board rather than Infinity', () => {
    expect(trialFromInr([])).toBeNull();
  });

  it('keeps a free taster at zero instead of reporting no trial', () => {
    expect(trialFromInr([b(0), b(500)])).toBe(0);
  });
});

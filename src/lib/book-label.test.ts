import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';
import { bookLabel, statusLabel } from './book-label';

const labels = (over: Partial<Labels> = {}): Labels => LabelsSchema.parse(over);

describe('bookLabel', () => {
  it('calls a Foundation batch a first class', () => {
    expect(bookLabel('Foundation', labels())).toBe('Book my first class');
  });

  it('calls every higher level a trial class', () => {
    expect(bookLabel('Intermediate', labels())).toBe('Book my trial class');
    expect(bookLabel('Advanced', labels())).toBe('Book my trial class');
  });

  // Defence in depth, not coverage: the schema enum forbids this value today.
  it('treats an unknown level as a trial rather than a beginner class', () => {
    expect(bookLabel('Masterclass', labels())).toBe('Book my trial class');
  });

  it('follows the edited label at every call site at once', () => {
    const edited = labels({ ctaBookFoundation: 'Reserve my first class' });
    expect(bookLabel('Foundation', edited)).toBe('Reserve my first class');
    expect(bookLabel('Advanced', edited)).toBe('Book my trial class');
  });

  it('falls back to the shipped default when the label is blank', () => {
    expect(bookLabel('Foundation', labels({ ctaBookFoundation: '' }))).toBe('Book my first class');
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

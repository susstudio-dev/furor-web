import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema, SiteContentObjectSchema, BatchSchema } from './content-schema';

const doc = () => SiteContentSchema.parse(seed);

describe('pages.batches.browser', () => {
  const b = () => doc().pages.batches.browser;

  it('ships the five quick-pick presets exactly as they render today', () => {
    expect(b().presetBeginner).toBe('🔰 Never danced? Start here');
    expect(b().presetWeekend).toBe('🗓️ Weekend classes');
    expect(b().presetEvening).toBe('🌙 Evening classes');
    expect(b().presetStartingSoon).toBe('⚡ Starting soon');
    expect(b().presetFillingFast).toBe('🔥 Filling fast');
  });

  it('ships the eight facet headings', () => {
    expect(b().facetStyle).toBe('Dance');
    expect(b().facetLevel).toBe('Level');
    expect(b().facetBranch).toBe('Studio');
    expect(b().facetTod).toBe('Time of day');
    expect(b().facetDays).toBe('Days');
    expect(b().facetStarting).toBe('Starting');
    expect(b().facetPrice).toBe('Price');
    expect(b().facetStatus).toBe('Availability');
  });

  it('ships the twelve filter-bar strings Plan 1 kept out of the label bag', () => {
    expect(b().filterQuickPicks).toBe('Quick picks');
    expect(b().filterShowAll).toBe('All filters');
    expect(b().filterHide).toBe('Hide filters');
    expect(b().filterClearAll).toBe('Clear all');
    expect(b().filterClearAction).toBe('Clear filters');
    expect(b().filterRemoveTitle).toBe('Remove filter');
    expect(b().filterSortLabel).toBe('Sort');
    expect(b().filterSortLevel).toBe('Beginner → advanced');
    expect(b().filterSortSoon).toBe('Soonest first');
    expect(b().filterSortLate).toBe('Latest first');
    expect(b().filterWeekends).toBe('Weekends');
    expect(b().filterWeekdays).toBe('Weekdays');
  });

  // The VALUES behind these are live URL state (?tod=Morning, ?starting=Later)
  // and never move. Only the display labels do.
  it('ships the six derived option labels whose values stay structural', () => {
    expect(b().todMorning).toBe('Morning');
    expect(b().todAfternoon).toBe('Afternoon');
    expect(b().todEvening).toBe('Evening');
    expect(b().startingThisMonth).toBe('This month');
    expect(b().startingNext30).toBe('Next 30 days');
    expect(b().startingLater).toBe('Later');
  });

  it('ships the three row templates with their placeholders intact', () => {
    expect(b().resultCount).toBe('{n} of {total} batches');
    expect(b().seatsTemplate).toBe('{n} seats');
    expect(b().startsPrefix).toBe('starts');
  });

  it('keeps the batches page its own intro and SEO fields', () => {
    const c = doc();
    expect(typeof c.pages.batches.seoTitle).toBe('string');
    expect(typeof c.pages.batches.seoDescription).toBe('string');
    expect(c.pages.batches.intro.headline).toBe(
      "What's open. What it costs. Real seats, real dates.",
    );
  });
});

// The studio runs no trial classes. What ₹500 buys is one real class off the
// batch's own syllabus, which is why the schema can say a batch sells none
// (BatchSchema.trialInr === null) and why the CTA never used to be able to.
// The word survived in shipped copy long after the concept stopped applying,
// so this walks every string the site can render — seed prose AND schema
// defaults, since pages.home.board and labels exist only as defaults — and
// fails if it comes back. Keys are exempt: `content.trial` and `trialInr` are
// legacy identifiers deliberately left alone so stored documents keep parsing.
// Production kept rendering "Trial class ₹500" after the rename because the
// save path stringifies the fully-defaulted document: the first admin save
// baked the then-current defaults into R2, and stored bytes shadow a default
// forever. Rewording the default fixed a fresh install and did nothing to the
// live site. These pin the repair.
describe('retired copy migration', () => {
  const stored = () => {
    const d = JSON.parse(JSON.stringify(seed)) as Record<string, any>;
    // Shaped like the real R2 document: defaults baked in at an earlier save.
    d.labels = { ctaBookTrial: 'Book my trial class' };
    d.pages.home = {
      ...d.pages.home,
      board: {
        trialPrice: 'Trial class {price}',
        leadWithPrice:
          'Trial classes from {price} — come once, meet the room, then decide on the full program.',
      },
    };
    return d;
  };

  it('upgrades a baked-in default the studio never edited', () => {
    const c = SiteContentSchema.parse(stored());
    expect(c.labels.ctaBookTrial).toBe('Book my first class');
    expect(c.pages.home.board.trialPrice).toBe('First class {price}');
    expect(c.pages.home.board.leadWithPrice).toBe(
      'First class from {price} — come once, meet the room, then decide on the full program.',
    );
  });

  it('upgrades the leadWithPrice default from two rewrites ago too', () => {
    const d = stored();
    d.pages.home.board.leadWithPrice =
      'Every batch opens with a {price} trial class — come once, meet the room, then decide on the full program.';
    expect(SiteContentSchema.parse(d).pages.home.board.leadWithPrice).toBe(
      'First class from {price} — come once, meet the room, then decide on the full program.',
    );
  });

  // The whole point of matching byte-for-byte. Production's booking button
  // reads "Course Registration" because the owner typed it; a migration that
  // went near it would be overwriting a decision, not repairing a default.
  it('leaves copy the studio actually wrote alone', () => {
    const d = stored();
    d.labels.ctaBookTrial = 'Course Registration';
    d.pages.home.board.trialPrice = 'Trial class {price} — our own wording';
    const c = SiteContentSchema.parse(d);
    expect(c.labels.ctaBookTrial).toBe('Course Registration');
    expect(c.pages.home.board.trialPrice).toBe('Trial class {price} — our own wording');
  });

  it('rewrites the retired Terms and weekend-page prose', () => {
    const d = stored();
    // The seed in this repo already carries the new wording, so plant the
    // retired strings explicitly — otherwise this asserts nothing.
    d.pages.terms.sections[2].body =
      "The paid trial class fee is non-refundable — it books one class, and that seat is held for you whether or not you attend. For full batch programs, refunds are available before the batch starts. Once the batch has begun, refunds are pro-rated for the remaining unattended classes and require at least 7 days' notice. Refunds for missed classes that were eligible for a make-up are not available.";
    d.customPages[0].blocks[7].body =
      "When\n\nEvery \nSaturday & Sunday 9:30–10:30 AM\n\nPlease arrive by 9:15 AM for registration for your first trial session on Saturday.\n";
    const c = SiteContentSchema.parse(d);
    expect(c.pages.terms.sections[2].body).toContain('The single class fee is non-refundable');
    expect(c.pages.terms.sections[2].body).not.toMatch(/trial/i);
    const block = c.customPages[0].blocks[7];
    expect(block.type).toBe('text');
    if (block.type !== 'text') throw new Error('expected a text block');
    expect(block.body).toContain('before your first class on Saturday');
  });

  it('leaves an already-current document byte-identical', () => {
    const before = JSON.parse(JSON.stringify(seed));
    SiteContentSchema.parse(before);
    expect(before).toEqual(JSON.parse(JSON.stringify(seed)));
  });

  // A document that has been through the migration must survive the round
  // trip the save path performs, or the next save would write back garbage.
  it('is idempotent across a save-shaped round trip', () => {
    const once = SiteContentSchema.parse(stored());
    const twice = SiteContentSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});

describe('shipped copy', () => {
  function strings(node: unknown, path: string): [string, string][] {
    if (typeof node === 'string') return [[path, node]];
    if (Array.isArray(node)) return node.flatMap((v, i) => strings(v, `${path}[${i}]`));
    if (node && typeof node === 'object') {
      return Object.entries(node).flatMap(([k, v]) => strings(v, `${path}.${k}`));
    }
    return [];
  }

  it('never says "trial" anywhere a visitor can read it', () => {
    const offenders = strings(doc(), '')
      .filter(([, v]) => /trial/i.test(v))
      .map(([k, v]) => `${k}: ${v.slice(0, 80)}`);
    expect(offenders).toEqual([]);
  });
});

describe('pages.home.board', () => {
  const b = () => doc().pages.home.board;

  it('ships the board header exactly as it renders today', () => {
    expect(b().speed).toBe('Book in ~30 seconds');
    expect(b().headline).toBe('Start dancing');
    expect(b().headlineAccent).toBe('this week.');
  });

  // The codebase rule at Hero.tsx: the first-class price comes from live batch
  // data, never from a hardcoded string, so the copy cannot go stale on its own.
  it('keeps the price out of prose except as a placeholder', () => {
    expect(b().leadWithPrice).toContain('{price}');
    expect(b().leadWithPrice).not.toMatch(/₹\s?\d/);
    expect(b().leadNoPrice).toBe('Come once, meet the room, then decide on the full program.');
    expect(b().trialPrice).toBe('First class {price}');
    expect(b().fullProgram).toBe('Full program {price} — decide after class one.');
    // No "decide after class one" here: these dancers are not deciding, they
    // register and pay the whole fee up front.
    expect(b().fullProgramOnly).toBe('Full program {price} — pay in full to register.');
    expect(b().fullProgramOnly).not.toMatch(/decide|try|trial/i);
  });

  it('ships the two per-card notes and the start-date template', () => {
    expect(b().spotlitNote).toBe('No partner, no experience needed.');
    expect(b().higherLevelNote).toBe('For dancers with the basics down.');
    expect(b().startsTemplate).toBe('Starts {date}');
  });

  // "1 seats left" is the bug this pair exists to prevent.
  it('ships both seats-left forms so the singular is not “1 seats”', () => {
    expect(b().seatsLeftOne).toBe('● {n} seat left');
    expect(b().seatsLeftMany).toBe('● {n} seats left');
  });

  it('ships the four count-in cards', () => {
    const cards = b().countIn;
    expect(cards).toHaveLength(4);
    expect(cards.map((x) => x.count)).toEqual(['5', '6', '7', '8']);
    expect(cards[0].title).toBe('Come alone.');
    expect(cards[3].title).toBe('One class, not a course.');
    expect(cards[3].body).toContain('{price}');
  });

  // The owner corrected this on 2026-08-08: the paid trial is NON-REFUNDABLE,
  // so no default here may promise money back.
  it('never promises a refund', () => {
    expect(JSON.stringify(b())).not.toMatch(/refund|money back/i);
  });

  it('ships the closing links and the resolve line', () => {
    expect(b().resolveLine).toBe("…and on the 1, you're dancing.");
    expect(b().proofSuffix).toBe(', {style} student');
    expect(b().styleFinderLink).toBe('Not sure which? Take the 30-second style finder →');
    expect(b().advancedLink).toBe('Danced before? Intermediate & Advanced →');
    expect(b().allBatchesLink).toBe('See all batches & prices');
    expect(b().emptyNote).toBe(
      'Hi! I want to join a dance batch — please let me know the next start dates.',
    );
  });
});

describe('pages.home visit-us, next-batches and Why Furor', () => {
  const h = () => doc().pages.home;

  it('ships the four studio-card headings', () => {
    expect(h().visitUs.addressLabel).toBe('Address');
    expect(h().visitUs.hoursLabel).toBe('Hours');
    expect(h().visitUs.parkingLabel).toBe('Parking');
    expect(h().visitUs.teachHereLabel).toBe('What we teach here');
  });

  // Derived from records, never hand-typed: a studio's phone number, name and
  // photo caption all come from the studio record, so the editable part is the
  // sentence around them and nothing else.
  it('ships the derived strings as templates, never as prose', () => {
    expect(h().visitUs.callTemplate).toBe('Call {phone}');
    expect(h().visitUs.mapTitle).toBe('Map to {studio}');
    expect(h().visitUs.photoAlt).toBe('Inside {studio}');
    expect(h().nextBatches.starts).toBe('Starts {date} · {price}');
    expect(h().nextBatches.seatsLeft).toBe('{n} seats left');
    expect(h().nextBatches.combinedSuffix).toBe(' · taught together');
  });

  it('keeps the next-batches header fields and adds the Why Furor eyebrow', () => {
    expect(h().nextBatches.eyebrow).toBe('Next batches');
    expect(h().nextBatches.headline).toBe('Doors open. Pick a date.');
    expect(h().whyFurorEyebrow).toBe('Why Furor');
  });
});

describe('pages.home.styleFinder', () => {
  const f = () => doc().pages.home.styleFinder;

  it('ships the finder chrome', () => {
    expect(f().eyebrow).toBe('Style Finder');
    expect(f().headline).toBe('Two beginner tracks. Find yours.');
    expect(f().resetLabel).toBe('Reset');
    expect(f().question).toBe('When can you make it?');
    expect(f().recommendEyebrow).toBe('We recommend');
    expect(f().nextBatchLabel).toBe('Next beginner batch');
    expect(f().startsTemplate).toBe('Starts {date} · {price}');
  });

  it('ships the lead exactly as it renders', () => {
    expect(f().lead).toBe(
      'Both are built for first-timers — no experience, no partner needed. Pick the time that suits you and we’ll point you to the next beginner batch.',
    );
  });
});

describe('welcome page copy', () => {
  const w = () => doc().welcome;

  it('ships the unconfirmed-state actions', () => {
    expect(w().unconfirmedCta).toBe('Message us on WhatsApp');
    expect(w().tryAgainLabel).toBe('Try again');
    expect(w().referenceLabel).toBe('Reference: {id}');
  });

  it('ships the confirmed-state actions', () => {
    expect(w().paymentReferenceLabel).toBe('Payment reference: {id}');
    expect(w().gcalLabel).toBe('Google Calendar');
    expect(w().icsLabel).toBe('Apple / Outlook (.ics)');
  });

  // The honest fallbacks. A paying customer whose batch has no date or venue
  // yet must be told so, not shown a blank cell.
  // No whereHeading here on purpose — that heading is Plan 1's
  // labels.welcomeWhereHeading, already rendered by Plan 3. One string, one home.
  it('ships the intake headings and their honest fallbacks', () => {
    expect(w().whenHeading).toBe('When');
    expect(w().noVenueNote).toBe('We’ll share the exact address on WhatsApp.');
    expect(w().noDateNote).toBe(
      'We’ll confirm the exact date on WhatsApp and send you a reminder.',
    );
  });

  it('ships the two intake templates with their placeholders', () => {
    expect(w().whenEvery).toBe('Every {days}');
    expect(w().arriveByNote).toBe('Please arrive by {time} for registration.');
  });
});

// Whether a batch offers a paid trial, and what it costs, as ONE field.
//
// `reservationInr: z.number().default(500)` could not express "this batch has
// no trial" at all, so every booking surface assumed one existed: an
// Intermediate batch whose booking link is a Google Form still rendered
// "Book my trial class · ₹500" and reported a ₹500 conversion to GA4.
describe('BatchSchema trialInr', () => {
  const raw = () => JSON.parse(JSON.stringify(seed));
  const parseBatch = (over: Record<string, unknown>) => {
    const r = raw();
    r.batches[0] = { ...r.batches[0], ...over };
    return SiteContentSchema.parse(r).batches[0];
  };

  it('migrates a stored reservationInr onto trialInr', () => {
    const r = raw();
    delete r.batches[0].trialInr;
    r.batches[0].reservationInr = 750;
    expect(SiteContentSchema.parse(r).batches[0].trialInr).toBe(750);
  });

  it('keeps an explicit null trial rather than resurrecting reservationInr', () => {
    expect(parseBatch({ trialInr: null, reservationInr: 500 }).trialInr).toBeNull();
  });

  it('defaults to 500 for a batch that carries neither field', () => {
    const r = raw();
    delete r.batches[0].trialInr;
    delete r.batches[0].reservationInr;
    expect(SiteContentSchema.parse(r).batches[0].trialInr).toBe(500);
  });

  // A required or non-nullable field here would throw inside the read path,
  // and content.ts serves the bundled seed for the ENTIRE public site when the
  // parse throws. Every batch field has to survive an absent value.
  it('accepts a null trial without failing the whole-document parse', () => {
    const r = raw();
    r.batches = r.batches.map((b: Record<string, unknown>) => ({ ...b, trialInr: null }));
    expect(() => SiteContentSchema.parse(r)).not.toThrow();
  });

  it('rejects a negative trial price', () => {
    const r = raw();
    r.batches[0].trialInr = -1;
    expect(() => SiteContentSchema.parse(r)).toThrow();
  });
});

describe('BatchSchema joinUntil', () => {
  const base = {
    id: 'b1', styleSlugs: ['salsa'], level: 'Foundation', branchSlug: 'jh',
    daysOfWeek: ['Sat'], time: '9:30–10:30 AM', startDate: '2026-09-01',
    priceInr: 6900, status: 'Open',
  };
  it('defaults to empty when absent, so stored documents parse unchanged', () => {
    expect(BatchSchema.parse(base).joinUntil).toBe('');
  });
  it('accepts a YYYY-MM-DD value', () => {
    expect(BatchSchema.parse({ ...base, joinUntil: '2026-10-01' }).joinUntil).toBe('2026-10-01');
  });
  it('rejects a non-date value', () => {
    expect(() => BatchSchema.parse({ ...base, joinUntil: 'soon' })).toThrow();
  });
});

describe('pages.home.rumba defaults', () => {
  it('ships the La Rumba band copy and three real photos', () => {
    const home = SiteContentObjectSchema.shape.pages.parse(undefined).home;
    expect(home.rumba.headline).toBe('Class teaches you. Saturday makes it yours.');
    expect(home.rumba.photos).toHaveLength(3);
    expect(home.rumba.testimonialId).toBe('test-004');
    expect(home.rumba.statTemplate).toContain('{n}');
  });
});

import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';

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

describe('pages.home.board', () => {
  const b = () => doc().pages.home.board;

  it('ships the board header exactly as it renders today', () => {
    expect(b().speed).toBe('Book in ~30 seconds');
    expect(b().headline).toBe('Start dancing');
    expect(b().headlineAccent).toBe('this week.');
  });

  // The codebase rule at Hero.tsx: the trial price comes from live batch data,
  // never from a hardcoded string, so the copy cannot go stale on its own.
  it('keeps the price out of prose except as a placeholder', () => {
    expect(b().leadWithPrice).toContain('{price}');
    expect(b().leadWithPrice).not.toMatch(/₹\s?\d/);
    expect(b().leadNoPrice).toBe('Come once, meet the room, then decide on the full program.');
    expect(b().trialPrice).toBe('Trial class {price}');
    expect(b().fullProgram).toBe('Full program {price} — decide after class one.');
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

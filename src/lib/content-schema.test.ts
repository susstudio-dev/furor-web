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

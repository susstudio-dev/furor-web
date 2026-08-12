import { describe, expect, it } from 'vitest';
import seed from '../data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';
import {
  batchPoolForTrack,
  duplicateTrackKeys,
  normaliseTracks,
  pickDefaultBatch,
  slugify,
  suggestTrackKey,
  unknownStyleSlugs,
} from './welcome-tracks';

// Welcome-page track editing and batch binding.
//
// The regressions this pins, all from one session where the studio tried to
// add a second Salsa page at a different timing:
//
//   1. The slug never followed the label. Auto-fill only ever ran on a BLANK
//      slug at save time, so renaming a track's label left the old slug in
//      place with nothing on screen saying so — the studio read the resulting
//      duplicate-slug error as "I can't run a second class at this timing".
//   2. Style slugs were free text, trimmed but never slugified. "Salsa"
//      matched zero batches (they store "salsa") and reported nothing.
//   3. The batch pool hardcoded level === 'Foundation', so an Intermediate
//      track could never bind to its batch — the page fell back to the manual
//      day/time strings with no date, no venue and no calendar links.

const track = (over: Partial<Parameters<typeof normaliseTracks>[0][number]> = {}) => ({
  key: '',
  trackLabel: '',
  styleSlugs: [] as string[],
  level: 'Foundation' as const,
  weekendTod: 'AM' as const,
  whenDays: '',
  whenTime: '',
  arriveBy: '',
  metaDesc: '',
  ...over,
});

describe('slugify', () => {
  it('turns a track label into a URL slug', () => {
    expect(slugify('Salsa Intermediate')).toBe('salsa-intermediate');
  });

  it('collapses punctuation and runs of separators', () => {
    expect(slugify('  Salsa  -  Intermediate! ')).toBe('salsa-intermediate');
    expect(slugify('West Coast Swing')).toBe('west-coast-swing');
  });

  it('returns empty for a label with nothing slug-worthy in it', () => {
    expect(slugify('—')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});

describe('suggestTrackKey', () => {
  // THE reported bug: the label said "Salsa Intermediate", the slug still
  // said "latin", and nothing offered the obvious slug.
  it('offers the slug a renamed label implies', () => {
    expect(suggestTrackKey('Salsa Intermediate', 'latin')).toBe('salsa-intermediate');
  });

  it('offers nothing when the slug already matches the label', () => {
    expect(suggestTrackKey('Salsa Intermediate', 'salsa-intermediate')).toBeNull();
  });

  it('offers nothing when the label yields no slug', () => {
    expect(suggestTrackKey('', 'latin')).toBeNull();
    expect(suggestTrackKey('!!!', 'latin')).toBeNull();
  });
});

describe('duplicateTrackKeys', () => {
  // /welcome/[track] resolves with find() — first match wins — so a second
  // track on the same slug is unreachable forever. Save has to refuse.
  it('reports a slug claimed by more than one track', () => {
    expect(
      duplicateTrackKeys([track({ key: 'latin' }), track({ key: 'wcs' }), track({ key: 'latin' })]),
    ).toEqual(['latin']);
  });

  it('reports each duplicated slug once', () => {
    expect(
      duplicateTrackKeys([
        track({ key: 'latin' }),
        track({ key: 'latin' }),
        track({ key: 'latin' }),
      ]),
    ).toEqual(['latin']);
  });

  it('passes distinct slugs', () => {
    expect(duplicateTrackKeys([track({ key: 'latin' }), track({ key: 'salsa-intermediate' })]))
      .toEqual([]);
  });

  it('ignores surrounding whitespace when comparing', () => {
    expect(duplicateTrackKeys([track({ key: 'latin' }), track({ key: ' latin ' })])).toEqual([
      'latin',
    ]);
  });
});

describe('normaliseTracks', () => {
  it('fills a blank slug from the track label', () => {
    const [t] = normaliseTracks([track({ key: '', trackLabel: 'Salsa Intermediate' })]);
    expect(t.key).toBe('salsa-intermediate');
  });

  it('never rewrites a slug the studio already set', () => {
    // The slug is on live Razorpay redirects — moving it silently breaks
    // every payment page pointing at it.
    const [t] = normaliseTracks([track({ key: 'latin', trackLabel: 'Salsa Intermediate' })]);
    expect(t.key).toBe('latin');
  });

  it('falls back to a placeholder when neither slug nor label yields one', () => {
    const [t] = normaliseTracks([track({ key: '', trackLabel: '' })]);
    expect(t.key).toBe('track');
  });

  // Batch matching is exact and case-sensitive, so "Salsa" silently found
  // nothing at all.
  it('slugifies hand-typed style slugs', () => {
    const [t] = normaliseTracks([track({ key: 'x', styleSlugs: ['Salsa', 'West Coast Swing'] })]);
    expect(t.styleSlugs).toEqual(['salsa', 'west-coast-swing']);
  });

  it('drops style entries that slugify to nothing', () => {
    const [t] = normaliseTracks([track({ key: 'x', styleSlugs: ['salsa', '  ', '-'] })]);
    expect(t.styleSlugs).toEqual(['salsa']);
  });

  it('can turn two blank slugs into a collision the save check then catches', () => {
    const filled = normaliseTracks([
      track({ trackLabel: 'Salsa Intermediate' }),
      track({ trackLabel: 'Salsa Intermediate' }),
    ]);
    expect(duplicateTrackKeys(filled)).toEqual(['salsa-intermediate']);
  });
});

describe('unknownStyleSlugs', () => {
  const known = ['salsa', 'bachata', 'west-coast-swing'];

  it('flags a style slug no dance style uses', () => {
    expect(unknownStyleSlugs(['Salsa'], known)).toEqual(['Salsa']);
    expect(unknownStyleSlugs(['salsa', 'kizomba'], known)).toEqual(['kizomba']);
  });

  it('passes slugs that exist', () => {
    expect(unknownStyleSlugs(['salsa', 'west-coast-swing'], known)).toEqual([]);
  });

  it('passes an empty list rather than complaining about nothing', () => {
    expect(unknownStyleSlugs([], known)).toEqual([]);
  });
});

// The live batch board, as of the seed: one Intermediate salsa batch at a
// different time of day from the Foundation one.
const BATCHES = [
  { id: 'batch-001', level: 'Foundation' as const, styleSlugs: ['salsa', 'bachata'], daysOfWeek: ['Sat', 'Sun'] as const, time: '9:30–10:30 AM' },
  { id: 'batch-002', level: 'Foundation' as const, styleSlugs: ['west-coast-swing'], daysOfWeek: ['Sat', 'Sun'] as const, time: '5:00–6:00 PM' },
  { id: 'batch-004', level: 'Intermediate' as const, styleSlugs: ['salsa'], daysOfWeek: ['Sat', 'Sun'] as const, time: '12:00–2:00 PM' },
  { id: 'batch-009', level: 'Foundation' as const, styleSlugs: ['salsa'], daysOfWeek: ['Wed'] as const, time: '7:00–8:00 PM' },
].map((b) => ({ ...b, daysOfWeek: [...b.daysOfWeek] }));

describe('batchPoolForTrack', () => {
  // THE blocker behind the reported one: with the level hardcoded to
  // Foundation, a "Salsa Intermediate" page could never see batch-004.
  it('binds an Intermediate track to its Intermediate batch', () => {
    const pool = batchPoolForTrack(BATCHES, {
      styleSlugs: ['salsa'],
      level: 'Intermediate',
    });
    expect(pool.map((b) => b.id)).toEqual(['batch-004']);
  });

  it('keeps a Foundation track away from the Intermediate batch', () => {
    const pool = batchPoolForTrack(BATCHES, { styleSlugs: ['salsa'], level: 'Foundation' });
    expect(pool.map((b) => b.id)).toEqual(['batch-001', 'batch-009']);
  });

  it('matches a track that lists several styles', () => {
    const pool = batchPoolForTrack(BATCHES, {
      styleSlugs: ['salsa', 'bachata'],
      level: 'Foundation',
    });
    expect(pool.map((b) => b.id)).toEqual(['batch-001', 'batch-009']);
  });

  it('finds nothing for a style slug that was typed wrong', () => {
    expect(batchPoolForTrack(BATCHES, { styleSlugs: ['Salsa'], level: 'Foundation' })).toEqual([]);
  });
});

describe('pickDefaultBatch', () => {
  const pool = batchPoolForTrack(BATCHES, { styleSlugs: ['salsa'], level: 'Foundation' });

  it('prefers a weekend batch in the track’s time of day', () => {
    expect(pickDefaultBatch(pool, { weekendTod: 'AM' })?.id).toBe('batch-001');
  });

  it('falls back to any weekend batch when none matches the time of day', () => {
    // batch-009 is the only PM salsa Foundation batch and it is midweek, so
    // the weekend AM batch is still the better default.
    expect(pickDefaultBatch(pool, { weekendTod: 'PM' })?.id).toBe('batch-001');
  });

  it('falls back to the first batch when none fall on a weekend', () => {
    const midweek = pool.filter((b) => b.id === 'batch-009');
    expect(pickDefaultBatch(midweek, { weekendTod: 'AM' })?.id).toBe('batch-009');
  });

  it('returns nothing for an empty pool', () => {
    expect(pickDefaultBatch([], { weekendTod: 'AM' })).toBeUndefined();
  });
});

describe('documents stored before `level` existed', () => {
  // Every welcome page that predates the field was a beginner intake, and the
  // stored document is read straight through SiteContentSchema — so the
  // default is the whole migration. If it stopped applying, every live
  // /welcome page would lose its date, venue and calendar links at once.
  it('backfills Foundation, binding exactly as they did before', () => {
    const tracks = seed.welcome.tracks.map((t) => {
      const legacy = { ...t } as Record<string, unknown>;
      delete legacy.level;
      return legacy;
    });
    const parsed = SiteContentSchema.parse({ ...seed, welcome: { ...seed.welcome, tracks } });

    expect(parsed.welcome.tracks.length).toBeGreaterThan(0);
    expect(parsed.welcome.tracks.map((t) => t.level)).toEqual(
      parsed.welcome.tracks.map(() => 'Foundation'),
    );
  });
});

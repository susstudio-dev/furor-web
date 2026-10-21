import { describe, expect, it } from 'vitest';
import seed from '../data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';
import {
  batchPoolForTrack,
  duplicateTrackKeys,
  levelMismatchedTracks,
  normaliseTracks,
  pickDefaultBatch,
  resolveWelcomeBatch,
  slugify,
  suggestTrackKey,
  tracksForBatch,
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
//
// Every fixture row carries a startDate and a status. The old fixture carried
// neither, which is exactly why `pickDefaultBatch` could ship a docstring
// promising "the soonest weekend batch" while comparing no dates at all: there
// was nothing in the test data for a date bug to be visible in.
//
// Deliberately NOT in date order — `content.batches` is stored in reverse
// creation order (BatchesEditor.add() prepends), so a function that picks by
// array position rather than by date must fail here.
const TODAY = '2026-08-16';

const BATCHES = [
  { id: 'batch-001', level: 'Foundation' as const, styleSlugs: ['salsa', 'bachata'], daysOfWeek: ['Sat', 'Sun'] as const, time: '9:30–10:30 AM', startDate: '2026-06-20', status: 'Open' as const },
  { id: 'batch-002', level: 'Foundation' as const, styleSlugs: ['west-coast-swing'], daysOfWeek: ['Sat', 'Sun'] as const, time: '5:00–6:00 PM', startDate: '2026-07-04', status: 'Open' as const },
  { id: 'batch-004', level: 'Intermediate' as const, styleSlugs: ['salsa'], daysOfWeek: ['Sat', 'Sun'] as const, time: '12:00–2:00 PM', startDate: '2026-07-04', status: 'Open' as const },
  { id: 'batch-009', level: 'Foundation' as const, styleSlugs: ['salsa'], daysOfWeek: ['Wed'] as const, time: '7:00–8:00 PM', startDate: '2026-09-05', status: 'Open' as const },
  { id: 'batch-010', level: 'Foundation' as const, styleSlugs: ['salsa'], daysOfWeek: ['Sat', 'Sun'] as const, time: '9:30–10:30 AM', startDate: '2026-10-10', status: 'Open' as const },
  { id: 'batch-011', level: 'Foundation' as const, styleSlugs: ['salsa'], daysOfWeek: ['Sat', 'Sun'] as const, time: '6:00–7:00 PM', startDate: '2026-09-19', status: 'Open' as const },
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
    expect(pool.map((b) => b.id)).toEqual(['batch-001', 'batch-009', 'batch-010', 'batch-011']);
  });

  it('matches a track that lists several styles', () => {
    const pool = batchPoolForTrack(BATCHES, {
      styleSlugs: ['salsa', 'bachata'],
      level: 'Foundation',
    });
    expect(pool.map((b) => b.id)).toEqual(['batch-001', 'batch-009', 'batch-010', 'batch-011']);
  });

  it('finds nothing for a style slug that was typed wrong', () => {
    expect(batchPoolForTrack(BATCHES, { styleSlugs: ['Salsa'], level: 'Foundation' })).toEqual([]);
  });
});

describe('pickDefaultBatch', () => {
  const pool = batchPoolForTrack(BATCHES, { styleSlugs: ['salsa'], level: 'Foundation' });

  it('prefers a weekend batch in the track’s time of day', () => {
    expect(pickDefaultBatch(pool, { weekendTod: 'AM' }, TODAY)?.id).toBe('batch-010');
  });

  it('falls back to any weekend batch when none matches the time of day', () => {
    // batch-011 is the soonest upcoming weekend batch; asked for PM it matches
    // outright, and it is what an AM-less pool would fall back to.
    expect(pickDefaultBatch(pool, { weekendTod: 'PM' }, TODAY)?.id).toBe('batch-011');
  });

  it('falls back to the first upcoming batch when none fall on a weekend', () => {
    const midweek = pool.filter((b) => b.id === 'batch-009');
    expect(pickDefaultBatch(midweek, { weekendTod: 'AM' }, TODAY)?.id).toBe('batch-009');
  });

  it('returns nothing for an empty pool', () => {
    expect(pickDefaultBatch([], { weekendTod: 'AM' }, TODAY)).toBeUndefined();
  });

  // THE bug behind "the confirmation page shows a class that already ran":
  // the old implementation compared no dates at all and took whatever sat
  // first in the array. `content.batches` is in reverse creation order, so the
  // past batch is routinely first.
  it('never defaults to a batch that has already started when one is upcoming', () => {
    const past = BATCHES.find((b) => b.id === 'batch-001')!;
    const upcoming = BATCHES.find((b) => b.id === 'batch-010')!;
    expect(pickDefaultBatch([past, upcoming], { weekendTod: 'AM' }, TODAY)?.id).toBe('batch-010');
  });

  it('picks the soonest upcoming batch, not the one stored first', () => {
    const later = BATCHES.find((b) => b.id === 'batch-010')!; // 2026-10-10
    const sooner = BATCHES.find((b) => b.id === 'batch-011')!; // 2026-09-19
    expect(pickDefaultBatch([later, sooner], { weekendTod: 'PM' }, TODAY)?.id).toBe('batch-011');
  });

  it('never defaults to a Closed batch', () => {
    const closed = { ...BATCHES.find((b) => b.id === 'batch-011')!, status: 'Closed' as const };
    const open = BATCHES.find((b) => b.id === 'batch-010')!;
    expect(pickDefaultBatch([closed, open], { weekendTod: 'PM' }, TODAY)?.id).toBe('batch-010');
  });

  // A confirmation page is a receipt: once every intake on the track has
  // started, the most recent one is still the honest answer — far better than
  // no venue at all for someone re-opening their link mid-course.
  it('falls back to the most recent past batch once every batch has started', () => {
    const old = BATCHES.find((b) => b.id === 'batch-001')!; // 2026-06-20
    const recent = BATCHES.find((b) => b.id === 'batch-002')!; // 2026-07-04
    expect(pickDefaultBatch([old, recent], { weekendTod: 'AM' }, TODAY)?.id).toBe('batch-002');
  });
});

// The rule that decides which welcome page a batch's payment redirect goes to.
//
// This existed only as an inline `tracks.find(style overlap)` inside
// BatchesEditor, while the page bound with style AND level — so the admin
// handed the studio a redirect URL for a page that structurally could not
// display that batch. One exported rule, used by both, is the fix.
describe('tracksForBatch', () => {
  const TRACKS = [
    { key: 'latin', level: 'Foundation' as const, styleSlugs: ['salsa', 'bachata'] },
    { key: 'wcs', level: 'Foundation' as const, styleSlugs: ['west-coast-swing'] },
  ];

  it('matches a Foundation batch to the Foundation track for its style', () => {
    const b = BATCHES.find((x) => x.id === 'batch-001')!;
    expect(tracksForBatch(TRACKS, b).map((t) => t.key)).toEqual(['latin']);
  });

  // THE reported bug, at its source: batch-004 is Intermediate salsa and the
  // only salsa track is Foundation, so there is NO welcome page for it. The
  // admin must say so instead of offering /welcome/latin.
  it('matches nothing when every style-matching track is a different level', () => {
    const b = BATCHES.find((x) => x.id === 'batch-004')!;
    expect(tracksForBatch(TRACKS, b)).toEqual([]);
  });

  it('reports every candidate when two tracks claim the same level and style', () => {
    const twin = { key: 'salsa-am', level: 'Foundation' as const, styleSlugs: ['salsa'] };
    const b = BATCHES.find((x) => x.id === 'batch-001')!;
    expect(tracksForBatch([...TRACKS, twin], b).map((t) => t.key)).toEqual(['latin', 'salsa-am']);
  });

  // The diagnostic the admin needs in order to be useful rather than silent:
  // "a page exists for this style but it is set to Foundation".
  it('levelMismatchedTracks names the style-matching track at the wrong level', () => {
    const b = BATCHES.find((x) => x.id === 'batch-004')!;
    expect(levelMismatchedTracks(TRACKS, b).map((t) => t.key)).toEqual(['latin']);
  });

  it('levelMismatchedTracks stays quiet when the level already matches', () => {
    const b = BATCHES.find((x) => x.id === 'batch-001')!;
    expect(levelMismatchedTracks(TRACKS, b)).toEqual([]);
  });
});

// Which batch a post-payment visit is about, decided on the SERVER.
//
// The pin used to be resolved in a client useEffect against the already
// level-filtered option list, so a `?b=` naming a batch outside the pool
// matched nothing and silently kept a DIFFERENT batch's date, venue and .ics.
describe('resolveWelcomeBatch', () => {
  const latin = { level: 'Foundation' as const, styleSlugs: ['salsa', 'bachata'], weekendTod: 'AM' as const };
  const resolve = (over: Partial<Parameters<typeof resolveWelcomeBatch>[0]> = {}) =>
    resolveWelcomeBatch({ batchId: null, dateIso: null, batches: BATCHES, track: latin, today: TODAY, ...over });

  it('honours ?b= for a batch on the track', () => {
    expect(resolve({ batchId: 'batch-010' }).batch?.id).toBe('batch-010');
  });

  // Links already pasted into live Razorpay pages cannot be edited
  // retroactively, so an off-track ?b= must still resolve to the batch the
  // customer actually paid for rather than to a stranger's timetable.
  it('honours ?b= for a batch the track would not otherwise include', () => {
    const got = resolve({ batchId: 'batch-004' });
    expect(got.batch?.id).toBe('batch-004');
    expect(got.batch?.level).toBe('Intermediate');
  });

  it('resolves ?b= for a batch whose start date has already passed', () => {
    expect(resolve({ batchId: 'batch-001' }).batch?.id).toBe('batch-001');
  });

  // Honest over confident: a pin that names nothing must not hand the payer
  // another batch's venue and calendar file.
  it('reports a miss rather than substituting the default batch', () => {
    const got = resolve({ batchId: 'deleted-batch' });
    expect(got.batch).toBeNull();
    expect(got.pinMissed).toBe(true);
  });

  it('honours ?d= within the track', () => {
    expect(resolve({ dateIso: '2026-10-10' }).batch?.id).toBe('batch-010');
  });

  it('reports a miss for a ?d= no batch on the track starts on', () => {
    expect(resolve({ dateIso: '2030-01-01' }).pinMissed).toBe(true);
  });

  it('lets ?b= win over ?d= when the redirect carries both', () => {
    expect(resolve({ batchId: 'batch-011', dateIso: '2026-10-10' }).batch?.id).toBe('batch-011');
  });

  // A bare pages.razorpay.com redirect carries no params at all.
  it('falls back to the date-aware default when nothing is pinned', () => {
    const got = resolve();
    expect(got.batch?.id).toBe('batch-010');
    expect(got.pinMissed).toBe(false);
  });

  it('returns no batch and no miss when the track has none at all', () => {
    const got = resolve({ track: { level: 'Advanced', styleSlugs: ['kizomba'], weekendTod: 'AM' } });
    expect(got.batch).toBeNull();
    expect(got.pinMissed).toBe(false);
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

// The reported failure, replayed against the document the site actually
// ships. These read the seed rather than a fixture on purpose: the bug was
// only visible in the interaction between the real tracks (both Foundation)
// and the real batches (one Intermediate, one Advanced).
describe('the shipped document', () => {
  const content = SiteContentSchema.parse(seed);
  const batch = (id: string) => content.batches.find((b) => b.id === id)!;

  it('offers no welcome page for the Advanced batch instead of a Foundation one', () => {
    // Both shipped tracks are Foundation. batch-005 is Advanced bachata, and
    // its Razorpay page is live — the admin used to hand the studio
    // /welcome/latin for it, and the payer landed on a beginner salsa intake.
    expect(tracksForBatch(content.welcome.tracks, batch('batch-005'))).toEqual([]);
    expect(levelMismatchedTracks(content.welcome.tracks, batch('batch-005')).map((t) => t.key))
      .toEqual(['latin']);
  });

  it('offers no welcome page for the Intermediate batch either', () => {
    expect(tracksForBatch(content.welcome.tracks, batch('batch-004'))).toEqual([]);
  });

  it('still binds each Foundation batch to its own track', () => {
    expect(tracksForBatch(content.welcome.tracks, batch('batch-001')).map((t) => t.key)).toEqual([
      'latin',
    ]);
    expect(tracksForBatch(content.welcome.tracks, batch('batch-002')).map((t) => t.key)).toEqual([
      'wcs',
    ]);
  });

  // Links already pasted into live Razorpay pages cannot be edited
  // retroactively. /welcome/latin?b=batch-005 must now show the batch that was
  // actually paid for — 2:00–3:00 PM on 18 July — not batch-rp8nn4's 9:30 AM.
  it('resolves an already-minted off-track ?b= to the batch that was paid for', () => {
    const latin = content.welcome.tracks.find((t) => t.key === 'latin')!;
    const got = resolveWelcomeBatch({
      batchId: 'batch-005',
      dateIso: '2026-07-18',
      batches: content.batches,
      track: latin,
      today: '2026-08-16',
    });
    expect(got.batch?.id).toBe('batch-005');
    expect(got.batch?.time).toBe('2:00–3:00 PM');
    expect(got.batch?.startDate).toBe('2026-07-18');
  });
});

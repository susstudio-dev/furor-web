// Welcome-page tracks: slug handling for the admin editor, and the rule that
// binds a track to a live batch. Pure so both the editor and the server
// component agree on it — they disagreed before, which is how a page could
// look correctly configured in /admin and still find no batch at all.

import type { Batch, WelcomeTrack } from './content-schema';

/** Lowercase, hyphen-separated, nothing else — this becomes a URL path segment. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The slug a track label implies, or null when there is nothing worth
 * offering (the label yields no slug, or the slug already matches).
 *
 * Deliberately a *suggestion*: a saved slug is the redirect target on a live
 * Razorpay payment page, so renaming the label must never move the URL on its
 * own. The editor auto-applies this only for tracks added in the current
 * session, and otherwise shows it as a one-click chip.
 */
export function suggestTrackKey(trackLabel: string, currentKey: string): string | null {
  const suggestion = slugify(trackLabel);
  if (!suggestion || suggestion === currentKey.trim()) return null;
  return suggestion;
}

/**
 * Slugs claimed by more than one track, each reported once.
 *
 * /welcome/[track] resolves with `find()` — first match wins — so a second
 * track on the same slug is unreachable for good. Save refuses on a non-empty
 * result rather than writing a page that can never be opened.
 */
export function duplicateTrackKeys(tracks: Pick<WelcomeTrack, 'key'>[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const t of tracks) {
    const key = t.key.trim();
    if (!key) continue;
    if (seen.has(key)) dups.add(key);
    seen.add(key);
  }
  return [...dups];
}

/**
 * Save-time normalisation: fill a blank slug from the label (the schema
 * requires one, and the URL needs it) and slugify the hand-typed style slugs.
 *
 * Style slugs are matched against batches exactly, so a stray capital used to
 * mean the page matched no batch and said nothing about it.
 */
export function normaliseTracks<T extends Pick<WelcomeTrack, 'key' | 'trackLabel' | 'styleSlugs'>>(
  tracks: T[],
): T[] {
  return tracks.map((t) => ({
    ...t,
    key: t.key.trim() || slugify(t.trackLabel) || 'track',
    styleSlugs: t.styleSlugs.map(slugify).filter(Boolean),
  }));
}

/** Style slugs on a track that no dance style actually publishes. */
export function unknownStyleSlugs(styleSlugs: string[], knownSlugs: string[]): string[] {
  const known = new Set(knownSlugs);
  return styleSlugs.filter((s) => !known.has(s));
}

/**
 * The batches a welcome page can bind to: same level, sharing at least one
 * style. Level is per-track (it used to be hardcoded to 'Foundation', which
 * left an Intermediate page permanently unable to find its batch).
 *
 * Takes the FULL `content.batches`, not `visibleBatches`. A confirmation page
 * is a receipt: it has to keep resolving for a batch that already started, so
 * the pool is deliberately unfiltered and unsorted. Ordering and the
 * past/upcoming decision belong to `pickDefaultBatch`, which is the only
 * consumer that needs them — see the note there.
 */
export function batchPoolForTrack<B extends Pick<Batch, 'level' | 'styleSlugs'>>(
  batches: B[],
  track: Pick<WelcomeTrack, 'level' | 'styleSlugs'>,
): B[] {
  return batches.filter(
    (b) => b.level === track.level && b.styleSlugs.some((s) => track.styleSlugs.includes(s)),
  );
}

/**
 * Every welcome page a batch's payment redirect could legitimately land on:
 * same level, sharing at least one style — the exact inverse of
 * `batchPoolForTrack`.
 *
 * This is the rule the ADMIN must use when it offers a "redirect after
 * payment" URL. It used to have its own copy of the rule inline
 * (`tracks.find(style overlap)`, no level term) while the page required level
 * equality too, so the studio was handed a confident URL for a page that
 * structurally could not display that batch — an Advanced customer landed on
 * a Foundation batch's date, time, venue and calendar file. One exported
 * rule, both callers, no drift.
 *
 * Returns ALL candidates rather than the first: `find()` silently picking
 * tracks[0] is what made a second page for the same style unreachable.
 */
export function tracksForBatch<T extends Pick<WelcomeTrack, 'level' | 'styleSlugs'>>(
  tracks: T[],
  batch: Pick<Batch, 'level' | 'styleSlugs'>,
): T[] {
  return tracks.filter(
    (t) => t.level === batch.level && batch.styleSlugs.some((s) => t.styleSlugs.includes(s)),
  );
}

/**
 * Tracks that teach this batch's style but at a different level — the
 * near-miss worth naming in the admin.
 *
 * Without this the editor can only say "no welcome page matches this batch's
 * styles yet", which is false and unhelpful for the real case: the page
 * exists, it is simply set to Foundation while the batch is Intermediate.
 */
export function levelMismatchedTracks<T extends Pick<WelcomeTrack, 'level' | 'styleSlugs'>>(
  tracks: T[],
  batch: Pick<Batch, 'level' | 'styleSlugs'>,
): T[] {
  return tracks.filter(
    (t) => t.level !== batch.level && batch.styleSlugs.some((s) => t.styleSlugs.includes(s)),
  );
}

type Pickable = Pick<Batch, 'daysOfWeek' | 'time' | 'startDate' | 'status'>;

/**
 * The batch shown when the redirect didn't pin one with ?d= / ?b=.
 *
 * Date-aware, and it has to be: this used to compare no dates at all and take
 * whatever sat first in the array. `content.batches` is stored in REVERSE
 * creation order (BatchesEditor.add() prepends), so "first" routinely meant a
 * batch that had already finished — a bare /welcome/latin was telling people
 * their first class was three weeks ago and handing them a calendar invite
 * for it.
 *
 * The rule: among batches still to come (and not Closed), prefer the soonest
 * weekend batch in the track's time of day. Only when every batch on the
 * track has already started does it fall back to the most recent one — for
 * someone re-opening their confirmation link mid-course that is still the
 * right receipt, and a real past venue beats no venue at all.
 */
export function pickDefaultBatch<B extends Pickable>(
  pool: B[],
  track: Pick<WelcomeTrack, 'weekendTod'>,
  today: string,
): B | undefined {
  const matchesTod = (b: B) => (track.weekendTod === 'AM' ? /am/i.test(b.time) : /pm/i.test(b.time));
  const isWeekend = (b: B) => b.daysOfWeek.some((d) => d === 'Sat' || d === 'Sun');
  const byDate = [...pool].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const upcoming = byDate.filter((b) => b.startDate >= today && b.status !== 'Closed');
  if (upcoming.length > 0) {
    const weekend = upcoming.filter(isWeekend);
    return weekend.find(matchesTod) ?? weekend[0] ?? upcoming[0];
  }

  return byDate[byDate.length - 1];
}

/** Which batch a post-payment `/welcome/<track>` visit is about. */
export interface WelcomeBatchResolution<B> {
  batch: B | null;
  /**
   * The redirect named a specific batch (?b= / ?d=) and it could not be
   * found. The page must then show its no-batch state rather than a different
   * batch's date, venue and .ics — "we'll confirm on WhatsApp" is recoverable,
   * a confidently wrong address is not.
   */
  pinMissed: boolean;
}

/**
 * Resolve the confirmation page's batch, on the SERVER.
 *
 * This used to happen in a client `useEffect` against the already
 * level-filtered option list, which meant three things went wrong at once:
 * the initial HTML always showed the default batch, a no-JS visitor never got
 * past it, and a `?b=` naming a batch outside the pool matched nothing and
 * silently kept a stranger's timetable.
 *
 * `?b=` is resolved against EVERY batch, not just the track's pool. URLs
 * already pasted into live Razorpay payment pages cannot be edited
 * retroactively, so an off-track pin must still produce the batch the
 * customer actually paid for. `?d=` stays scoped to the track — a bare date
 * is ambiguous across tracks.
 */
export function resolveWelcomeBatch<
  B extends Pickable & Pick<Batch, 'id' | 'level' | 'styleSlugs'>,
>(args: {
  batchId: string | null;
  dateIso: string | null;
  batches: B[];
  track: Pick<WelcomeTrack, 'level' | 'styleSlugs' | 'weekendTod'>;
  today: string;
}): WelcomeBatchResolution<B> {
  const { batchId, dateIso, batches, track, today } = args;

  if (batchId) {
    const pinned = batches.find((b) => b.id === batchId);
    return pinned ? { batch: pinned, pinMissed: false } : { batch: null, pinMissed: true };
  }

  const pool = batchPoolForTrack(batches, track);

  if (dateIso) {
    const pinned = pool.find((b) => b.startDate === dateIso);
    return pinned ? { batch: pinned, pinMissed: false } : { batch: null, pinMissed: true };
  }

  return { batch: pickDefaultBatch(pool, track, today) ?? null, pinMissed: false };
}

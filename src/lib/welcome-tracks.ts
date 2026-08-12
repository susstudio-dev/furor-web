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
 * Callers pass an already-filtered, date-sorted list — `visibleBatches`.
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
 * The batch shown when the redirect didn't pin one with ?d= / ?b=: the
 * soonest weekend batch in the track's time of day, else any weekend batch,
 * else whatever is next.
 */
export function pickDefaultBatch<B extends Pick<Batch, 'daysOfWeek' | 'time'>>(
  pool: B[],
  track: Pick<WelcomeTrack, 'weekendTod'>,
): B | undefined {
  const matchesTod = (b: B) => (track.weekendTod === 'AM' ? /am/i.test(b.time) : /pm/i.test(b.time));
  const isWeekend = (b: B) => b.daysOfWeek.some((d) => d === 'Sat' || d === 'Sun');
  const weekend = pool.filter(isWeekend);
  return weekend.find(matchesTod) ?? weekend[0] ?? pool[0];
}

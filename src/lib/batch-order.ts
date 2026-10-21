// Level-first ordering for batch listings.
//
// The primary persona is someone who has never danced. A date-sorted board
// puts whichever batch starts soonest in front of them — which on a real week
// can mean an Advanced Bachata card in slot two. Ordering by level puts the
// classes they can actually join first, everywhere, by default; date ordering
// stays available as an explicit choice.

const LEVEL_ORDER = ['Foundation', 'Intermediate', 'Advanced'] as const;

export function levelRank(level: string): number {
  const i = (LEVEL_ORDER as readonly string[]).indexOf(level);
  // An unknown level added later in the admin sinks to the end — it must never
  // outrank Foundation on a page built for first-timers.
  return i === -1 ? LEVEL_ORDER.length : i;
}

/** Foundation → Intermediate → Advanced; soonest start first within a level. */
export function compareByLevel(
  a: { level: string; startDate: string },
  b: { level: string; startDate: string },
): number {
  return levelRank(a.level) - levelRank(b.level) || a.startDate.localeCompare(b.startDate);
}

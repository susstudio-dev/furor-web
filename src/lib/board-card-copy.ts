/** The two notes the home board holds for its cards. Structural rather than a
 *  slice of SiteContent, matching `Bookable` in book-label.ts: this module
 *  needs two strings, not a dependency on the whole content schema. */
export interface BoardNotes {
  /** Shown on every Foundation card. */
  spotlitNote: string;
  /** Shown on everything above Foundation. */
  higherLevelNote: string;
}

export interface CardNote {
  text: string;
  /** 'loud' is the spotlit card's own weight; every other card is 'quiet'. */
  tone: 'loud' | 'quiet';
}

/**
 * The who-it's-for line under a board card's level.
 *
 * Keyed on the LEVEL, never on the spotlight. The board's original ladder read
 * `spotlit ? spotlitNote : !foundation ? higherLevelNote : null`, which quietly
 * conflated two different questions — *who is this class for* and *which card
 * is the board's default* — into one flag. Any Foundation batch that was not
 * in slot one fell through to `null`.
 *
 * That is not a cosmetic gap. On a real week the board carried two identical
 * Foundation courses (West Coast Swing and Salsa + Bachata — same level, same
 * fee, same welcome, different style and hour). The first was told "no partner,
 * no experience needed"; the second was told nothing at all, while the Advanced
 * card beside it still said "for dancers with the basics down". The one card
 * with a blank where its siblings have a sentence reads as an oversight at the
 * exact moment a beginner is choosing — and it was, for weeks.
 *
 * So: the level decides WHAT a card says, the spotlight decides only how loudly
 * it says it. The spotlight keeps its lit edge, its beam and its "start here"
 * badge — every signal that makes it the default — without being the sole
 * gatekeeper of basic reassurance.
 *
 * Returns null only when the owner has cleared that note in the admin, which is
 * this content document's "blank hides the element" convention throughout.
 */
export function cardNote(
  batch: { level: string },
  spotlit: boolean,
  board: BoardNotes,
): CardNote | null {
  const text = batch.level === 'Foundation' ? board.spotlitNote : board.higherLevelNote;
  if (!text) return null;
  return { text, tone: spotlit ? 'loud' : 'quiet' };
}

import { describe, expect, it } from 'vitest';
import { cardNote } from './board-card-copy';

const BOARD = {
  spotlitNote: 'No partner, no experience needed.',
  higherLevelNote: 'For dancers with the basics down.',
};

describe('cardNote', () => {
  it('gives the spotlit beginner card the beginner note at full weight', () => {
    expect(cardNote({ level: 'Foundation' }, true, BOARD)).toEqual({
      text: BOARD.spotlitNote,
      tone: 'loud',
    });
  });

  // The live bug, 2026-08-25. The board's note ladder read
  // `spotlit ? spotlitNote : !foundation ? higherLevelNote : null` — keyed on
  // the SPOTLIGHT rather than on the level. A second Foundation batch (the
  // same course, another style, another time) therefore fell through to
  // `null` and shipped the ONLY card on the board with no line at all, while
  // the Advanced card beside it still said "For dancers with the basics down."
  // The beginner's second option read as less welcoming than the expert's.
  //
  // Keying on the level is the whole fix: the spotlight decides how LOUD the
  // note is, never whether there is one.
  it('gives every OTHER beginner card the same note, quietly', () => {
    expect(cardNote({ level: 'Foundation' }, false, BOARD)).toEqual({
      text: BOARD.spotlitNote,
      tone: 'quiet',
    });
  });

  it('gives higher levels the experienced-dancer note', () => {
    expect(cardNote({ level: 'Intermediate' }, false, BOARD)).toEqual({
      text: BOARD.higherLevelNote,
      tone: 'quiet',
    });
    expect(cardNote({ level: 'Advanced' }, false, BOARD)).toEqual({
      text: BOARD.higherLevelNote,
      tone: 'quiet',
    });
  });

  // The asymmetry IS the bug: no card may sit silent while its siblings speak.
  it('never leaves a card silent while the board still has copy for its level', () => {
    for (const level of ['Foundation', 'Intermediate', 'Advanced', 'Masterclass']) {
      expect(cardNote({ level }, false, BOARD)).not.toBeNull();
    }
  });

  // A level invented later in the admin must not fall through to silence. It
  // is not Foundation, so it reads as the experienced lane — the same way
  // levelRank() sinks an unknown level below Foundation rather than above it.
  it('treats a level the admin invents later as a higher level', () => {
    expect(cardNote({ level: 'Masterclass' }, false, BOARD)?.text).toBe(BOARD.higherLevelNote);
  });

  // "Blank hides the element" is the convention across this content document,
  // so an owner who clears a note still gets silence — deliberately, from the
  // admin, rather than as a side effect of which slot a batch landed in.
  it('returns null when the owner has blanked that note', () => {
    expect(cardNote({ level: 'Foundation' }, true, { ...BOARD, spotlitNote: '' })).toBeNull();
    expect(cardNote({ level: 'Advanced' }, false, { ...BOARD, higherLevelNote: '' })).toBeNull();
  });
});

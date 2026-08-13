'use client';

// Counts code POINTS, not UTF-16 code units — admin copy carries "·", "—" and
// emoji, and .length would tell an editor their line is longer than it is.
// Mirrors the counting rule already used ad hoc in
// src/app/admin/labels/LabelsEditor.tsx; pulled into a shared component here
// because SeoFields is the first of several editors (batches, board copy) that
// need the same "X/max characters" hint against a budget.
function codePointCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/**
 * A live "X/max characters" hint below a text input.
 *
 * Under budget: the count plus an optional trailing note. Over budget: the
 * note is dropped in favour of a warning, and the text turns gold — the
 * editor needs to know it will be cut off, not the reason a value nobody typed
 * would have been fine.
 */
export function CharCount({
  text,
  max,
  note,
}: {
  text: string;
  max: number;
  note?: string;
}) {
  const count = codePointCount(text);
  const over = count > max;
  return (
    <p className={`mt-1 text-xs ${over ? 'text-gold-400' : 'text-cream/40'}`}>
      {count}/{max} characters
      {over ? ' — too long, it will be cut off' : note ? ` · ${note}` : ''}
    </p>
  );
}

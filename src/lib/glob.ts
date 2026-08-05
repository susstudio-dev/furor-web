import { keyPath } from './patch-path';

// Grant patterns are matched segment-wise against the KEY names of a path;
// id/index addressing is irrelevant to a grant ("may write batches" covers
// every batch).
//
//   *   matches exactly one segment
//   **  matches every remaining segment, including none
//
// A pattern that is a proper PREFIX of the path grants the whole subtree
// beneath it, so `batches` covers `batches[id=x].priceInr`. The converse is
// deliberately false: `batches.priceInr` does not authorize writing the whole
// `batches[id=x]` record.
//
// Segment-wise comparison is what keeps a grant on `stories` out of
// `storiesArchive` — a substring match would leak between sibling keys.
export function matchPath(pattern: string, path: string): boolean {
  const p = pattern.split('.');
  const t = keyPath(path);

  for (let i = 0; i < p.length; i++) {
    if (p[i] === '**') return true;
    if (i >= t.length) return false;
    if (p[i] === '*') continue;
    if (p[i] !== t[i]) return false;
  }
  // Pattern fully consumed: equal length is an exact match, shorter is a
  // subtree grant. Both match.
  return true;
}

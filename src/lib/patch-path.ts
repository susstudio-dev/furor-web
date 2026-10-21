// Parses the path strings used by the admin save envelope, e.g.
//   site.whatsappNumber
//   batches[id=batch-rp8nn4].priceInr
//   pages.faqs.sections[2].heading
//
// Two addressing modes, deliberately distinct:
//  - [id=…] for collections whose order is presentational (records get
//    reordered, inserted and removed, so a positional index would silently
//    re-target a different record after any list edit)
//  - [n]    for arrays whose order IS the data (paragraphs, FAQ sections)

export type PathSegment =
  | { kind: 'key'; key: string }
  | { kind: 'id'; key: string; id: string }
  | { kind: 'index'; key: string; index: number };

export class InvalidPathError extends Error {
  constructor(path: string, reason: string) {
    super(`Invalid path ${JSON.stringify(path)}: ${reason}`);
    this.name = 'InvalidPathError';
  }
}

// Rejected BEFORE any glob matching or property assignment. The codebase's
// only prototype-pollution guard lives in mergeWithSeed on the READ path; a
// deep-set by dotted path on the WRITE path bypasses it, and Zod cannot undo
// prototype mutation because __proto__ is never an own key.
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

// The id charset excludes '.' on purpose: paths are split on '.', so a dot
// inside an id would silently re-target a different record. Real ids are
// `<prefix>-<suffix>` (see randomId in src/lib/id.ts), so this costs nothing,
// and an id that ever violated it fails loudly here instead of quietly.
const SEGMENT = /^([A-Za-z][A-Za-z0-9_]*)(?:\[(?:id=([A-Za-z0-9_-]+)|(\d+))\])?$/;

export function parsePath(path: string): PathSegment[] {
  if (!path || path === '$') throw new InvalidPathError(path, 'empty or root path');

  const out: PathSegment[] = [];
  for (const raw of path.split('.')) {
    const m = SEGMENT.exec(raw);
    if (!m) throw new InvalidPathError(path, `malformed segment ${JSON.stringify(raw)}`);
    const [, key, id, index] = m;
    if (RESERVED.has(key)) throw new InvalidPathError(path, `reserved segment ${key}`);
    if (id !== undefined) out.push({ kind: 'id', key, id });
    else if (index !== undefined) out.push({ kind: 'index', key, index: Number(index) });
    else out.push({ kind: 'key', key });
  }
  return out;
}

export function formatPath(segments: PathSegment[]): string {
  return segments
    .map((s) =>
      s.kind === 'id'
        ? `${s.key}[id=${s.id}]`
        : s.kind === 'index'
          ? `${s.key}[${s.index}]`
          : s.key,
    )
    .join('.');
}

/** The path with all addressing stripped, e.g. `batches[id=x].priceInr` →
 *  `['batches', 'priceInr']`. This is what grant patterns match against. */
export function keyPath(path: string): string[] {
  return parsePath(path).map((s) => s.key);
}

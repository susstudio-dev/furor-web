# Admin Foundation — patch saves, concurrency and enforcement (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace whole-document admin saves with authorized, conflict-safe patch saves — so
that two people editing at once cannot clobber each other and the server can refuse a write it
should not accept.

**Architecture:** The client keeps holding the whole `SiteContent` and keeps producing whole
arrays for lists (that is all the existing editors can honestly produce). What changes is the
wire and the server: the client sends an **op envelope**, the server **expands** those ops into
per-record *leaf changes* by id, authorizes every leaf against both the pre- and post-patch
record, validates the whole merged document, then writes with a **compare-and-swap** on the R2
etag. Every one of those pieces is a pure function in `src/lib/` with no Next or R2 imports, so
they are unit-testable without a Worker.

**Tech Stack:** Next.js 15.5 App Router, React 19, Zod 3, `@opennextjs/cloudflare` 1.20 on
Cloudflare Workers (free plan), R2 for storage, Tailwind 3. Tests: **vitest** (dev dependency,
added by this plan).

**Spec:** [`docs/superpowers/specs/2026-08-02-admin-cms-abac-design.md`](../specs/2026-08-02-admin-cms-abac-design.md)

**Plan sequence (this is plan 1):**
1. **Foundation** — this document.
2. Identity & roles — `users.json`, subject resolution, invites, Users screen, enforcement on all admin pages.
3. Drafts, approval, preview (new tab + split view), `useEditor`, mobile admin shell.
4. CMS — media library, page blocks, scheduling, theming, campaigns + migration.

---

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include these.

- **No new runtime dependencies.** `vitest` is a **dev** dependency only.
- **PBKDF2 iterations stay at 50 000** — not workerd's 100 000 cap. At the cap a login brushes
  the 10 ms CPU limit and 500s.
- **Workers free plan: 10 ms CPU per invocation.** R2 I/O does not count against it; **JSON
  parsing does**. Budget by *number of parses of the 53 KB content document per request*.
- **Never validate a patch fragment against `SiteContentSchema`.** Every top-level key except
  `version`, `site` and `hero` carries `.default()`, so parsing a fragment silently resets all
  of them to defaults. Always read → merge → validate the whole document.
- **Never add a `.refine()` rejecting future dates** to any field. A stored document that fails
  Zod makes `getContent()` serve the bundled *seed for the entire site* with no error surfaced
  (`src/lib/content.ts:67`).
- **The write path must never read through `getContent()` / `readContentRaw()`.** The 30 s
  per-isolate cache makes a stale read *pass* the version check.
- **Reserved path segments** (`__proto__`, `constructor`, `prototype`) are rejected with a hard
  400 before any glob matching. The existing guard in `mergeWithSeed` is read-path only.
- **R2 conditional put returns `null` on precondition failure** — it does not throw. Test
  `result === null`.
- Use `obj.etag` (unquoted) in `onlyIf`, never `obj.httpEtag`.
- **Segment configs must be literals.** `export const dynamic = cond ? … : …` is a build failure
  (`process.exit(1)`).
- Commit after every task. Conventional-commit prefixes (`feat:`, `fix:`, `test:`, `chore:`).

---

## File Structure

**Created — pure logic (no Next/R2 imports, fully unit-tested):**

| File | Responsibility |
|---|---|
| `src/lib/patch-path.ts` | Parse and validate a path string into segments. Rejects reserved segments. |
| `src/lib/collections.ts` | Registry of id-keyed collections. Single source of truth for "is this an identified array". |
| `src/lib/patch.ts` | `Op` types + `applyOps(doc, ops)` → new document. |
| `src/lib/expand.ts` | `expandOps(base, ops)` → `LeafChange[]`, diffing arrays by id. |
| `src/lib/glob.ts` | `matchPath(pattern, path)` — segment-wise `*` / `**`, prefix grants. |
| `src/lib/roles.ts` | The six built-in roles as data + section-key → path-glob table. |
| `src/lib/authz.ts` | `authorize(subject, changes)` — default-deny, deny-overrides, pre/post record checks. |
| `src/lib/save-pipeline.ts` | `applyAndAuthorize(doc, subject, ops)` — the whole decision, no I/O. |
| `src/lib/diff-ops.ts` | Client-side: structural diff of a section against its base → `Op[]`. |

**Modified:**

| File | Change |
|---|---|
| `src/lib/storage.ts` | Widen `R2BucketLike` (etag, customMetadata, onlyIf); add `readDocWithVersion` / `writeDocIfMatch`; dev sidecar. |
| `src/lib/content.ts` | `NEVER_SEED` key set in `mergeWithSeed`. |
| `src/lib/content-schema.ts` | Document-level uniqueness `superRefine`; `authorId` on stories. |
| `src/lib/content-write.ts` | Snapshot after write, skip unchanged, rev-keyed names, defaults-floor restore. |
| `src/lib/audit.ts` | CAS write with one retry; `authz_denied`; changed-path detail. |
| `src/lib/admin-save.ts` | Send an op envelope; surface 409/403 distinctly. |
| `src/app/api/admin/save/route.ts` | Wire the pipeline; per-subject rate limit. |
| `src/app/api/admin/restore/route.ts` | Restore as a computed op set through the same authorizer. |
| `src/app/admin/{styles,studios,pages/custom}/*Editor.tsx` | Fix the shallow-copy `move()` mutation. |
| `next.config.mjs`, `src/app/layout.tsx`, `src/app/sitemap.ts`, `src/lib/base-path.ts` | GH Pages retirement. |

**Deleted:** `.github/workflows/deploy-pages.yml`, `src/lib/base-path.ts`.

---

## Task 1: Retire the GitHub Pages mirror

Decision 3 in the spec. Doing this first removes the `GH_PAGES` guard requirement from every
later `cookies()` call — a guard whose omission fails **only** in CI.

**Files:**
- Delete: `.github/workflows/deploy-pages.yml`, `src/lib/base-path.ts`
- Modify: `next.config.mjs`, `src/app/layout.tsx:32,44,80`, `src/app/sitemap.ts:11`
- Modify: every `withBase()` call site

- [ ] **Step 1: Find every affected site**

```bash
grep -rn "GH_PAGES\|withBase\|base-path\|NEXT_PUBLIC_BASE_PATH" src/ next.config.mjs .github/
```

Expected: `layout.tsx` (3 hits), `sitemap.ts` (1), `next.config.mjs` (basePath/output/REPO),
`base-path.ts`, plus `withBase()` consumers.

- [ ] **Step 2: Delete the workflow and the helper**

```bash
git rm .github/workflows/deploy-pages.yml src/lib/base-path.ts
```

- [ ] **Step 3: Replace `withBase(x)` with `x` at every call site**

`withBase()` prefixed asset/link URLs with `/furor-web` for the mirror. On Workers the base path
is empty, so each call becomes its literal argument. Example:

```tsx
// before
<img src={withBase('/photos/DSC01.jpg')} />
// after
<img src="/photos/DSC01.jpg" />
```

- [ ] **Step 4: Unwrap the `GH_PAGES` conditionals**

```tsx
// src/app/layout.tsx — before
const isMirror = process.env.GH_PAGES === 'true';
…
...(isMirror ? { robots: { index: false, follow: false } } : {}),
…
if (process.env.GH_PAGES !== 'true') await connection();

// after — delete isMirror and the robots spread entirely, and:
await connection();
```

Do the same in `src/app/sitemap.ts:11`. In `next.config.mjs`, remove `const REPO`, the
`basePath`, `trailingSlash`, `output: 'export'` branch and the `NEXT_PUBLIC_BASE_PATH` plumbing.
**Leave** `images.unoptimized`, the CSP/headers block, and the `distDir` dev/prod split alone.

- [ ] **Step 5: Verify the build and that nothing references the mirror**

```bash
npm run typecheck && npm run build
grep -rn "GH_PAGES\|withBase" src/ next.config.mjs || echo "clean"
```

Expected: typecheck passes, build succeeds, grep prints `clean`.

- [ ] **Step 6: Commit**

**Stage explicit paths only.** The working tree contains unrelated in-progress changes belonging
to someone else (`src/components/Hero.tsx`, `src/components/QuickEnroll.tsx`, untracked `.jpeg`
files). `git add -A` would sweep them into your commit. This applies to **every** task in this
plan.

```bash
git add next.config.mjs src/app/layout.tsx src/app/sitemap.ts \
        src/components/BrandMark.tsx src/components/Img.tsx
git add -u .github/workflows/deploy-pages.yml src/lib/base-path.ts
git commit -m "chore: retire the GitHub Pages mirror

It was noindexed and robots-disallowed, froze schedules and theme at CI
build time, and was the only reason public-tree cookies() calls needed a
GH_PAGES guard that fails exclusively in CI."
```

---

## Task 2: Test harness + path parser

**Files:**
- Create: `vitest.config.ts`, `src/lib/patch-path.ts`, `src/lib/patch-path.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `parsePath(path: string): PathSegment[]`, `type PathSegment`, `class InvalidPathError`

- [ ] **Step 1: Add vitest**

```bash
npm i -D vitest
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Write the failing test**

`src/lib/patch-path.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { InvalidPathError, parsePath } from './patch-path';

describe('parsePath', () => {
  it('parses a dotted key path', () => {
    expect(parsePath('site.whatsappNumber')).toEqual([
      { kind: 'key', key: 'site' },
      { kind: 'key', key: 'whatsappNumber' },
    ]);
  });

  it('parses an id-addressed collection segment', () => {
    expect(parsePath('batches[id=b_7].priceInr')).toEqual([
      { kind: 'id', key: 'batches', id: 'b_7' },
      { kind: 'key', key: 'priceInr' },
    ]);
  });

  it('parses a numeric index for order-is-data arrays', () => {
    expect(parsePath('pages.faqs.sections[2].heading')).toEqual([
      { kind: 'key', key: 'pages' },
      { kind: 'key', key: 'faqs' },
      { kind: 'index', key: 'sections', index: 2 },
      { kind: 'key', key: 'heading' },
    ]);
  });

  // The single most important test in this file: mergeWithSeed's guard is
  // read-path only, and Zod cannot undo prototype mutation.
  it.each(['pages.__proto__.x', 'batches.constructor.y', 'a.prototype.b'])(
    'rejects the reserved segment in %s',
    (path) => {
      expect(() => parsePath(path)).toThrow(InvalidPathError);
    },
  );

  it.each(['', '$', '.', 'a..b', 'a[]', 'a[id=]', 'a[-1]', 'a b'])(
    'rejects the malformed path %j',
    (path) => {
      expect(() => parsePath(path)).toThrow(InvalidPathError);
    },
  );
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm test -- patch-path`
Expected: FAIL — cannot resolve `./patch-path`.

- [ ] **Step 4: Implement**

`src/lib/patch-path.ts`:

```ts
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

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const SEGMENT = /^([A-Za-z][A-Za-z0-9_]*)(?:\[(?:id=([A-Za-z0-9._:-]+)|(\d+))\])?$/;

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
      s.kind === 'id' ? `${s.key}[id=${s.id}]` : s.kind === 'index' ? `${s.key}[${s.index}]` : s.key,
    )
    .join('.');
}
```

- [ ] **Step 5: Run and confirm green**

Run: `npm test -- patch-path`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/patch-path.ts src/lib/patch-path.test.ts
git commit -m "test: add vitest and a path parser that rejects reserved segments"
```

---

## Task 3: Collection registry and path globbing

**Files:**
- Create: `src/lib/collections.ts`, `src/lib/glob.ts`, `src/lib/glob.test.ts`

**Interfaces:**
- Consumes: `parsePath` (Task 2)
- Produces: `COLLECTIONS`, `collectionIdField(key: string): string | null`,
  `matchPath(pattern: string, path: string): boolean`

- [ ] **Step 1: Write the registry**

`src/lib/collections.ts`:

```ts
// Arrays addressed BY ID rather than by position. Everything else is an
// "order is the data" array and is written whole.
export const COLLECTIONS: Record<string, string> = {
  danceStyles: 'id',
  studios: 'id',
  batches: 'id',
  instructors: 'id',
  testimonials: 'id',
  stories: 'id',
  customPages: 'id',
  campaigns: 'id',
  'welcome.tracks': 'key',
};

export function collectionIdField(dottedKeyPath: string): string | null {
  return COLLECTIONS[dottedKeyPath] ?? null;
}
```

- [ ] **Step 2: Write the failing glob test**

`src/lib/glob.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchPath } from './glob';

describe('matchPath', () => {
  it('matches an exact path', () => {
    expect(matchPath('site.whatsappNumber', 'site.whatsappNumber')).toBe(true);
  });

  it('grants a whole subtree from a prefix', () => {
    expect(matchPath('batches', 'batches[id=b_7].priceInr')).toBe(true);
    expect(matchPath('pages', 'pages.faqs.sections[2].heading')).toBe(true);
  });

  // Regression: a grant on `stories` must not leak into a sibling whose name
  // merely starts with it.
  it('does not match a sibling key with a shared prefix', () => {
    expect(matchPath('stories', 'storiesArchive[id=x].title')).toBe(false);
    expect(matchPath('site', 'sitemapSettings.x')).toBe(false);
  });

  it('treats * as exactly one segment', () => {
    expect(matchPath('pages.*.intro', 'pages.about.intro')).toBe(true);
    expect(matchPath('pages.*.intro', 'pages.about.moments.intro')).toBe(false);
  });

  it('treats ** as any remaining segments', () => {
    expect(matchPath('pages.**', 'pages.about.moments.photos[0].alt')).toBe(true);
    expect(matchPath('**', 'anything.at.all')).toBe(true);
  });

  // Sequence B of the deny-bypass finding: a deny on theme.** must also stop a
  // write to the bare parent.
  it('matches the bare parent of a ** pattern', () => {
    expect(matchPath('theme.**', 'theme')).toBe(true);
  });

  it('ignores id and index addressing when matching', () => {
    expect(matchPath('instructors', 'instructors[id=i_3].shortBio')).toBe(true);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm test -- glob`
Expected: FAIL — cannot resolve `./glob`.

- [ ] **Step 4: Implement**

`src/lib/glob.ts`:

```ts
import { parsePath } from './patch-path';

// Matching is segment-wise over KEY names; id/index addressing is irrelevant to
// a grant ("may write batches" covers every batch). A pattern that is a proper
// prefix of the path grants the whole subtree beneath it.
function keys(path: string): string[] {
  return parsePath(path).map((s) => s.key);
}

export function matchPath(pattern: string, path: string): boolean {
  const p = pattern.split('.');
  const t = keys(path);

  let i = 0;
  for (; i < p.length; i++) {
    if (p[i] === '**') return true; // ** absorbs the rest, including nothing
    if (i >= t.length) return false;
    if (p[i] === '*') continue;
    if (p[i] !== t[i]) return false;
  }
  // Pattern consumed. Equal length = exact match; shorter = subtree grant.
  return true;
}
```

- [ ] **Step 5: Run and confirm green**

Run: `npm test -- glob`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/collections.ts src/lib/glob.ts src/lib/glob.test.ts
git commit -m "feat: collection registry and segment-wise path globbing"
```

---

## Task 4: Op types and the applier

**Files:**
- Create: `src/lib/patch.ts`, `src/lib/patch.test.ts`

**Interfaces:**
- Consumes: `parsePath`, `PathSegment` (Task 2); `collectionIdField` (Task 3)
- Produces: `type Op`, `type Json`, `class PatchError`, `applyOps<T>(doc: T, ops: Op[]): T`

- [ ] **Step 1: Write the failing test**

`src/lib/patch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyOps, PatchError, type Op } from './patch';

const base = () => ({
  site: { whatsappNumber: '918886072572', email: '' },
  batches: [
    { id: 'b_1', time: '9:30 AM', priceInr: 6000, razorpayLink: 'https://rzp.io/1' },
    { id: 'b_2', time: '6:30 PM', priceInr: 7000, razorpayLink: null },
  ],
});

describe('applyOps', () => {
  it('sets a scalar without mutating the input', () => {
    const doc = base();
    const next = applyOps(doc, [{ op: 'set', path: 'site.whatsappNumber', value: '910000000000' }]);
    expect(next.site.whatsappNumber).toBe('910000000000');
    expect(doc.site.whatsappNumber).toBe('918886072572'); // input untouched
  });

  it('sets a field on an id-addressed record', () => {
    const next = applyOps(base(), [{ op: 'set', path: 'batches[id=b_2].priceInr', value: 7500 }]);
    expect(next.batches[1].priceInr).toBe(7500);
    expect(next.batches[0].priceInr).toBe(6000);
  });

  it('clears an optional field with an explicit null', () => {
    const next = applyOps(base(), [{ op: 'set', path: 'batches[id=b_1].razorpayLink', value: null }]);
    expect(next.batches[0].razorpayLink).toBeNull();
  });

  it('replaces a whole list', () => {
    const value = [{ id: 'b_2', time: '7:00 PM', priceInr: 7000, razorpayLink: null }];
    const next = applyOps(base(), [{ op: 'setList', path: 'batches', value }]);
    expect(next.batches).toHaveLength(1);
    expect(next.batches[0].id).toBe('b_2');
  });

  it('removes a record by id', () => {
    const next = applyOps(base(), [{ op: 'remove', path: 'batches', id: 'b_1' }]);
    expect(next.batches.map((b) => b.id)).toEqual(['b_2']);
  });

  it('reorders by id list', () => {
    const next = applyOps(base(), [{ op: 'reorder', path: 'batches', ids: ['b_2', 'b_1'] }]);
    expect(next.batches.map((b) => b.id)).toEqual(['b_2', 'b_1']);
  });

  it('throws when an id does not resolve', () => {
    expect(() => applyOps(base(), [{ op: 'set', path: 'batches[id=nope].time', value: 'x' }]))
      .toThrow(PatchError);
  });

  it('refuses reserved segments', () => {
    const ops: Op[] = [{ op: 'set', path: 'site.__proto__.polluted', value: true }];
    expect(() => applyOps(base(), ops)).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- patch`
Expected: FAIL — cannot resolve `./patch`.

- [ ] **Step 3: Implement**

`src/lib/patch.ts`:

```ts
import { collectionIdField } from './collections';
import { formatPath, parsePath, type PathSegment } from './patch-path';

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type Op =
  | { op: 'set'; path: string; value: Json }
  | { op: 'setList'; path: string; value: Json[] }
  | { op: 'insert'; path: string; value: Json }
  | { op: 'remove'; path: string; id: string }
  | { op: 'reorder'; path: string; ids: string[] };

export class PatchError extends Error {
  constructor(public readonly path: string, reason: string) {
    super(`Cannot apply ${path}: ${reason}`);
    this.name = 'PatchError';
  }
}

type Obj = Record<string, unknown>;

function idOf(record: unknown, field: string): string | undefined {
  const v = (record as Obj | null)?.[field];
  return typeof v === 'string' ? v : undefined;
}

/** Key path of the segments consumed so far, e.g. `welcome.tracks`. */
function keyPath(segments: PathSegment[], upto: number): string {
  return segments.slice(0, upto + 1).map((s) => s.key).join('.');
}

// Walks to the container holding the final segment, creating nothing implicitly:
// every intermediate must already exist. Returns [container, finalSegment].
function resolve(doc: unknown, path: string): [Obj | unknown[], PathSegment] {
  const segments = parsePath(path);
  let cursor: unknown = doc;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    cursor = step(cursor, seg, path, keyPath(segments, i));
  }
  const container = cursor;
  if (container == null || typeof container !== 'object') {
    throw new PatchError(path, 'parent is not an object');
  }
  return [container as Obj, segments[segments.length - 1]];
}

function step(cursor: unknown, seg: PathSegment, path: string, kp: string): unknown {
  if (cursor == null || typeof cursor !== 'object') throw new PatchError(path, `missing ${seg.key}`);
  const holder = cursor as Obj;
  if (!Object.hasOwn(holder, seg.key)) throw new PatchError(path, `missing key ${seg.key}`);
  const value = holder[seg.key];

  if (seg.kind === 'key') return value;
  if (!Array.isArray(value)) throw new PatchError(path, `${seg.key} is not an array`);

  if (seg.kind === 'index') {
    if (seg.index >= value.length) throw new PatchError(path, `index ${seg.index} out of range`);
    return value[seg.index];
  }
  const field = collectionIdField(kp);
  if (!field) throw new PatchError(path, `${kp} is not an id-addressed collection`);
  const found = value.find((r) => idOf(r, field) === seg.id);
  if (found === undefined) throw new PatchError(path, `no record with ${field}=${seg.id}`);
  return found;
}

function arrayAt(doc: unknown, path: string): { arr: unknown[]; field: string; holder: Obj; key: string } {
  const segments = parsePath(path);
  const last = segments[segments.length - 1];
  const [container] = resolve(doc, path);
  const holder = container as Obj;
  const arr = holder[last.key];
  if (!Array.isArray(arr)) throw new PatchError(path, `${last.key} is not an array`);
  const field = collectionIdField(formatPath(segments).replace(/\[[^\]]*\]/g, ''));
  if (!field) throw new PatchError(path, `${path} is not an id-addressed collection`);
  return { arr, field, holder, key: last.key };
}

/** Applies ops to a DEEP CLONE. The input document is never mutated. */
export function applyOps<T>(doc: T, ops: Op[]): T {
  const next = structuredClone(doc) as unknown;

  for (const op of ops) {
    parsePath(op.path); // throws InvalidPathError on reserved/malformed segments

    if (op.op === 'set' || op.op === 'setList') {
      const [container, last] = resolve(next, op.path);
      if (last.kind === 'index') {
        (container as Obj)[last.key] = assignIndex(container, last, op.value, op.path);
      } else if (last.kind === 'id') {
        const { arr, field } = arrayAt(next, op.path);
        const i = arr.findIndex((r) => idOf(r, field) === last.id);
        if (i === -1) throw new PatchError(op.path, `no record with ${field}=${last.id}`);
        arr[i] = op.value;
      } else {
        (container as Obj)[last.key] = op.value;
      }
      continue;
    }

    const { arr, field } = arrayAt(next, op.path);
    if (op.op === 'insert') {
      arr.push(op.value);
    } else if (op.op === 'remove') {
      const i = arr.findIndex((r) => idOf(r, field) === op.id);
      if (i === -1) throw new PatchError(op.path, `no record with ${field}=${op.id}`);
      arr.splice(i, 1);
    } else {
      const byId = new Map(arr.map((r) => [idOf(r, field), r] as const));
      if (byId.size !== arr.length) throw new PatchError(op.path, 'duplicate ids in collection');
      const reordered = op.ids.map((id) => {
        const r = byId.get(id);
        if (r === undefined) throw new PatchError(op.path, `no record with ${field}=${id}`);
        return r;
      });
      if (reordered.length !== arr.length) throw new PatchError(op.path, 'reorder must list every id');
      arr.splice(0, arr.length, ...reordered);
    }
  }
  return next as T;
}

function assignIndex(container: unknown, last: PathSegment & { kind: 'index' }, value: Json, path: string) {
  const arr = (container as Obj)[last.key];
  if (!Array.isArray(arr)) throw new PatchError(path, `${last.key} is not an array`);
  if (last.index >= arr.length) throw new PatchError(path, `index ${last.index} out of range`);
  arr[last.index] = value;
  return arr;
}
```

- [ ] **Step 4: Run and confirm green**

Run: `npm test -- patch`
Expected: PASS (8 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/patch.ts src/lib/patch.test.ts
git commit -m "feat: op envelope types and a non-mutating patch applier"
```

---

## Task 5: Op expansion into leaf changes

This is the task that makes authorization sound. A `setList` on `instructors` becomes one change
*per affected record*, so a write at a parent path can no longer escape a record-scoped rule.

**Files:**
- Create: `src/lib/expand.ts`, `src/lib/expand.test.ts`

**Interfaces:**
- Consumes: `Op`, `applyOps` (Task 4); `collectionIdField` (Task 3)
- Produces: `type LeafChange`, `expandOps(base: unknown, ops: Op[]): LeafChange[]`

- [ ] **Step 1: Write the failing test**

`src/lib/expand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expandOps } from './expand';

const base = () => ({
  site: { whatsappNumber: '918886072572' },
  instructors: [
    { id: 'i_1', shortBio: 'A', social: { instagram: '' } },
    { id: 'i_2', shortBio: 'B', social: { instagram: '' } },
  ],
});

describe('expandOps', () => {
  it('expands a scalar set into one update', () => {
    const changes = expandOps(base(), [
      { op: 'set', path: 'site.whatsappNumber', value: '910000000000' },
    ]);
    expect(changes).toEqual([
      {
        kind: 'update',
        path: 'site.whatsappNumber',
        before: '918886072572',
        after: '910000000000',
      },
    ]);
  });

  // The parent-path escape: one whole-array write must become per-record changes.
  it('expands a whole-list write into per-record changes', () => {
    const changes = expandOps(base(), [
      {
        op: 'setList',
        path: 'instructors',
        value: [
          { id: 'i_1', shortBio: 'A', social: { instagram: '' } },        // unchanged
          { id: 'i_2', shortBio: 'HACKED', social: { instagram: 'x' } },  // changed
          { id: 'i_3', shortBio: 'new', social: { instagram: '' } },      // created
        ],
      },
    ]);
    const kinds = changes.map((c) => `${c.kind}:${'id' in c ? c.id : ''}`);
    expect(kinds).toContain('update:i_2');
    expect(kinds).toContain('create:i_3');
    expect(kinds).not.toContain('update:i_1'); // untouched records produce nothing
  });

  it('reports a deletion when a record disappears from a list write', () => {
    const changes = expandOps(base(), [
      { op: 'setList', path: 'instructors', value: [{ id: 'i_1', shortBio: 'A', social: { instagram: '' } }] },
    ]);
    expect(changes).toEqual([
      expect.objectContaining({ kind: 'delete', collection: 'instructors', id: 'i_2' }),
    ]);
  });

  it('reports a reorder without reporting field updates', () => {
    const changes = expandOps(base(), [
      { op: 'reorder', path: 'instructors', ids: ['i_2', 'i_1'] },
    ]);
    expect(changes).toEqual([
      expect.objectContaining({ kind: 'reorder', collection: 'instructors' }),
    ]);
  });

  it('carries the containing record on a field update inside a collection', () => {
    const [change] = expandOps(base(), [
      { op: 'set', path: 'instructors[id=i_2].shortBio', value: 'C' },
    ]);
    expect(change).toMatchObject({
      kind: 'update',
      collection: 'instructors',
      id: 'i_2',
      path: 'instructors[id=i_2].shortBio',
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- expand`
Expected: FAIL — cannot resolve `./expand`.

- [ ] **Step 3: Implement**

`src/lib/expand.ts`:

```ts
import { collectionIdField } from './collections';
import { applyOps, type Json, type Op } from './patch';
import { parsePath } from './patch-path';

export type LeafChange =
  | { kind: 'update'; path: string; collection?: string; id?: string; before: Json; after: Json }
  | { kind: 'create'; path: string; collection: string; id: string; after: Json }
  | { kind: 'delete'; path: string; collection: string; id: string; before: Json }
  | { kind: 'reorder'; path: string; collection: string; before: string[]; after: string[] };

type Obj = Record<string, unknown>;

function read(doc: unknown, path: string): unknown {
  const segments = parsePath(path);
  let cursor: unknown = doc;
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    const value = (cursor as Obj)[seg.key];
    if (seg.kind === 'key') cursor = value;
    else if (!Array.isArray(value)) return undefined;
    else if (seg.kind === 'index') cursor = value[seg.index];
    else {
      const field = collectionIdField(seg.key) ?? 'id';
      cursor = value.find((r) => (r as Obj)?.[field] === seg.id);
    }
  }
  return cursor;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function collectionOf(path: string): string | null {
  const keyOnly = parsePath(path).map((s) => s.key).join('.');
  return collectionIdField(keyOnly) ? keyOnly : null;
}

export function expandOps(base: unknown, ops: Op[]): LeafChange[] {
  const changes: LeafChange[] = [];

  for (const op of ops) {
    if (op.op === 'setList' || op.op === 'insert' || op.op === 'remove' || op.op === 'reorder') {
      const collection = collectionOf(op.path);
      if (!collection) throw new Error(`${op.path} is not an id-addressed collection`);
      const field = collectionIdField(collection)!;
      const beforeArr = (read(base, op.path) as Obj[]) ?? [];
      const afterArr = (applyOps(base, [op]) as Obj)[op.path.split('.').pop()!] as Obj[];
      const nextArr = (read(applyOps(base, [op]), op.path) as Obj[]) ?? afterArr ?? [];

      const beforeById = new Map(beforeArr.map((r) => [String(r[field]), r] as const));
      const afterById = new Map(nextArr.map((r) => [String(r[field]), r] as const));

      for (const [id, after] of afterById) {
        const before = beforeById.get(id);
        if (before === undefined) {
          changes.push({ kind: 'create', path: `${collection}[id=${id}]`, collection, id, after: after as Json });
        } else if (!sameJson(before, after)) {
          changes.push({
            kind: 'update', path: `${collection}[id=${id}]`, collection, id,
            before: before as Json, after: after as Json,
          });
        }
      }
      for (const [id, before] of beforeById) {
        if (!afterById.has(id)) {
          changes.push({ kind: 'delete', path: `${collection}[id=${id}]`, collection, id, before: before as Json });
        }
      }
      const beforeIds = [...beforeById.keys()];
      const afterIds = [...afterById.keys()];
      const commonBefore = beforeIds.filter((id) => afterById.has(id));
      const commonAfter = afterIds.filter((id) => beforeById.has(id));
      if (!sameJson(commonBefore, commonAfter)) {
        changes.push({ kind: 'reorder', path: collection, collection, before: beforeIds, after: afterIds });
      }
      continue;
    }

    // set / setList on a non-collection path
    const before = read(base, op.path) as Json;
    const after = op.value as Json;
    if (sameJson(before, after)) continue;

    const segments = parsePath(op.path);
    const recordIdx = segments.findIndex((s) => s.kind === 'id');
    if (recordIdx === -1) {
      changes.push({ kind: 'update', path: op.path, before, after });
    } else {
      const seg = segments[recordIdx] as { kind: 'id'; key: string; id: string };
      const collection = segments.slice(0, recordIdx + 1).map((s) => s.key).join('.');
      changes.push({ kind: 'update', path: op.path, collection, id: seg.id, before, after });
    }
  }
  return changes;
}
```

- [ ] **Step 4: Run and confirm green**

Run: `npm test -- expand`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/expand.ts src/lib/expand.test.ts
git commit -m "feat: expand ops into per-record leaf changes

A write at a parent path becomes the child changes it implies, so a
whole-array write can no longer escape a record-scoped rule."
```

---

## Task 6: Roles and the authorizer

**Files:**
- Create: `src/lib/roles.ts`, `src/lib/authz.ts`, `src/lib/authz.test.ts`

**Interfaces:**
- Consumes: `LeafChange` (Task 5); `matchPath` (Task 3)
- Produces: `type Subject`, `type Capability`, `authorize(subject, changes): AuthzResult`,
  `hasCapability(subject, cap): boolean`, `ROLES`

- [ ] **Step 1: Write the roles constant**

`src/lib/roles.ts`:

```ts
export type Capability =
  | 'users.manage' | 'versions.restore' | 'media.delete'
  | 'theme.write' | 'campaigns.publish' | 'drafts.approve';

export interface Condition {
  /** Field on the record being changed. */
  field: string;
  op: 'eqSubjectId' | 'eqSubjectAttr' | 'inSubjectAttr';
  /** Subject attribute name, for the two attr operators. */
  attr?: 'instructorId' | 'branchSlugs' | 'styleSlugs';
}

export interface Rule {
  effect: 'allow' | 'deny';
  paths: string[];
  when?: Condition[];
}

export interface Role {
  id: string;
  name: string;
  rules: Rule[];
  capabilities: Capability[];
  /** When true, the role's writable paths come from the user's attrs.sections. */
  sectionScoped?: boolean;
  /** Saves are stored as drafts rather than published. */
  requiresApproval?: boolean;
}

// Section keys are what the Users screen exposes — never raw globs.
export const SECTION_PATHS: Record<string, string[]> = {
  site: ['site'],
  hero: ['hero'],
  batches: ['batches'],
  styles: ['danceStyles'],
  studios: ['studios'],
  instructors: ['instructors'],
  testimonials: ['testimonials'],
  stories: ['stories'],
  pages: ['pages'],
  customPages: ['customPages'],
  campaigns: ['campaigns'],
};

// Ids are immutable once created: denied to everyone, including Owner.
const DENY_IDS: Rule = { effect: 'deny', paths: ['*.id', '*.*.id'] };

export const ROLES: Role[] = [
  {
    id: 'owner', name: 'Owner',
    rules: [{ effect: 'allow', paths: ['**'] }, DENY_IDS],
    capabilities: ['users.manage', 'versions.restore', 'media.delete', 'theme.write', 'campaigns.publish', 'drafts.approve'],
  },
  {
    id: 'manager', name: 'Manager',
    rules: [
      { effect: 'allow', paths: ['**'] },
      { effect: 'deny', paths: ['theme', 'theme.**'] },
      DENY_IDS,
    ],
    capabilities: ['versions.restore', 'media.delete', 'campaigns.publish', 'drafts.approve'],
  },
  { id: 'editor', name: 'Editor', rules: [DENY_IDS], capabilities: [], sectionScoped: true, requiresApproval: true },
  {
    id: 'author', name: 'Author',
    rules: [
      { effect: 'allow', paths: ['stories'], when: [{ field: 'authorId', op: 'eqSubjectId' }] },
      DENY_IDS,
    ],
    capabilities: [],
  },
  {
    id: 'instructor', name: 'Instructor',
    rules: [
      { effect: 'allow', paths: ['instructors'], when: [{ field: 'id', op: 'eqSubjectAttr', attr: 'instructorId' }] },
      DENY_IDS,
    ],
    capabilities: [],
  },
  { id: 'viewer', name: 'Viewer', rules: [], capabilities: [] },
];

export function roleById(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id);
}
```

- [ ] **Step 2: Write the failing authorizer test**

`src/lib/authz.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { authorize, type Subject } from './authz';
import { expandOps } from './expand';

const doc = () => ({
  site: { whatsappNumber: '918886072572' },
  theme: { preset: 'furor-classic' },
  batches: [
    { id: 'b_1', branchSlug: 'jubilee-hills', razorpayLink: 'https://rzp.io/1' },
    { id: 'b_5', branchSlug: 'gachibowli', razorpayLink: 'https://rzp.io/5' },
  ],
  instructors: [{ id: 'i_1', shortBio: 'A' }, { id: 'i_2', shortBio: 'B' }],
  stories: [{ id: 's_1', authorId: 'u_sam', title: 'Mine' }, { id: 's_2', authorId: 'u_neha', title: 'Theirs' }],
});

const sub = (over: Partial<Subject> = {}): Subject => ({
  id: 'u_sam', email: 'sam@example.com', roleIds: ['viewer'], attrs: {}, ...over,
});

describe('authorize', () => {
  it('denies by default', () => {
    const changes = expandOps(doc(), [{ op: 'set', path: 'site.whatsappNumber', value: 'x' }]);
    expect(authorize(sub(), changes).ok).toBe(false);
  });

  it('allows an owner everything except ids', () => {
    const owner = sub({ roleIds: ['owner'] });
    expect(authorize(owner, expandOps(doc(), [{ op: 'set', path: 'site.whatsappNumber', value: '9100' }])).ok).toBe(true);
    expect(authorize(owner, expandOps(doc(), [{ op: 'set', path: 'batches[id=b_1].id', value: 'b_9' }])).ok).toBe(false);
  });

  // Deny must beat allow even when the write targets the bare parent.
  it('denies a manager writing the theme parent', () => {
    const manager = sub({ roleIds: ['manager'] });
    const changes = expandOps(doc(), [{ op: 'set', path: 'theme', value: { preset: 'evil' } }]);
    expect(authorize(manager, changes).ok).toBe(false);
  });

  it('scopes an editor to their assigned sections', () => {
    const editor = sub({ roleIds: ['editor'], attrs: { sections: ['batches'] } });
    expect(authorize(editor, expandOps(doc(), [{ op: 'set', path: 'batches[id=b_1].razorpayLink', value: null }])).ok).toBe(true);
    expect(authorize(editor, expandOps(doc(), [{ op: 'set', path: 'site.whatsappNumber', value: 'x' }])).ok).toBe(false);
  });

  it('scopes an instructor to their own record', () => {
    const priya = sub({ roleIds: ['instructor'], attrs: { instructorId: 'i_2' } });
    expect(authorize(priya, expandOps(doc(), [{ op: 'set', path: 'instructors[id=i_2].shortBio', value: 'mine' }])).ok).toBe(true);
    expect(authorize(priya, expandOps(doc(), [{ op: 'set', path: 'instructors[id=i_1].shortBio', value: 'theirs' }])).ok).toBe(false);
  });

  it('scopes an author to stories they own', () => {
    const sam = sub({ roleIds: ['author'] });
    expect(authorize(sam, expandOps(doc(), [{ op: 'set', path: 'stories[id=s_1].title', value: 'edit' }])).ok).toBe(true);
    expect(authorize(sam, expandOps(doc(), [{ op: 'set', path: 'stories[id=s_2].title', value: 'edit' }])).ok).toBe(false);
  });

  // THE regression test for the self-authorizing patch set. Ravi may only touch
  // his own branch; he must not be able to hop a record into it and then edit it.
  it('refuses a change that moves a record into the subject scope', () => {
    const ravi = sub({ roleIds: ['editor'], attrs: { sections: ['batches'], branchSlugs: ['jubilee-hills'] } });
    const changes = expandOps(doc(), [
      { op: 'set', path: 'batches[id=b_5].branchSlug', value: 'jubilee-hills' },
      { op: 'set', path: 'batches[id=b_5].razorpayLink', value: 'https://pay.attacker.example' },
    ]);
    // No options argument: branch scoping must engage automatically from the
    // subject's attrs, because the production pipeline calls authorize() with
    // two arguments and would otherwise never apply it.
    const result = authorize(ravi, changes);
    expect(result.ok).toBe(false);
    expect(result.denied[0].path).toContain('b_5');
  });

  it('leaves a branch-scoped subject free on records with no branch', () => {
    const ravi = sub({ roleIds: ['editor'], attrs: { sections: ['stories'], branchSlugs: ['jubilee-hills'] } });
    const changes = expandOps(doc(), [{ op: 'set', path: 'stories[id=s_1].title', value: 'ok' }]);
    expect(authorize(ravi, changes).ok).toBe(true);
  });

  it('requires an explicit allow on the new value for a create', () => {
    const priya = sub({ roleIds: ['instructor'], attrs: { instructorId: 'i_2' } });
    const changes = expandOps(doc(), [
      { op: 'insert', path: 'instructors', value: { id: 'i_9', shortBio: 'planted' } },
    ]);
    expect(authorize(priya, changes).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm test -- authz`
Expected: FAIL — cannot resolve `./authz`.

- [ ] **Step 4: Implement**

`src/lib/authz.ts`:

```ts
import { matchPath } from './glob';
import type { LeafChange } from './expand';
import { roleById, SECTION_PATHS, type Capability, type Condition, type Rule } from './roles';

export interface Subject {
  id: string;
  email: string;
  roleIds: string[];
  attrs: {
    instructorId?: string;
    branchSlugs?: string[];
    styleSlugs?: string[];
    sections?: string[];
  };
  /** The env break-glass owner. Bypasses role resolution entirely. */
  breakGlass?: boolean;
}

export interface AuthzResult {
  ok: boolean;
  denied: { path: string; reason: string }[];
  /** True when the subject may publish every change; false routes the save to a draft. */
  mayPublish: boolean;
}

// Branch scoping is NOT an option the caller passes — it engages automatically
// whenever the subject carries branchSlugs. An opt-in flag would be dead code:
// the pipeline calls authorize(subject, changes) and would never set it.
type Record_Branch = { branchSlug?: unknown };

type Record_ = Record<string, unknown> | null | undefined;

function conditionHolds(cond: Condition, subject: Subject, record: Record_): boolean {
  if (record == null || typeof record !== 'object') return false;
  const value = record[cond.field];
  if (cond.op === 'eqSubjectId') return value === subject.id;
  if (cond.op === 'eqSubjectAttr') return value === subject.attrs[cond.attr!];
  const list = subject.attrs[cond.attr!];
  return Array.isArray(list) && typeof value === 'string' && list.includes(value);
}

function rulesFor(subject: Subject): { rules: Rule[]; requiresApproval: boolean } {
  const rules: Rule[] = [];
  let requiresApproval = false;
  for (const id of subject.roleIds) {
    const role = roleById(id);
    if (!role) continue;
    if (role.requiresApproval) requiresApproval = true;
    rules.push(...role.rules);
    if (role.sectionScoped) {
      for (const section of subject.attrs.sections ?? []) {
        for (const path of SECTION_PATHS[section] ?? []) rules.push({ effect: 'allow', paths: [path] });
      }
    }
  }
  return { rules, requiresApproval };
}

function allows(rules: Rule[], subject: Subject, path: string, record: Record_): boolean {
  let allowed = false;
  for (const rule of rules) {
    if (!rule.paths.some((p) => matchPath(p, path))) continue;
    const conditionsHold = (rule.when ?? []).every((c) => conditionHolds(c, subject, record));
    if (rule.effect === 'deny') {
      // A deny with no conditions is unconditional; with conditions it applies
      // only when they hold.
      if (!rule.when || conditionsHold) return false;
      continue;
    }
    if (conditionsHold) allowed = true;
  }
  // A subject carrying branchSlugs is confined to those branches on any record
  // that HAS a branchSlug. Records without one are unaffected.
  const branches = subject.attrs.branchSlugs;
  if (allowed && branches?.length && record && typeof record === 'object' && 'branchSlug' in record) {
    const slug = (record as Record_Branch).branchSlug;
    return typeof slug === 'string' && branches.includes(slug);
  }
  return allowed;
}

export function authorize(subject: Subject, changes: LeafChange[]): AuthzResult {
  if (subject.breakGlass) return { ok: true, denied: [], mayPublish: true };

  const { rules, requiresApproval } = rulesFor(subject);
  const denied: { path: string; reason: string }[] = [];

  for (const change of changes) {
    const path = change.path;
    let ok: boolean;

    if (change.kind === 'create') {
      ok = allows(rules, subject, path, change.after as Record_);
    } else if (change.kind === 'delete') {
      ok = allows(rules, subject, path, change.before as Record_);
    } else if (change.kind === 'reorder') {
      ok = allows(rules, subject, change.collection, null);
    } else {
      // An update must be permitted against BOTH states, so a patch cannot move
      // a record into the subject's scope and then edit it in the same request.
      const beforeRecord = (change.collection ? recordOf(change, 'before') : null) as Record_;
      const afterRecord = (change.collection ? recordOf(change, 'after') : null) as Record_;
      ok = allows(rules, subject, path, beforeRecord) && allows(rules, subject, path, afterRecord);
    }
    if (!ok) denied.push({ path, reason: 'not permitted for this account' });
  }

  return { ok: denied.length === 0, denied, mayPublish: denied.length === 0 && !requiresApproval };
}

// For a field-level update inside a collection, expandOps records before/after
// of the FIELD. The record state is reconstructed by the caller via
// expandRecords(); when unavailable we fall back to the field value, which is
// only ever used by conditions naming that same field.
function recordOf(change: Extract<LeafChange, { kind: 'update' }>, side: 'before' | 'after'): unknown {
  return change.record?.[side] ?? { [lastKey(change.path)]: change[side], id: change.id };
}

function lastKey(path: string): string {
  const seg = path.split('.').pop() ?? '';
  return seg.replace(/\[[^\]]*\]/g, '');
}

export function hasCapability(subject: Subject, cap: Capability): boolean {
  if (subject.breakGlass) return true;
  return subject.roleIds.some((id) => roleById(id)?.capabilities.includes(cap));
}
```

- [ ] **Step 5: Add the record state to update changes**

The branch-hop test needs the *record*, not just the field. In `src/lib/expand.ts`, extend the
`update` variant with an optional `record` and populate it for changes inside a collection:

```ts
| { kind: 'update'; path: string; collection?: string; id?: string;
    before: Json; after: Json; record?: { before: Json; after: Json } }
```

In the non-collection branch of `expandOps`, when `recordIdx !== -1`, also read the whole record
before and after:

```ts
const recordPath = segments.slice(0, recordIdx + 1)
  .map((s) => (s.kind === 'id' ? `${s.key}[id=${s.id}]` : s.key)).join('.');
const recordBefore = read(base, recordPath) as Json;
const recordAfter = read(applyOps(base, ops), recordPath) as Json;
changes.push({ kind: 'update', path: op.path, collection, id: seg.id, before, after,
  record: { before: recordBefore, after: recordAfter } });
```

Note `applyOps(base, ops)` — **all** ops in the envelope, so the "after" record reflects the
branch-hop the attacker performed in an earlier op.

- [ ] **Step 6: Run and confirm green**

Run: `npm test`
Expected: PASS, including the branch-hop and create cases.

- [ ] **Step 7: Commit**

```bash
git add src/lib/roles.ts src/lib/authz.ts src/lib/authz.test.ts src/lib/expand.ts
git commit -m "feat: built-in roles and a default-deny authorizer

Updates are authorized against the record BEFORE and AFTER the whole
envelope applies, so a patch cannot move a record into the subject's
scope and then edit it in the same request."
```

---

## Task 7: Storage — etag, revision metadata and compare-and-swap

**Files:**
- Modify: `src/lib/storage.ts:16-37` (interfaces), add `readDocWithVersion` / `writeDocIfMatch`
- Create: `src/lib/storage-version.test.ts` (dev-backend behaviour only)

**Interfaces:**
- Produces: `type DocVersion = { lineage: string; rev: number; etag: string }`,
  `readDocWithVersion(key): Promise<{ text: string; version: DocVersion } | null>`,
  `writeDocIfMatch(key, text, version): Promise<DocVersion | null>`

- [ ] **Step 1: Widen the R2 interface**

In `src/lib/storage.ts`, extend the hand-rolled types (no dependency change — they exist
precisely to avoid `@cloudflare/workers-types`):

```ts
interface R2ObjectBody {
  key: string;
  uploaded: string | Date;
  etag: string;                                   // unquoted — use this in onlyIf
  customMetadata?: Record<string, string>;
  httpMetadata?: { contentType?: string };
  body: ReadableStream;
  text(): Promise<string>;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array,
    opts?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
      onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
    },
  ): Promise<{ etag: string } | null>;            // null when a precondition fails
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}
```

- [ ] **Step 2: Add the versioned read/write pair**

```ts
export interface DocVersion { lineage: string; rev: number; etag: string }

/** Uncached, single round trip. NEVER route the write path through
 *  getContent()/readContentRaw() — a 30s-stale read makes the version check PASS. */
export async function readDocWithVersion(
  key: string,
): Promise<{ text: string; version: DocVersion } | null> {
  const { bucket } = await resolveBucket();
  if (bucket) {
    const obj = await bucket.get(key);
    if (obj == null) return null;
    return {
      text: await obj.text(),
      version: {
        lineage: obj.customMetadata?.lineage ?? 'legacy',
        rev: Number(obj.customMetadata?.rev ?? 0),
        etag: obj.etag,
      },
    };
  }
  const text = await readText(key);
  if (text == null) return null;
  return { text, version: await readSidecar(key, text) };
}

/** Returns the new version, or null when someone else wrote first. */
export async function writeDocIfMatch(
  key: string,
  text: string,
  expected: DocVersion,
): Promise<DocVersion | null> {
  const next = { lineage: expected.lineage, rev: expected.rev + 1 };
  const { bucket, inWorkerRuntime } = await resolveBucket();
  if (bucket) {
    const res = await bucket.put(key, text, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { lineage: next.lineage, rev: String(next.rev) },
      onlyIf: { etagMatches: expected.etag },
    });
    if (res === null) return null;              // precondition failed — it does NOT throw
    return { ...next, etag: res.etag };
  }
  if (inWorkerRuntime) throw new StorageUnavailableError();
  return writeWithSidecar(key, text, expected, next);
}
```

The dev sidecar lives at `data/.meta/<key>.json` holding `{ lineage, rev, hash }`, where `hash`
is a SHA-256 of the bytes; `writeWithSidecar` re-reads and compares the hash before writing and
returns `null` on mismatch. Single-process dev accepts the residual race.

- [ ] **Step 3: Write the failing test (dev backend)**

`src/lib/storage-version.test.ts` exercises the sidecar decision only — the R2 branch needs a
Worker:

```ts
import { describe, expect, it } from 'vitest';
import { hashOf, mayWrite } from './storage-version-core';

describe('mayWrite', () => {
  it('accepts a write whose expected hash matches the current bytes', () => {
    expect(mayWrite('current', { hash: hashOf('current') })).toBe(true);
  });

  it('rejects a write based on stale bytes', () => {
    expect(mayWrite('current', { hash: hashOf('older') })).toBe(false);
  });

  it('accepts the first write when there is no sidecar yet', () => {
    expect(mayWrite('current', null)).toBe(true);
  });

  it('hashes deterministically and distinguishes content', () => {
    expect(hashOf('a')).toBe(hashOf('a'));
    expect(hashOf('a')).not.toBe(hashOf('b'));
  });
});
```

Extract the pure decision into `src/lib/storage-version-core.ts` so it is testable without fs.
Use `node:crypto` — it is available in Node and in workerd under `nodejs_compat`, which this
project already enables:

```ts
import { createHash } from 'node:crypto';

export function hashOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

/** Dev-backend compare-and-swap: the write proceeds only when the bytes on disk
 *  still hash to what the caller read. `null` = no sidecar yet (first write). */
export function mayWrite(currentText: string, expected: { hash: string } | null): boolean {
  return expected === null || hashOf(currentText) === expected.hash;
}
```

- [ ] **Step 4: Run and confirm green**

Run: `npm test -- storage-version && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage-version-core.ts src/lib/storage-version.test.ts
git commit -m "feat: versioned document reads and compare-and-swap writes"
```

---

## Task 8: Schema invariants and seed safety

**Files:**
- Modify: `src/lib/content-schema.ts:524-563`, `src/lib/content.ts:13-33`
- Create: `src/lib/content-merge.test.ts`

- [ ] **Step 1: Write the failing merge test**

`src/lib/content-merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeWithSeed } from './content';

describe('mergeWithSeed', () => {
  it('fills a missing key from the seed', () => {
    expect(mergeWithSeed({ site: {} }, { site: {}, hero: { headline: 'x' } })).toMatchObject({
      hero: { headline: 'x' },
    });
  });

  // Restoring a pre-migration snapshot must NOT inject the seed's promos or
  // theme — sync-seed bakes a developer's live local content into the seed.
  it('never seeds campaigns or theme', () => {
    const merged = mergeWithSeed({ site: {} }, { site: {}, campaigns: [{ id: 'c1' }], theme: { preset: 'x' } });
    expect((merged as Record<string, unknown>).campaigns).toBeUndefined();
    expect((merged as Record<string, unknown>).theme).toBeUndefined();
  });

  it('still refuses prototype keys', () => {
    const merged = mergeWithSeed(JSON.parse('{"__proto__":{"polluted":true}}'), {}) as Record<string, unknown>;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(merged.polluted).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and confirm the campaigns case fails**

Run: `npm test -- content-merge`
Expected: FAIL on "never seeds campaigns or theme".

- [ ] **Step 3: Implement `NEVER_SEED`**

In `src/lib/content.ts`, above `mergeWithSeed`:

```ts
// Keys that must come ONLY from the saved document. `sync-seed` copies a
// developer's live content into the seed, so seeding these would publish
// someone's local promos/theme when an old snapshot is restored.
const NEVER_SEED = new Set(['campaigns', 'theme']);
```

and inside the object branch, seed only the keys not in that set:

```ts
const out: Record<string, unknown> = {};
for (const [k, v] of Object.entries(seed as Record<string, unknown>)) {
  if (!NEVER_SEED.has(k)) out[k] = v;
}
```

- [ ] **Step 4: Add the uniqueness invariant**

In `src/lib/content-schema.ts`, after the `SiteContentSchema` object definition:

```ts
const ID_COLLECTIONS = ['danceStyles', 'studios', 'batches', 'instructors', 'testimonials', 'stories', 'customPages'] as const;
const SLUG_COLLECTIONS = ['danceStyles', 'studios', 'stories', 'customPages'] as const;

export const SiteContentSchema = BaseSiteContentSchema.superRefine((doc, ctx) => {
  for (const key of ID_COLLECTIONS) dupCheck(doc[key], 'id', key, ctx);
  for (const key of SLUG_COLLECTIONS) dupCheck(doc[key], 'slug', key, ctx);
});

function dupCheck(rows: { [k: string]: unknown }[] | undefined, field: string, key: string, ctx: z.RefinementCtx) {
  const seen = new Set<unknown>();
  rows?.forEach((row, i) => {
    const v = row?.[field];
    if (v == null) return;
    if (seen.has(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key, i, field], message: `Duplicate ${field} "${String(v)}"` });
    }
    seen.add(v);
  });
}
```

Rename the existing object literal to `BaseSiteContentSchema`. **Do not** add any date refine.

- [ ] **Step 5: Add story provenance**

In `StorySchema`, add `authorId: z.string().default('')` — the Author role's ownership condition
reads it, and the default keeps every stored document valid.

- [ ] **Step 6: Verify**

```bash
npm test && npm run typecheck && npm run build
```

Expected: all green. The build proves the existing seed still validates against the new
`superRefine` — if it fails, the seed has duplicate ids and that is a real bug to fix first.

- [ ] **Step 7: Commit**

```bash
git add src/lib/content.ts src/lib/content-schema.ts src/lib/content-merge.test.ts
git commit -m "feat: id/slug uniqueness invariant, story authorId, and NEVER_SEED keys"
```

---

## Task 9: The save pipeline

**Files:**
- Create: `src/lib/save-pipeline.ts`, `src/lib/save-pipeline.test.ts`

**Interfaces:**
- Consumes: `applyOps` (4), `expandOps` (5), `authorize` (6), `SiteContentSchema` (8)
- Produces: `applyAndAuthorize(doc, subject, ops): PipelineResult`

- [ ] **Step 1: Write the failing test**

`src/lib/save-pipeline.test.ts` — the important cases:

```ts
import { describe, expect, it } from 'vitest';
import { applyAndAuthorize } from './save-pipeline';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';

const doc = () => SiteContentSchema.parse(seed);
const owner = { id: 'u_1', email: 'o@x.com', roleIds: ['owner'], attrs: {} };

describe('applyAndAuthorize', () => {
  it('accepts an authorized, valid change', () => {
    const r = applyAndAuthorize(doc(), owner, [{ op: 'set', path: 'site.tagline', value: 'New tagline' }]);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.next.site.tagline).toBe('New tagline');
  });

  it('rejects an unauthorized change with the offending paths', () => {
    const viewer = { ...owner, roleIds: ['viewer'] };
    const r = applyAndAuthorize(doc(), viewer, [{ op: 'set', path: 'site.tagline', value: 'x' }]);
    expect(r.status).toBe('denied');
  });

  // Pre-existing invalid records must not block unrelated edits.
  it('reports only issues the patch introduces', () => {
    const broken = doc();
    broken.testimonials[0].publishedAt = '2099-01-01'; // invalid before the patch
    const r = applyAndAuthorize(broken, owner, [{ op: 'set', path: 'site.tagline', value: 'fine' }]);
    expect(r.status).toBe('ok');
  });

  it('rejects a change that introduces its own validation failure', () => {
    const r = applyAndAuthorize(doc(), owner, [{ op: 'set', path: 'site.whatsappNumber', value: 'not-digits' }]);
    expect(r.status).toBe('invalid');
  });

  it('blocks a dangling slug reference', () => {
    const r = applyAndAuthorize(doc(), owner, [
      { op: 'set', path: `batches[id=${doc().batches[0].id}].branchSlug`, value: 'no-such-studio' },
    ]);
    expect(r.status).toBe('invalid');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- save-pipeline`
Expected: FAIL — cannot resolve `./save-pipeline`.

- [ ] **Step 3: Implement**

`src/lib/save-pipeline.ts`:

```ts
import { SiteContentSchema, type SiteContent } from './content-schema';
import { authorize, type Subject } from './authz';
import { expandOps, type LeafChange } from './expand';
import { applyOps, type Op } from './patch';

export type PipelineResult =
  | { status: 'ok'; next: SiteContent; changes: LeafChange[]; mayPublish: boolean }
  | { status: 'denied'; denied: { path: string; reason: string }[] }
  | { status: 'invalid'; issues: { path: (string | number)[]; message: string }[] };

export function applyAndAuthorize(doc: SiteContent, subject: Subject, ops: Op[]): PipelineResult {
  // 1. Expand FIRST — authorization must see per-record changes, never the
  //    literal patch path.
  const changes = expandOps(doc, ops);

  // 2. Authorize before anything else observable happens.
  const decision = authorize(subject, changes);
  if (!decision.ok) return { status: 'denied', denied: decision.denied };

  // 3. Apply to a clone and validate the WHOLE document. Never validate a fragment.
  const next = applyOps(doc, ops);
  const parsed = SiteContentSchema.safeParse(next);

  if (!parsed.success) {
    // Only reject issues this patch introduced; a pre-existing invalid record
    // must not make every screen unsavable for everyone.
    const before = SiteContentSchema.safeParse(doc);
    const preExisting = new Set(
      before.success ? [] : before.error.issues.map((i) => `${i.path.join('.')}::${i.message}`),
    );
    const introduced = parsed.error.issues.filter(
      (i) => !preExisting.has(`${i.path.join('.')}::${i.message}`),
    );
    if (introduced.length > 0) {
      return { status: 'invalid', issues: introduced.map((i) => ({ path: i.path, message: i.message })) };
    }
  }

  const merged = (parsed.success ? parsed.data : (next as SiteContent));

  // 4. Referential integrity — slug references are bare strings in the schema.
  const dangling = danglingReferences(merged);
  if (dangling.length > 0) {
    return { status: 'invalid', issues: dangling };
  }

  return { status: 'ok', next: merged, changes, mayPublish: decision.mayPublish };
}

function danglingReferences(c: SiteContent) {
  const styles = new Set(c.danceStyles.map((s) => s.slug));
  const studios = new Set(c.studios.map((s) => s.slug));
  const issues: { path: (string | number)[]; message: string }[] = [];

  c.batches.forEach((b, i) => {
    b.styleSlugs.forEach((s, j) => {
      if (!styles.has(s)) issues.push({ path: ['batches', i, 'styleSlugs', j], message: `Unknown dance style "${s}"` });
    });
    if (!studios.has(b.branchSlug)) issues.push({ path: ['batches', i, 'branchSlug'], message: `Unknown studio "${b.branchSlug}"` });
  });
  c.instructors.forEach((ins, i) => {
    ins.branchSlugs.forEach((s, j) => {
      if (!studios.has(s)) issues.push({ path: ['instructors', i, 'branchSlugs', j], message: `Unknown studio "${s}"` });
    });
  });
  return issues;
}
```

- [ ] **Step 4: Run and confirm green**

Run: `npm test -- save-pipeline`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/save-pipeline.ts src/lib/save-pipeline.test.ts
git commit -m "feat: save pipeline — expand, authorize, validate, integrity-check"
```

---

## Task 10: Wire the pipeline into the save route

**Files:**
- Modify: `src/app/api/admin/save/route.ts`, `src/lib/content-write.ts`, `src/lib/admin-save.ts`
- Create: `src/lib/subject.ts`

**Interfaces:**
- Produces: `resolveSubject(): Promise<Subject | null>` — reads the existing JWT and maps
  `role: 'owner' | 'editor'` onto the built-in roles. **Plan 2 replaces the body of this
  function with a `users.json` lookup; the signature does not change.**

- [ ] **Step 1: Add the subject seam**

`src/lib/subject.ts`:

```ts
import 'server-only';
import { getSession } from './auth';
import type { Subject } from './authz';

// Plan 1 derives the subject from the existing single-role JWT so the pipeline
// is exercisable today. Plan 2 swaps the body for a users.json lookup with a
// short-TTL cache; every caller keeps working.
export async function resolveSubject(): Promise<Subject | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === 'owner') {
    return { id: session.email, email: session.email, roleIds: ['owner'], attrs: {}, breakGlass: true };
  }
  return {
    id: session.email,
    email: session.email,
    roleIds: ['editor'],
    attrs: { sections: Object.keys(SECTION_PATHS) },
  };
}
```

- [ ] **Step 2: Replace the save route body**

```ts
export async function POST(req: Request) {
  const subject = await resolveSubject();
  if (!subject) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  if (!contentLengthWithin(req, MAX_BODY_BYTES)) return NextResponse.json({ error: 'Body too large' }, { status: 413 });

  const parsed = SaveEnvelopeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid save envelope' }, { status: 400 });
  const { baseVersion, ops } = parsed.data;

  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await readDocWithVersion(CONTENT_KEY);          // uncached — never getContent()
    if (!current) return NextResponse.json({ error: 'No content document' }, { status: 503 });
    const doc = SiteContentSchema.parse(mergeWithSeed(JSON.parse(current.text), seedContent));

    const result = applyAndAuthorize(doc, subject, ops);
    if (result.status === 'denied') {
      await audit({ actor: subject.email, action: 'authz_denied', detail: result.denied.map((d) => d.path).join(', ') });
      return NextResponse.json({ error: 'Not permitted', denied: result.denied }, { status: 403 });
    }
    if (result.status === 'invalid') {
      return NextResponse.json({ error: 'Validation failed', issues: result.issues }, { status: 400 });
    }

    // Authorization ran BEFORE this check, so a subject with no write grants
    // cannot poll 409s as a change feed.
    const token = `${current.version.lineage}:${current.version.rev}`;
    if (baseVersion !== token) {
      return NextResponse.json(
        { error: 'Someone else saved while you were editing. Reload to get their changes.', currentVersion: token },
        { status: 409 },
      );
    }

    const text = JSON.stringify(result.next, null, 2);
    const written = await writeDocIfMatch(CONTENT_KEY, text, current.version);
    if (written === null) continue;                                  // CAS lost — retry once

    await snapshotAfterWrite(current.text, written, subject.email);  // skips when bytes unchanged
    bustContentCache();
    await audit({ actor: subject.email, action: 'save_content', detail: `rev ${written.rev} · ${result.changes.map((c) => c.path).join(', ')}` });
    revalidatePublicPages(result.next);
    return NextResponse.json({ ok: true, version: `${written.lineage}:${written.rev}` });
  }
  return NextResponse.json({ error: 'Conflicting writes — please retry' }, { status: 409 });
}
```

- [ ] **Step 3: Update the client helper**

`src/lib/admin-save.ts` sends `{ baseVersion, ops, mode }` and distinguishes the outcomes: 403
surfaces `denied[]`, 409 surfaces the reload message, 400 keeps the structured `issues[]` array
(rather than flattening to one prose string) so Plan 3's `useEditor` can map them to fields.

- [ ] **Step 4: Make snapshots safe**

In `src/lib/content-write.ts`, replace `snapshotCurrent` with `snapshotAfterWrite(previousText,
version, actor)`: it runs **after** a successful write, returns immediately when the new bytes
equal the previous bytes, keys the object
`versions/${String(rev).padStart(6, '0')}-${iso}-${safeActor}-${rand}.json`, and prunes by
keeping the newest 10 plus one per day for 30 days.

- [ ] **Step 5: Verify end to end in dev**

```bash
npm run dev
```

Then: log in at `/admin`, edit the hero headline, save. Expected: saves, public page reflects it.
Open the same editor in two tabs, save in tab A, then save in tab B. Expected: tab B gets the
409 "Someone else saved…" message rather than silently reverting tab A.

- [ ] **Step 6: Commit**

```bash
git add src/lib/subject.ts src/lib/admin-save.ts src/lib/content-write.ts src/app/api/admin/save/route.ts
git commit -m "feat: authorized patch saves with compare-and-swap conflict detection"
```

---

## Task 11: Fix the reorder mutation and emit ops from editors

Without this, the very first diff-based save silently drops every reorder.

**Files:**
- Modify: `src/app/admin/styles/StylesEditor.tsx:71-79`,
  `src/app/admin/studios/StudiosEditor.tsx:41-49`,
  `src/components/admin/CustomPagesEditor.tsx:107-115`
- Create: `src/lib/diff-ops.ts`, `src/lib/diff-ops.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { diffToOps } from './diff-ops';

describe('diffToOps', () => {
  it('emits a list op when only the order changed', () => {
    const base = { danceStyles: [{ id: 'a', displayOrder: 1 }, { id: 'b', displayOrder: 2 }] };
    const next = { danceStyles: [{ id: 'b', displayOrder: 1 }, { id: 'a', displayOrder: 2 }] };
    expect(diffToOps(base, next, 'danceStyles')).toHaveLength(1);
  });

  it('emits nothing when a field was changed and changed back', () => {
    const base = { site: { tagline: 'x' } };
    expect(diffToOps(base, { site: { tagline: 'x' } }, 'site')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- diff-ops`
Expected: FAIL.

- [ ] **Step 3: Fix the three mutating `move()` implementations**

```tsx
// before — shallow slice, then mutates objects the `initial` prop still holds
const next = c.danceStyles.slice();
next.forEach((s, i) => (s.displayOrder = i + 1));

// after — new objects, so a diff against the base can see the change
const next = reordered.map((s, i) => ({ ...s, displayOrder: i + 1 }));
```

- [ ] **Step 4: Implement `diffToOps`**

`diffToOps(base, next, sectionPath)` returns `[]` when the section is deep-equal, a single
`{op:'setList'}` when the section is an id-addressed collection, and a `{op:'set'}` at
`sectionPath` otherwise. The server expands it into leaves, so the client stays simple.

- [ ] **Step 5: Run and confirm green**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Manually verify a reorder survives**

In `npm run dev`: `/admin/styles`, move a style up, save, reload. Expected: the new order
persists (this is the regression the shallow copy would have caused).

- [ ] **Step 7: Commit**

```bash
git add src/lib/diff-ops.ts src/lib/diff-ops.test.ts src/app/admin/styles/StylesEditor.tsx src/app/admin/studios/StudiosEditor.tsx src/components/admin/CustomPagesEditor.tsx
git commit -m "fix: reorder mutated the diff baseline, so reorders were dropped"
```

---

## Task 12: Restore as a computed op set, audit hardening, and `/admin/json`

**Files:**
- Modify: `src/lib/content-write.ts:52-62`, `src/app/api/admin/restore/route.ts`,
  `src/app/admin/versions/page.tsx`, `src/app/admin/json/page.tsx`, `src/lib/audit.ts`

- [ ] **Step 1: Express restore as ops**

`restoreVersion` computes `setList`/`set` ops from the difference between the published document
and the snapshot, then runs them through `applyAndAuthorize` with the restorer's subject —
refusing with the offending leaf list. Restore writes at `currentRev + 1` under a **new
lineage** (`crypto.randomUUID()`), so every stale tab and draft fails its version check loudly.
Merge the snapshot against a **schema-defaults floor**, not the content-bearing seed:

```ts
const DEFAULTS_FLOOR = SiteContentSchema.parse({ version: 1, site: MINIMAL_SITE, hero: MINIMAL_HERO });
```

- [ ] **Step 2: Gate the pages that already imply a gate**

`/admin/versions` gets `if (!hasCapability(subject, 'versions.restore')) redirect('/admin')` —
today the API 403s while the page renders a Restore button for everyone and leaks every actor's
email through the snapshot filenames. `/admin/json` becomes owner-only.

- [ ] **Step 3: Harden the audit log**

`audit()` writes through `readDocWithVersion` + `writeDocIfMatch` with one retry, so concurrent
entries stop dropping. Denial events additionally `console.error` (they must not be swallowed —
that is the only way they reach wrangler observability).

- [ ] **Step 4: Verify**

```bash
npm test && npm run typecheck && npm run build
```

Then in dev: log in, restore a version, confirm it applies and appears in the audit log with the
changed paths and the new rev.

- [ ] **Step 5: Commit**

Stage explicit paths only — see the note in Task 1 Step 6.

```bash
git add src/lib/content-write.ts src/lib/audit.ts \
        src/app/api/admin/restore/route.ts \
        src/app/admin/versions/page.tsx src/app/admin/json/page.tsx
git commit -m "feat: restore through the authorizer, CAS audit writes, gate versions and raw JSON"
```

---

## Self-Review

**Spec coverage for Plan 1's scope** — §3 storage/revision (Tasks 7, 10, 12), §4.1 wire format
(4), §4.2 path grammar (2), §4.3 expansion (5), §4.4 pipeline order (9, 10), §4.5 schema
invariants (8), §4.6 audit (12), §4.7 restore (12), §5.2 roles + enforcement seam (6, 10, 12),
§6.1 the reorder prerequisite (11), §10 the six mandatory test modules (2, 3, 4, 5, 6, 8, 9),
§11 decision 3 GH Pages retirement (1).

**Deferred to later plans, by design:** identity/`users.json`, invites, the Users screen and the
full page-guard sweep (Plan 2); drafts, approval, preview, `useEditor`, mobile shell (Plan 3);
media, blocks, scheduling, theming, campaigns (Plan 4). `resolveSubject()` is the seam between
Plan 1 and Plan 2 and keeps its signature.

**Naming consistency check:** `applyOps` / `expandOps` / `authorize` / `applyAndAuthorize` /
`matchPath` / `parsePath` / `collectionIdField` / `readDocWithVersion` / `writeDocIfMatch` /
`resolveSubject` / `diffToOps` are used identically everywhere they appear.

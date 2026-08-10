# Post-Payment Confirmations, Level-Aware Batches and La Rumba Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every post-payment confirmation derive its venue, date, time and contact details from the batch the customer actually paid for; make the home page's per-style strip beginner-first and honest about its fallbacks; and lift La Rumba above the fold with `schema.org/Event` markup.

**Architecture:** Two defaulted fields join `BatchSchema` (`welcomeTrackKey`, `welcomeNote`) and two join `WelcomeTrackSchema` (`noteHeadline`, `noteBody`), so `/welcome/[track]` resolves a **stored** track key instead of guessing by style overlap. Every new decision — which batch a confirmation is about, which studio it names, which batches the client may switch between, which batch fronts a style card — moves into pure functions in `src/lib` (`welcome-resolve.ts`, additions to `content-helpers.ts` and `seo.ts`) that are unit-tested without a DOM; the page components become thin consumers. Cross-record validation of the new key lands in `src/lib/integrity.ts`, on the **write path only**.

**Tech Stack:** Next.js 15 App Router (server components), Zod single-document CMS, vitest (node environment, no DOM), TypeScript strict, Cloudflare Workers free plan.

**Execution order:** Plan 3 of 4. Runs after `docs/superpowers/plans/2026-08-10-mobile-foundation.md` and before `docs/superpowers/plans/2026-08-10-editability-backfill.md`. It must follow the labels and mobile plans because it consumes `label()` and the `labels` document key that Plan 1 ships, and because Plan 2 has already rewritten `Hero.tsx` / `Header.tsx` / the hero region of `page.tsx`; it must precede the backfill plan because Plan 4 turns the remaining hardcoded strings this plan introduces into editable content fields.

> **⚠️ BEFORE RUNNING THIS PLAN — resolve the seed drift.** Found while executing Plan 1 (2026-08-10): the gitignored `data/site-content.json` has drifted from the tracked seed via manual `/admin` QA edits made Aug 7–10 (studio reorder, a testimonial `authorId`, a headline period — visible in `data/audit.json`), so `npm run sync-seed -- --check` fails today. **This plan runs `npm run sync-seed`, which would bake that drift into the shipped seed.** Decide deliberately what to keep first, or those QA edits ship as product defaults.

## Global Constraints

- **R1 — anchor every edit on unique TEXT, never on line numbers.** Four plans edit `content-schema.ts`, `page.tsx`, `Hero.tsx`, `Header.tsx`, `Footer.tsx`, `WelcomeView.tsx`, `seo.ts` and the seed. Line numbers cited below are **orientation only** ("currently around :160"); the instruction is always "find this exact text and replace it".
- **R2 — never hand-write `src/data/site-content.seed.json`.** `scripts/sync-seed.mjs` regenerates the seed FROM `data/site-content.json`, so a hand-edited seed is destroyed by the next `npm run sync-seed`. Every content-data change edits `data/site-content.json`, then runs `npm run sync-seed`, then commits the tracked seed `src/data/site-content.seed.json`. **`data/site-content.json` is GITIGNORED** (`.gitignore:8-9`) and can never appear in a commit — a `git add data/site-content.json` step silently no-ops, and any clean-tree gate that assumes it was committed is misleading. The seed is the tracked artifact and the fallback the app serves on a fresh clone or in CI, and ends with `npm run sync-seed -- --check` printing `✓ seed is in sync with data/site-content.json`.
- **R3 — content validation never goes on the read path.** No `.refine()` / `.superRefine()` that can reject a stored document. `src/lib/content.ts` wraps `SiteContentSchema.parse(mergeWithSeed(...))` in a `try` whose `catch` returns `seedResult()`, so one bad field would serve the bundled seed for the **entire public site**. `welcomeTrackKey` is checked in `src/lib/integrity.ts` (write path), beside the existing `branchSlug` check.
- **R4 — never `Write` a test file another plan already created.** `src/lib/content-schema.test.ts`, `src/lib/content-helpers.test.ts` and `src/lib/seo.test.ts` are shared surfaces. Each task below says: create if the file is absent, **append** if it is present, and restates the cumulative count for both cases. `src/lib/integrity.test.ts` already exists and is always appended to.
- **R5 — every code step contains real, complete code.** No "following X exactly", no "similar to Task N", no TBD, no deliberately-wrong-then-corrected code.
- **R6 — test-count arithmetic.** This plan runs **third**, so it does not start from the `main` baseline of 26 files / 279 tests: Plans 1 and 2 land first and leave the suite at **34 files / 352 tests**, all green (`npx vitest run`, Node v24.18.0, vitest 4.1.10). This plan adds 4 files and 51 tests → **38 files / 403 tests**. Every absolute below is stated off 34/352; the number that must hold if an earlier plan shifts is the **delta: +4 files, +51 tests**. Per-file counts are in Task 15.
- **R7 — commit style:** lowercase conventional prefix, imperative. **NEVER add a `Co-Authored-By` trailer.**
- **R8 — no runtime dependency.** Nothing here adds a package. `sharp` (Plan 2) is devDependencies-only.
- Every new content field is `z.string().default('<the exact literal shipping today>')`. A required field fails validation on read (see R3).
- **`BatchSchema` is a `z.preprocess` wrapper (a `ZodEffects`)**, so it exposes neither `.shape` nor `.extend()`. New fields must be hand-edited into the inner `z.object`.
- Schema and seed change in the **same commit**: `save-pipeline.test.ts` and `drafts-core.test.ts` both `import seed from '@/data/site-content.seed.json'` and parse it at module load, so a schema/seed mismatch throws before any assertion runs.
- No new top-level content key is added by this plan, so `SECTION_PATHS` (`src/lib/roles.ts`) needs no change and `roles.test.ts` stays green. No new `src/app/admin/**/page.tsx`, so `admin-pages-guarded.test.ts` needs no change.
- `DENY_IDS` denies `*.id` and `*.*.id` for every role — no new field may be named `id` at depth 1–2. Nothing here adds one. `welcome.tracks` is already registered in `src/lib/collections.ts` keyed by `key`.
- `src/lib/batch-order.ts` and `src/lib/batch-order.test.ts` are **unchanged**. `LEVEL_ORDER`, `compareByLevel` and its pinned cases stay exactly as they are.
- Cloudflare Workers FREE plan, 10 ms CPU cap. TypeScript strict; `npm run typecheck` = `tsc --noEmit`.
- **Shell:** every command below is written for the **Bash** tool (Git Bash). Do not paste them into PowerShell.
- **Dev server:** `npm run dev` writes to `.next-dev` and the repo lives on a slow disk — the first request to a route can take 60 s or more to compile. Wait for it before treating a `curl` as evidence.

### Dependency on Plan 1 (labels foundation)

Task 5 consumes three things Plan 1 must have shipped. Task 5 Step 1 is a hard gate that fails loudly if any is missing.

| symbol | where Plan 1 puts it | how this plan uses it |
|---|---|---|
| `export type Labels` | `src/lib/content-schema.ts` | `WelcomeView` prop type |
| `export function label(labels: Labels, key: string): string` | `src/lib/labels.ts` | resolves a label to its stored value, else its shipped default |
| `LABEL_DEFAULTS` entries | `src/lib/labels.ts` | the keys below |

Keys Plan 1 **must** include in `LabelsSchema` / `LABEL_DEFAULTS`, with these exact shipped defaults (spec §3.3: "Row labels come from `labels`"):

| key | shipped default |
|---|---|
| `welcomeWhereHeading` | `Where` |
| `welcomeOpenMap` | `Open map →` |
| `welcomeParking` | `Parking: {notes}` |
| `welcomeReachUs` | `Reach us` |
| `welcomeCallPhone` | `Call {phone}` |

The map-button key is **`welcomeOpenMap`, defaulting to `Open map →`** — not a `welcomeGetDirections` defaulting to `Get directions →`. `WelcomeView.tsx:265` ships the literal `Open map →` today, and every default in this migration reproduces the literal shipping today; a renamed default would silently rewrite visitor-facing copy under cover of a labels refactor.

Two further keys are already named by spec §4.2 and are reused, not added: `ctaChatWhatsapp` (`Chat on WhatsApp`) and `ctaDmInstagram` (`DM on Instagram`).

### Strings this plan deliberately leaves hardcoded

Plan 4 (editability backfill) makes them editable as `welcome.*` fields. Listing them so they are not mistaken for oversights: `We’ll share the exact address on WhatsApp.` (the no-venue fallback in the Where cell) and the admin-only field labels and hints added in Task 7 (`/admin` copy is out of scope for ask B, spec §4.1 — "31 public files").

---

## File Structure

| File | Responsibility |
|---|---|
| **Create** `src/lib/welcome-resolve.ts` | Which batch a `/welcome/<track>` visit is about, which studio it names, which batches the client may switch between, the note it shows, and the Razorpay redirect path |
| **Create** `src/lib/welcome-resolve.test.ts` | Pins `?b=` authority, past-date resolution, Intermediate-resolves-to-itself, the no-`studios[0]` rule, the option list, note fallback |
| **Create/append** `src/lib/content-schema.test.ts` | Pins that the four new fields default to `''` and that every seeded batch points at a real welcome track |
| **Create/append** `src/lib/content-helpers.test.ts` | Pins `hiddenReason`, its agreement with `visibleBatches`, level-aware `nextBatchPerStyle`, `fallbackLevelNote` |
| **Create/append** `src/lib/seo.test.ts` | Pins the La Rumba `Event` node and its all-or-nothing recurrence parse |
| **Modify** `src/lib/content-schema.ts` | Adds `welcomeTrackKey` / `welcomeNote` to the batch object and `noteHeadline` / `noteBody` to the welcome track |
| **Modify** `data/site-content.json` (+ seed via `npm run sync-seed`) | Stamps the six live batches with their track key; corrects `/p/latinl1july2026`'s venue, map link and arrival time |
| **Modify** `src/lib/content-helpers.ts` | `hiddenReason`, level-aware `nextBatchPerStyle`, `fallbackLevelNote` |
| **Modify** `src/lib/content.ts` | Re-exports `hiddenReason` and `fallbackLevelNote` alongside the other helpers |
| **Modify** `src/lib/integrity.ts` | Write-path check that `welcomeTrackKey` resolves to a real welcome track |
| **Modify** `src/lib/integrity.test.ts` | Four appended cases, including "a bad key never fails a read" |
| **Modify** `src/lib/seo.ts` | `weeklyScheduleLd` and `tonightEventLd` for La Rumba |
| **Modify** `src/app/welcome/[track]/page.tsx` | Resolves the batch server-side from all batches; builds the derived contact bundle |
| **Modify** `src/app/welcome/[track]/WelcomeView.tsx` | Renders the derived location / directions / phone / WhatsApp / Instagram block and the post-payment note |
| **Modify** `src/app/admin/batches/BatchesEditor.tsx` | IST-stamped new batches, welcome-page select, post-payment message, hidden-batch warning, stored-key redirect hint |
| **Modify** `src/components/admin/WelcomePageEditor.tsx` | Per-track default note headline and body |
| **Modify** `src/app/page.tsx` | Consumes the new `nextBatchPerStyle` shape, moves `TonightTile` above `KineticStrip`, renders the Event JSON-LD |

---

### Task 1: Schema fields and stamped batch data

**Files:**
- Modify: `src/lib/content-schema.ts` (anchors: `razorpayLink: safeUrl().nullable().optional(),`; `metaDesc: z.string().default(''),`; `metaDesc: 'Your Latin beginner intake details and next steps.',`; `metaDesc: 'Your West Coast Swing beginner intake details and next steps.',`)
- Modify: `src/app/admin/batches/BatchesEditor.tsx` (anchor: `razorpayLink: null,`)
- Modify: `src/components/admin/WelcomePageEditor.tsx` (anchor: `metaDesc: '',`)
- Modify: `data/site-content.json`, then `src/data/site-content.seed.json` via `npm run sync-seed`
- Test: `src/lib/content-schema.test.ts`

**Interfaces:**
- Produces: `Batch` gains `welcomeTrackKey: string` and `welcomeNote: string`; `WelcomeTrack` gains `noteHeadline: string` and `noteBody: string`. Every later task depends on these.

- [ ] **Step 1: Write the failing test**

If `src/lib/content-schema.test.ts` does not exist, create it with exactly this content. If Plan 1 or Plan 2 already created it, **append** the two `describe` blocks to the end of the existing file and make sure the three imports are present at the top — do not `Write` over it (R4).

```ts
import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';

// BatchSchema is a z.preprocess wrapper (a ZodEffects): it has no .shape and
// no .extend(). These assertions go through a full document parse rather than
// poking at the schema object, which is the only thing that works for it.
const doc = () => SiteContentSchema.parse(seed);
const rawSeed = () => JSON.parse(JSON.stringify(seed));

describe('BatchSchema post-payment fields', () => {
  // A required field here would fail validation on read and serve the bundled
  // seed for the whole public site (content.ts, the catch around
  // SiteContentSchema.parse), so both MUST default.
  it('defaults welcomeTrackKey and welcomeNote on a batch that has neither', () => {
    const raw = rawSeed();
    delete raw.batches[0].welcomeTrackKey;
    delete raw.batches[0].welcomeNote;
    const parsed = SiteContentSchema.parse(raw);
    expect(parsed.batches[0].welcomeTrackKey).toBe('');
    expect(parsed.batches[0].welcomeNote).toBe('');
  });

  it('ships every seeded batch already pointed at a real welcome track', () => {
    const keys = new Set(doc().welcome.tracks.map((t) => t.key));
    expect(doc().batches.map((b) => b.welcomeTrackKey).filter((k) => !keys.has(k))).toEqual([]);
  });
});

describe('WelcomeTrackSchema note fields', () => {
  it('defaults noteHeadline and noteBody so an unedited track still renders', () => {
    const raw = rawSeed();
    delete raw.welcome.tracks[0].noteHeadline;
    delete raw.welcome.tracks[0].noteBody;
    const parsed = SiteContentSchema.parse(raw);
    expect(parsed.welcome.tracks[0].noteHeadline).toBe('');
    expect(parsed.welcome.tracks[0].noteBody).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — 3 failed. First failure: `AssertionError: expected undefined to be '' // Object.is equality`.

- [ ] **Step 3: Add the four fields to the schema**

In `src/lib/content-schema.ts`, find the unique line inside the inner `z.object` of `BatchSchema` (currently around :160):

```ts
    razorpayLink: safeUrl().nullable().optional(),
```

and replace it with:

```ts
    razorpayLink: safeUrl().nullable().optional(),
    // Which welcome track this batch's payment redirect lands on. Stored
    // rather than guessed: the old "first track whose styleSlugs intersect"
    // heuristic silently handed Intermediate customers another batch's
    // intake details. Validated on the WRITE path only (integrity.ts) —
    // never a .refine(), which would fail reads and serve the seed site-wide.
    welcomeTrackKey: z.string().default(''),
    // The per-batch post-payment message. Empty means "use the track
    // default", so a batch created and never edited still ships a warm
    // confirmation.
    welcomeNote: z.string().default(''),
```

Then find the unique line inside `WelcomeTrackSchema` (currently around :442):

```ts
  metaDesc: z.string().default(''),
```

and replace it with:

```ts
  metaDesc: z.string().default(''),
  // Default post-payment note for every batch on this track. A batch's own
  // welcomeNote overrides the body; the headline is always the track's.
  noteHeadline: z.string().default(''),
  noteBody: z.string().default(''),
```

- [ ] **Step 4: Make the two inline track defaults explicit**

`WelcomeSchema.tracks` is `z.array(WelcomeTrackSchema).default([...])`. Zod 3's `.default()` takes the schema's **input** type, in which every `.default('')` field is optional — so these two literals already typecheck without the new keys. Add them anyway, so the shipped default of a fresh document states what a new track starts with instead of leaving it implicit.

In `src/lib/content-schema.ts`, find:

```ts
          metaDesc: 'Your Latin beginner intake details and next steps.',
```

replace with:

```ts
          metaDesc: 'Your Latin beginner intake details and next steps.',
          noteHeadline: '',
          noteBody: '',
```

and find:

```ts
          metaDesc: 'Your West Coast Swing beginner intake details and next steps.',
```

replace with:

```ts
          metaDesc: 'Your West Coast Swing beginner intake details and next steps.',
          noteHeadline: '',
          noteBody: '',
```

- [ ] **Step 5: Keep the two admin object literals typechecking**

`Batch` and `WelcomeTrack` are **output** types, so both new fields are required in an object literal annotated with them. Task 7 replaces the `''` in `BatchesEditor` with real track resolution.

In `src/app/admin/batches/BatchesEditor.tsx`, find the unique line inside `add()`:

```ts
      razorpayLink: null,
```

replace with:

```ts
      razorpayLink: null,
      welcomeTrackKey: '',
      welcomeNote: '',
```

In `src/components/admin/WelcomePageEditor.tsx`, find the unique line inside `addTrack()`:

```ts
          metaDesc: '',
```

replace with:

```ts
          metaDesc: '',
          noteHeadline: '',
          noteBody: '',
```

- [ ] **Step 6: Run the test — one case must still be red**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — 1 failed, 2 passed. The remaining failure is `ships every seeded batch already pointed at a real welcome track`: `AssertionError: expected [ '', '', '', '', '', '' ] to deeply equal []`. The schema now defaults; the data is not stamped yet.

- [ ] **Step 7: Stamp the six live batches with their welcome track**

Edit `data/site-content.json` (never the seed — R2). Run exactly this from the repo root:

```bash
node -e "
const fs=require('fs');
const p='data/site-content.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
const TRACK={'batch-rp8nn4':'latin','batch-ua7f9x':'wcs','batch-001':'latin','batch-002':'wcs','batch-004':'latin','batch-005':'latin'};
for(const b of c.batches){ b.welcomeTrackKey = TRACK[b.id] ?? ''; b.welcomeNote = b.welcomeNote ?? ''; }
for(const t of c.welcome.tracks){ t.noteHeadline = t.noteHeadline ?? ''; t.noteBody = t.noteBody ?? ''; }
fs.writeFileSync(p, JSON.stringify(c,null,2)+String.fromCharCode(10));
console.log(c.batches.map(b=>b.id+' -> '+b.welcomeTrackKey).join(String.fromCharCode(10)));
"
```

Expected output, exactly:

```
batch-rp8nn4 -> latin
batch-ua7f9x -> wcs
batch-001 -> latin
batch-002 -> wcs
batch-004 -> latin
batch-005 -> latin
```

(`batch-004` is Intermediate salsa and `batch-005` is Advanced bachata: both belong on the `latin` welcome page. Level does not choose the track — the track is the *page*, the level is the *class*. That distinction is the whole bug being fixed.)

Then propagate to the bundled seed:

```bash
npm run sync-seed
```

Expected: a line reading `Wrote src/data/site-content.seed.json`, followed by the `source:` / `output:` byte counts.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: PASS — 3 passed (3).

- [ ] **Step 9: Verify the whole suite, the types, and the seed sync**

Run: `npx vitest run && npm run typecheck && npm run sync-seed -- --check`
Expected: vitest **35 files / 355 tests passed** (this plan's 34/352 starting point — Plans 1 and 2 already landed — plus this file's 3); `tsc --noEmit` exits 0 with no output; sync-seed prints `✓ seed is in sync with data/site-content.json` and exits 0.

If Plan 1 or Plan 2 shifted its own counts, the absolute totals move with them — the number that must hold is the delta: **+1 file, +3 tests, zero pre-existing tests turned red.**

- [ ] **Step 10: Commit**

```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts data/site-content.json src/data/site-content.seed.json src/app/admin/batches/BatchesEditor.tsx src/components/admin/WelcomePageEditor.tsx
git commit -m "feat: per-batch welcome track and post-payment note in the content schema"
```

---

### Task 2: `welcome-resolve.ts` — which batch a confirmation is about

**Files:**
- Create: `src/lib/welcome-resolve.ts`
- Test: `src/lib/welcome-resolve.test.ts`

**Interfaces:**
- Consumes: `Batch` (with `welcomeTrackKey`, `welcomeNote`) and `WelcomeTrack` (with `noteHeadline`, `noteBody`) from Task 1; `todayIso()` from `src/lib/format.ts`.
- Produces (the two starred names are fixed by the shared contract — do not rename):
```ts
export function resolveWelcomeBatch(args: {
  batchId: string | null;
  trackKey: string;
  batches: Batch[];          // ALL batches, not visibleBatches
}): Batch | null;                                                    // ★ contract
export function welcomeNoteFor(
  batch: Batch | null,
  track: WelcomeTrack,
): { headline: string; body: string };                               // ★ contract
export function telHref(telephone: string): string;
export function welcomeRedirectPath(batch: Batch): string | null;
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/welcome-resolve.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Batch, WelcomeTrack } from './content-schema';
import {
  resolveWelcomeBatch,
  telHref,
  welcomeNoteFor,
  welcomeRedirectPath,
} from './welcome-resolve';

// The confirmation page a customer lands on after paying.
//
// Two live bugs are pinned here. The page hard-filtered `level ===
// 'Foundation'` and pulled from visibleBatches(), so (a) an Intermediate
// customer matched nothing and silently saw another batch's date, venue and
// .ics file, and (b) the moment a batch's startDate passed, the pool emptied
// and the venue fell back to studios[0] — the wrong address for five of six
// live batches.
//
// Dates are deliberately absurd so nothing here depends on the wall clock:
// 2099 is always upcoming, 2020 is always past.
export const batch = (over: Partial<Batch> & { id: string }): Batch => ({
  styleSlugs: ['salsa'],
  level: 'Foundation',
  branchSlug: 'jubilee-hills',
  daysOfWeek: ['Sat', 'Sun'],
  time: '9:30–10:30 AM',
  startDate: '2099-01-01',
  priceInr: 6900,
  reservationInr: 500,
  seatsLeft: null,
  status: 'Open',
  razorpayLink: null,
  welcomeTrackKey: 'latin',
  welcomeNote: '',
  ...over,
});

const track = (over: Partial<WelcomeTrack> = {}): WelcomeTrack => ({
  key: 'latin',
  trackLabel: 'Latin beginner class',
  styleSlugs: ['salsa', 'bachata'],
  weekendTod: 'AM',
  whenDays: 'Saturday & Sunday',
  whenTime: '9:30 AM – 10:30 AM',
  arriveBy: '9:15 AM',
  metaDesc: '',
  noteHeadline: 'A note from Rish',
  noteBody: 'Come 15 minutes early and say hi at the desk.',
  ...over,
});

describe('resolveWelcomeBatch', () => {
  it('lets ?b= win over the soonest-upcoming default', () => {
    const soon = batch({ id: 'b_soon', startDate: '2099-01-01' });
    const later = batch({ id: 'b_later', startDate: '2099-06-01' });
    const got = resolveWelcomeBatch({ batchId: 'b_later', trackKey: 'latin', batches: [soon, later] });
    expect(got?.id).toBe('b_later');
  });

  // The link a customer bookmarks must stay correct forever.
  it('resolves a batch whose start date has already passed', () => {
    const past = batch({ id: 'b_past', startDate: '2020-06-20', branchSlug: 'pup-unleash-huda-colony' });
    const got = resolveWelcomeBatch({ batchId: 'b_past', trackKey: 'latin', batches: [past] });
    expect(got?.branchSlug).toBe('pup-unleash-huda-colony');
  });

  // THE Intermediate bug: the pinned batch is returned as itself, never
  // swapped for a Foundation batch of the same style.
  it('resolves an Intermediate batch to itself', () => {
    const foundation = batch({ id: 'b_f' });
    const intermediate = batch({ id: 'b_i', level: 'Intermediate', time: '12:00–2:00 PM' });
    const got = resolveWelcomeBatch({
      batchId: 'b_i',
      trackKey: 'latin',
      batches: [foundation, intermediate],
    });
    expect(got?.id).toBe('b_i');
    expect(got?.level).toBe('Intermediate');
  });

  it('degrades to the track default when the pinned id is unknown', () => {
    const only = batch({ id: 'b_1' });
    const got = resolveWelcomeBatch({ batchId: 'deleted-batch', trackKey: 'latin', batches: [only] });
    expect(got?.id).toBe('b_1');
  });

  it('picks the soonest upcoming batch for the track when nothing is pinned', () => {
    const soon = batch({ id: 'b_soon', startDate: '2099-01-01' });
    const later = batch({ id: 'b_later', startDate: '2099-09-01' });
    const other = batch({ id: 'b_wcs', welcomeTrackKey: 'wcs', startDate: '2099-02-01' });
    const got = resolveWelcomeBatch({ batchId: null, trackKey: 'latin', batches: [later, other, soon] });
    expect(got?.id).toBe('b_soon');
  });

  it('falls back to the most recent past batch once every batch on the track has started', () => {
    const old = batch({ id: 'b_old', startDate: '2020-01-01' });
    const recent = batch({ id: 'b_recent', startDate: '2020-06-01' });
    const got = resolveWelcomeBatch({ batchId: null, trackKey: 'latin', batches: [old, recent] });
    expect(got?.id).toBe('b_recent');
  });

  // Stored, never guessed: an unstamped batch is not a candidate for any track.
  it('never guesses by style overlap', () => {
    const unstamped = batch({ id: 'b_x', welcomeTrackKey: '', styleSlugs: ['salsa'] });
    expect(resolveWelcomeBatch({ batchId: null, trackKey: 'latin', batches: [unstamped] })).toBeNull();
  });

  it('returns null rather than an unrelated batch when nothing matches', () => {
    expect(resolveWelcomeBatch({ batchId: null, trackKey: 'latin', batches: [] })).toBeNull();
  });
});

describe('welcomeNoteFor', () => {
  it('prefers the per-batch note over the track default', () => {
    const b = batch({ id: 'b_1', welcomeNote: 'Bring a friend — the first class is easier in pairs.' });
    expect(welcomeNoteFor(b, track())).toEqual({
      headline: 'A note from Rish',
      body: 'Bring a friend — the first class is easier in pairs.',
    });
  });

  it('falls back to the track body when the batch note is only whitespace', () => {
    expect(welcomeNoteFor(batch({ id: 'b_1', welcomeNote: '   ' }), track()).body).toBe(
      'Come 15 minutes early and say hi at the desk.',
    );
  });

  it('falls back to the track body when there is no batch at all', () => {
    expect(welcomeNoteFor(null, track()).body).toBe('Come 15 minutes early and say hi at the desk.');
  });

  it('returns empty strings when neither is set, so the block can be hidden', () => {
    expect(welcomeNoteFor(null, track({ noteHeadline: '', noteBody: '' }))).toEqual({
      headline: '',
      body: '',
    });
  });
});

describe('telHref', () => {
  it('strips the display spacing so the dialler gets one number', () => {
    expect(telHref('+91 88860 72572')).toBe('tel:+918886072572');
  });

  it('returns an empty string for a blank number so no dead link renders', () => {
    expect(telHref('')).toBe('');
  });
});

describe('welcomeRedirectPath', () => {
  it('builds the pinned redirect from the STORED track key', () => {
    const b = batch({ id: 'batch-004', welcomeTrackKey: 'latin', startDate: '2026-07-04' });
    expect(welcomeRedirectPath(b)).toBe('/welcome/latin?d=2026-07-04&b=batch-004');
  });

  it('returns null when the batch has not been pointed at a welcome page', () => {
    expect(welcomeRedirectPath(batch({ id: 'b_1', welcomeTrackKey: '' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/welcome-resolve.test.ts`
Expected: FAIL — `Error: Failed to resolve import "./welcome-resolve" from "src/lib/welcome-resolve.test.ts". Does the file exist?`

- [ ] **Step 3: Write the module**

Create `src/lib/welcome-resolve.ts`:

```ts
import type { Batch, WelcomeTrack } from './content-schema';
import { todayIso } from './format';

// Which batch a post-payment /welcome/<track> visit is about.
//
// Two rules, both bought with real bugs:
//
// 1. `?b=` is authoritative and is resolved against EVERY batch, not just the
//    visible ones. The page used to filter `level === 'Foundation'` and pull
//    from visibleBatches(), so an Intermediate customer — and anyone opening
//    their confirmation link the week after class started — matched nothing
//    and silently got another batch's date, venue and calendar file.
// 2. The track fallback reads the batch's STORED welcomeTrackKey. The old
//    "first track whose styleSlugs intersect" guess handed Intermediate
//    customers the beginner track's intake details.

export function resolveWelcomeBatch(args: {
  batchId: string | null;
  trackKey: string;
  batches: Batch[];
}): Batch | null {
  const { batchId, trackKey, batches } = args;

  // The customer paid for exactly this batch. Any level, any date, always.
  if (batchId) {
    const pinned = batches.find((b) => b.id === batchId);
    if (pinned) return pinned;
  }

  // No usable pin: a bare Payment-Pages redirect, or an id that no longer
  // resolves. Fall back within the track the batch records point at.
  if (!trackKey) return null;
  const mine = batches.filter((b) => b.welcomeTrackKey === trackKey);
  if (mine.length === 0) return null;

  const byDateAsc = [...mine].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const today = todayIso();
  const upcoming = byDateAsc.find((b) => b.startDate >= today);
  if (upcoming) return upcoming;

  // Every batch on this track has already started. Show the most recent one:
  // a real past venue beats an invented default venue.
  return byDateAsc[byDateAsc.length - 1];
}

/** The post-payment message for a batch: its own, else its track's default.
 *  The headline is always the track's, so a per-batch override stays a note
 *  rather than a whole re-skin of the section. */
export function welcomeNoteFor(
  batch: Batch | null,
  track: WelcomeTrack,
): { headline: string; body: string } {
  const perBatch = (batch?.welcomeNote ?? '').trim();
  return { headline: track.noteHeadline, body: perBatch || track.noteBody };
}

/** `studio.telephone` ("+91 88860 72572") → a dialler-safe href, or '' when
 *  there is no number to call. */
export function telHref(telephone: string): string {
  const dialable = telephone.replace(/[^\d+]/g, '');
  return dialable ? `tel:${dialable}` : '';
}

/** The Razorpay "redirect after payment" path for a batch, or null when the
 *  batch has not been pointed at a welcome page yet. `?b=` is what the page
 *  resolves on; `?d=` is kept so links minted before this change keep working. */
export function welcomeRedirectPath(batch: Batch): string | null {
  if (!batch.welcomeTrackKey) return null;
  return `/welcome/${batch.welcomeTrackKey}?d=${batch.startDate}&b=${batch.id}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/welcome-resolve.test.ts`
Expected: PASS — 16 passed (16).

- [ ] **Step 5: Commit**

```bash
git add src/lib/welcome-resolve.ts src/lib/welcome-resolve.test.ts
git commit -m "feat: resolve the welcome batch from the stored track key, not a style guess"
```

---

### Task 3: `buildWelcomeOptions` and `resolveWelcomeStudio` — the page wiring, made testable

The confirmation page's *wiring* — dropping the Foundation filter, dropping `?? content.studios[0]`, rebuilding the client-side option list — is exactly the code that regressed before, and it was pinned by nothing. It moves into two more pure functions here so Task 4 becomes a substitution rather than a rewrite.

**Files:**
- Modify: `src/lib/welcome-resolve.ts` (anchor: `/** The Razorpay "redirect after payment" path for a batch, or null when the`)
- Test: `src/lib/welcome-resolve.test.ts` (append)

**Interfaces:**
- Produces:
```ts
export function resolveWelcomeStudio<S extends { slug: string }>(
  batch: Pick<Batch, 'branchSlug'> | null,
  studios: S[],
): S | null;
export function buildWelcomeOptions(args: {
  resolved: Batch | null;
  trackKey: string;
  batches: Batch[];
}): Batch[];
```

- [ ] **Step 1: Write the failing test**

Append to `src/lib/welcome-resolve.test.ts`, and extend the existing import from `'./welcome-resolve'` so it reads:

```ts
import {
  buildWelcomeOptions,
  resolveWelcomeBatch,
  resolveWelcomeStudio,
  telHref,
  welcomeNoteFor,
  welcomeRedirectPath,
} from './welcome-resolve';
```

Then append:

```ts
// The two studios in the live document, reduced to what these functions read.
const JUBILEE = { slug: 'jubilee-hills', name: 'Jubilee Hills' };
const HUDA = { slug: 'pup-unleash-huda-colony', name: 'PUP Unleash - HUDA Colony' };

describe('resolveWelcomeStudio', () => {
  // THE venue bug. `?? content.studios[0]` put "Alcazar Mall, Jubilee Hills"
  // on confirmations for batches at HUDA Colony the instant their start date
  // passed. No batch now means no claimed venue at all.
  it('returns null when there is no batch, never the first studio', () => {
    expect(resolveWelcomeStudio(null, [JUBILEE, HUDA])).toBeNull();
  });

  it('returns the batch’s own studio, not the first one', () => {
    const b = batch({ id: 'b_1', branchSlug: 'pup-unleash-huda-colony' });
    expect(resolveWelcomeStudio(b, [JUBILEE, HUDA])?.slug).toBe('pup-unleash-huda-colony');
  });

  it('still resolves for a batch whose start date has passed', () => {
    const b = batch({ id: 'b_past', startDate: '2020-06-20', branchSlug: 'pup-unleash-huda-colony' });
    expect(resolveWelcomeStudio(b, [JUBILEE, HUDA])?.slug).toBe('pup-unleash-huda-colony');
  });

  it('returns null when the branchSlug matches no studio', () => {
    const b = batch({ id: 'b_1', branchSlug: 'gachibowli' });
    expect(resolveWelcomeStudio(b, [JUBILEE, HUDA])).toBeNull();
  });
});

describe('buildWelcomeOptions', () => {
  // The page used to build this list from
  // visibleBatches().filter(level === 'Foundation'), which is why an
  // Intermediate customer's ?b= had nothing to match against.
  it('includes every batch stamped with the track, whatever its level', () => {
    const f = batch({ id: 'b_f' });
    const i = batch({ id: 'b_i', level: 'Intermediate' });
    const a = batch({ id: 'b_a', level: 'Advanced' });
    const got = buildWelcomeOptions({ resolved: f, trackKey: 'latin', batches: [f, i, a] });
    expect(got.map((b) => b.id)).toEqual(['b_f', 'b_i', 'b_a']);
  });

  it('includes batches whose start date has already passed', () => {
    const past = batch({ id: 'b_past', startDate: '2020-01-01' });
    const got = buildWelcomeOptions({ resolved: past, trackKey: 'latin', batches: [past] });
    expect(got.map((b) => b.id)).toEqual(['b_past']);
  });

  it('excludes batches stamped with a different track', () => {
    const mine = batch({ id: 'b_1' });
    const theirs = batch({ id: 'b_2', welcomeTrackKey: 'wcs' });
    const got = buildWelcomeOptions({ resolved: mine, trackKey: 'latin', batches: [mine, theirs] });
    expect(got.map((b) => b.id)).toEqual(['b_1']);
  });

  // A confirmation link may legitimately pin a batch stamped for another
  // track. The client-side ?d=/?b= pin must still find it in `options`.
  it('prepends the resolved batch when it is not on the track', () => {
    const mine = batch({ id: 'b_1' });
    const offTrack = batch({ id: 'b_wcs', welcomeTrackKey: 'wcs' });
    const got = buildWelcomeOptions({ resolved: offTrack, trackKey: 'latin', batches: [mine, offTrack] });
    expect(got.map((b) => b.id)).toEqual(['b_wcs', 'b_1']);
  });

  it('returns an empty list when the track has no batches and nothing resolved', () => {
    expect(buildWelcomeOptions({ resolved: null, trackKey: 'latin', batches: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/welcome-resolve.test.ts`
Expected: FAIL — 9 failed, 16 passed. First failure: `TypeError: resolveWelcomeStudio is not a function`. (If your vite build surfaces the missing exports at link time instead, the whole file is reported as failed with `SyntaxError: The requested module './welcome-resolve' does not provide an export named 'buildWelcomeOptions'` — both are the intended red.)

- [ ] **Step 3: Add the two functions**

In `src/lib/welcome-resolve.ts`, find this unique comment opener:

```ts
/** The Razorpay "redirect after payment" path for a batch, or null when the
```

and insert the following **immediately before** it:

```ts
/** The studio a confirmation names.
 *
 *  There is deliberately no `?? studios[0]` fallback. That fallback is what
 *  printed "Alcazar Mall, Jubilee Hills" on confirmations for batches running
 *  at HUDA Colony, every time a batch's start date slipped past. A
 *  confirmation with no venue is recoverable; a confirmation with the WRONG
 *  venue sends a paying customer to the wrong building. */
export function resolveWelcomeStudio<S extends { slug: string }>(
  batch: Pick<Batch, 'branchSlug'> | null,
  studios: S[],
): S | null {
  if (!batch) return null;
  return studios.find((s) => s.slug === batch.branchSlug) ?? null;
}

/** The batches WelcomeView may switch between when the redirect carries a
 *  ?d=/?b= pin.
 *
 *  Every batch stamped with this track — every level, past dates included —
 *  plus the resolved batch itself when it belongs to a different track. The
 *  old list was `visibleBatches().filter(level === 'Foundation')`, so an
 *  Intermediate customer's ?b= had nothing to match and the view silently
 *  kept another batch's bundle. */
export function buildWelcomeOptions(args: {
  resolved: Batch | null;
  trackKey: string;
  batches: Batch[];
}): Batch[] {
  const { resolved, trackKey, batches } = args;
  const onTrack = batches.filter((b) => b.welcomeTrackKey === trackKey);
  if (resolved && !onTrack.some((b) => b.id === resolved.id)) return [resolved, ...onTrack];
  return onTrack;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/welcome-resolve.test.ts`
Expected: PASS — 25 passed (25).

- [ ] **Step 5: Commit**

```bash
git add src/lib/welcome-resolve.ts src/lib/welcome-resolve.test.ts
git commit -m "feat: pin the welcome page's studio and option-list wiring in pure functions"
```

---

### Task 4: Make `?b=` authoritative on the confirmation page

**Files:**
- Modify: `src/app/welcome/[track]/page.tsx` (anchors: `import { visibleBatches } from '@/lib/content-helpers';`; `  const pool = visibleBatches(content).filter(`; `  const buildBundle = (batch: Batch | undefined): BatchBundle => {`; `  const options = pool.map(buildBundle);`)
- Test: covered by `src/lib/welcome-resolve.test.ts` (Tasks 2 and 3) plus the before/after `curl` capture below

**Interfaces:**
- Consumes: `resolveWelcomeBatch`, `resolveWelcomeStudio`, `buildWelcomeOptions` from Tasks 2–3.
- Produces: `buildBundle` takes `Batch | null`; `content.studios[0]` is no longer used as a venue fallback.

- [ ] **Step 1: Capture the bug before fixing it**

Start the dev server in a second terminal (`npm run dev`) and wait for the first compile of `/welcome/[track]` to finish. Then:

```bash
curl -s "http://localhost:3000/welcome/latin?b=batch-004" | grep -o "9:30 AM – 10:30 AM\|12:00–2:00 PM\|Alcazar Mall\|HUDA Enclave"
```

Expected (the bug): the output contains **`9:30 AM – 10:30 AM`** and **`Alcazar Mall`**, and contains neither `12:00–2:00 PM` nor `HUDA Enclave`.

What that proves, precisely — both halves matter:

1. `batch-004` is **Intermediate**, `pup-unleash-huda-colony`, `12:00–2:00 PM`, starting `2026-07-04`. None of that reaches the page.
2. The time shown is the spaced en-dash `9:30 AM – 10:30 AM`, which is `cfg.whenTime` — **the track's fallback string, not any batch's `time`**. Today is 2026-08-10 and the only batch with `startDate >= today` is `batch-ua7f9x` (2026-08-29, west-coast-swing), so for the `latin` track `pool` is **empty**, `next` is `undefined`, `buildBundle(undefined)` runs, and `studio` falls to `content.studios[0]` = Jubilee Hills = Alcazar Mall.
3. `?b=` does **not** influence this HTML at all today. The server never reads it: `WelcomeView` resolves `?b=` in a `useEffect` against `options`, which is `[]`. `curl` runs no JavaScript, so the param is inert. Making `?b=` authoritative *server-side* is the fix.

- [ ] **Step 2: Replace the candidate pool with the resolver**

In `src/app/welcome/[track]/page.tsx`, find this exact block (currently around :153-161):

```ts
  // Candidate batches for this track. The redirect can pin one via ?d=/?b=;
  // otherwise we show the next upcoming one (prefer weekend in the right
  // time-of-day). Either way the date/time/venue come from live content.
  const pool = visibleBatches(content).filter(
    (b) => b.level === 'Foundation' && b.styleSlugs.some((s) => cfg.styleSlugs.includes(s)),
  );
  const matchesTod = (b: Batch) => (cfg.weekendTod === 'AM' ? /am/i.test(b.time) : /pm/i.test(b.time));
  const isWeekend = (b: Batch) => b.daysOfWeek.some((d) => d === 'Sat' || d === 'Sun');
  const next = pool.filter(isWeekend).find(matchesTod) ?? pool.find(isWeekend) ?? pool[0];
```

and replace it with:

```ts
  // Which batch this visit is about. `?b=` is authoritative and is resolved
  // SERVER-side against EVERY batch, not visibleBatches() — a confirmation
  // link must stay correct after the class has started, and an Intermediate
  // customer must get their own batch. See welcome-resolve.ts.
  const next = resolveWelcomeBatch({
    batchId: query.get('b'),
    trackKey: track,
    batches: content.batches,
  });
```

- [ ] **Step 3: Stop falling back to `studios[0]`, and widen the bundle input**

In the same file, find:

```ts
  const buildBundle = (batch: Batch | undefined): BatchBundle => {
    const studio = content.studios.find((s) => s.slug === batch?.branchSlug) ?? content.studios[0];
```

and replace it with:

```ts
  const buildBundle = (batch: Batch | null): BatchBundle => {
    // No `?? content.studios[0]`. That fallback is what put Jubilee Hills on a
    // confirmation for a batch at HUDA Colony the moment its start date passed.
    // No batch means no claimed venue at all.
    const studio = resolveWelcomeStudio(batch, content.studios);
```

- [ ] **Step 4: Rebuild the client-side option list from the track**

In the same file, find:

```ts
  const options = pool.map(buildBundle);
```

and replace it with:

```ts
  // Every batch stamped with this track, plus whatever `?b=` resolved to, so
  // the client-side ?d=/?b= pin in WelcomeView still has something to choose
  // from. See buildWelcomeOptions.
  const options = buildWelcomeOptions({
    resolved: next,
    trackKey: track,
    batches: content.batches,
  }).map(buildBundle);
```

- [ ] **Step 5: Fix the imports**

In the same file, find:

```ts
import { visibleBatches } from '@/lib/content-helpers';
```

and replace it with:

```ts
import {
  buildWelcomeOptions,
  resolveWelcomeBatch,
  resolveWelcomeStudio,
} from '@/lib/welcome-resolve';
```

`visibleBatches` has no other use in this file. `import type { Batch } from '@/lib/content-schema';` stays — `buildBundle` still annotates with it.

- [ ] **Step 6: Verify the fix**

Run: `npm run typecheck`
Expected: exits 0 with no output.

Then, with `npm run dev` running:

```bash
curl -s "http://localhost:3000/welcome/latin?b=batch-004" | grep -o "9:30 AM – 10:30 AM\|12:00–2:00 PM\|Alcazar Mall\|HUDA Enclave"
```

Expected: the output contains **`12:00–2:00 PM`** and **`HUDA Enclave`**, and contains **neither** `9:30 AM – 10:30 AM` nor `Alcazar Mall`.

Then the past-dated case — `batch-rp8nn4` is Foundation salsa, started `2026-07-25`, at `pup-unleash-huda-colony`:

```bash
curl -s "http://localhost:3000/welcome/latin?b=batch-rp8nn4" | grep -c "HUDA Enclave"
```

Expected: a count of at least `1` — a batch whose start date has passed still resolves to its own real venue instead of emptying the pool.

- [ ] **Step 7: Commit**

```bash
git add src/app/welcome/[track]/page.tsx
git commit -m "fix: welcome page honours ?b= for every level and keeps working after the start date"
```

---

### Task 5: The derived contact block and the post-payment note

Spec §3.3: the block is **derived from records, never hand-typed** — hand-typing is precisely what put the wrong address on `/p/latinl1july2026`. Row labels come from `labels` (Plan 1); only `welcomeNote` / `noteBody` is free text.

**This task is markup. It ships with no automated regression cover of its own** — the logic beneath it (`resolveWelcomeStudio`, `buildWelcomeOptions`, `welcomeNoteFor`, `telHref`) is fully pinned by `welcome-resolve.test.ts`, but the JSX is verified by the `curl` assertions in Step 8 only.

**Files:**
- Modify: `src/app/welcome/[track]/page.tsx` (anchors: `import { \n  buildWelcomeOptions,` block from Task 4; the `return {` object inside `buildBundle`; `      waDisplay={formatPhoneDisplay(wa)}`)
- Modify: `src/app/welcome/[track]/WelcomeView.tsx` (anchors: `import type { Welcome } from '@/lib/content-schema';`; `  icsHref: string | null;\n}`; `  vcardHref: string;`; `  vcardHref,`; `  const { intakeDate, whenDays, whenTime, arriveBy, venue, mapUrl, gcalUrl, icsHref } = bundle;`; `      {/* The two immediate steps */}`; the `Where` cell; `      {/* Sign-off */}`)
- Test: manual `curl` assertions (Step 8)

**Interfaces:**
- Consumes: `telHref(telephone)`, `welcomeNoteFor(batch, track)` from Task 2; `label(labels, key)` from Plan 1.
- Produces: `BatchBundle` gains `studioName`, `parkingNotes`, `telephone`, `telHref`, `noteHeadline`, `noteBody`; `WelcomeView` props gain `labels: Labels` and `instagramHandle: string`.

- [ ] **Step 1: Gate on Plan 1's labels**

Run:

```bash
for k in welcomeWhereHeading welcomeOpenMap welcomeParking welcomeReachUs welcomeCallPhone ctaChatWhatsapp ctaDmInstagram; do
  grep -q "$k" src/lib/labels.ts src/lib/content-schema.ts || echo "MISSING LABEL KEY: $k"
done
grep -q "export type Labels" src/lib/content-schema.ts || echo "MISSING: export type Labels"
grep -q "export function label" src/lib/labels.ts || echo "MISSING: export function label"
echo CHECK-DONE
```

Expected: exactly one line of output, `CHECK-DONE`. Any `MISSING …` line means Plan 1 did not ship a key this task consumes — stop and add it to `LABEL_DEFAULTS` / `LabelsSchema` with the default from the "Dependency on Plan 1" table above, together with its seed value via `data/site-content.json` + `npm run sync-seed`, before continuing.

- [ ] **Step 2: Establish what is structurally missing today**

With `npm run dev` running:

```bash
curl -s "http://localhost:3000/welcome/latin?b=batch-rp8nn4" | grep -o 'href="tel:[^"]*"\|instagram.com/furorhyd\|Free - Valet parking'
```

Expected: **no output at all.** `WelcomeView` receives no phone, no Instagram handle and no parking notes — two of the four contact channels the brief names are structurally absent from the props, not merely un-editable.

- [ ] **Step 3: Widen `BatchBundle` and `Props`**

In `src/app/welcome/[track]/WelcomeView.tsx`, find:

```ts
  icsHref: string | null;
}
```

and replace it with:

```ts
  // Derived from the batch's studio record, never hand-typed — hand-typing is
  // exactly what put "Alcazar Mall, Jubilee Hills" on a confirmation for a
  // batch at HUDA Colony.
  studioName: string;
  parkingNotes: string;
  telephone: string; // display form, e.g. "+91 88860 72572"
  telHref: string; // "tel:+918886072572", or '' when there is no number
  icsHref: string | null;
  // welcomeNoteFor(batch, track): the batch's own note, else the track default.
  noteHeadline: string;
  noteBody: string;
}
```

Then find, inside `interface Props`:

```ts
  vcardHref: string;
```

and replace it with:

```ts
  vcardHref: string;
  /** Cross-cutting editable copy (Plan 1). The contact-block row labels come
   *  from here, per spec §3.3. */
  labels: Labels;
  instagramHandle: string;
```

- [ ] **Step 4: Import the label helper**

In the same file, find:

```ts
import type { Welcome } from '@/lib/content-schema';
```

and replace it with:

```ts
import type { Labels, Welcome } from '@/lib/content-schema';
import { label } from '@/lib/labels';
```

- [ ] **Step 5: Destructure the new props and bundle fields**

In the same file, find (inside the `WelcomeView` parameter list):

```ts
  vcardHref,
```

and replace it with:

```ts
  vcardHref,
  labels,
  instagramHandle,
```

Then find:

```ts
  const { intakeDate, whenDays, whenTime, arriveBy, venue, mapUrl, gcalUrl, icsHref } = bundle;
```

and replace it with:

```ts
  const {
    intakeDate,
    whenDays,
    whenTime,
    arriveBy,
    venue,
    studioName,
    parkingNotes,
    telephone,
    telHref,
    mapUrl,
    gcalUrl,
    icsHref,
    noteHeadline,
    noteBody,
  } = bundle;
```

- [ ] **Step 6: Render the post-payment note directly under the confirmation hero**

In the same file, find:

```tsx
      {/* The two immediate steps */}
```

and replace it with:

```tsx
      {/* Post-payment message — the ONLY free text on this page. Everything
          else is derived, so the studio can say anything warm it likes and
          still cannot make the address wrong. */}
      {noteBody ? (
        <section className="container-x pb-2">
          <Reveal className="rounded-3xl border border-ember-500/30 bg-ember-500/5 p-7 sm:p-8">
            {noteHeadline ? (
              <p className="display text-lg font-bold">{noteHeadline}</p>
            ) : null}
            <p className="mt-2 whitespace-pre-line leading-relaxed text-cream/85">{noteBody}</p>
          </Reveal>
        </section>
      ) : null}

      {/* The two immediate steps */}
```

- [ ] **Step 7: Replace the "Where" cell with the full derived location**

In the same file, find this exact block inside the intake grid:

```tsx
              <p className="text-xs uppercase tracking-widest text-cream/70">Where</p>
              <p className="mt-2 leading-relaxed text-cream/85">
                {venue || 'We’ll share the exact address on WhatsApp.'}
              </p>
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary mt-4 inline-flex"
                >
                  Open map →
                </a>
              ) : null}
```

and replace it with:

```tsx
              <p className="text-xs uppercase tracking-widest text-cream/70">
                {label(labels, 'welcomeWhereHeading')}
              </p>
              {studioName ? (
                <p className="mt-2 font-semibold text-cream">{studioName}</p>
              ) : null}
              <p className="mt-1 leading-relaxed text-cream/85">
                {/* Plan 4 turns this last literal into welcome.noVenueNote. */}
                {venue || 'We’ll share the exact address on WhatsApp.'}
              </p>
              {parkingNotes ? (
                <p className="mt-2 text-sm text-cream/60">
                  <Filled
                    template={label(labels, 'welcomeParking')}
                    vars={{ notes: parkingNotes }}
                    classNames={{ notes: 'text-cream/60' }}
                  />
                </p>
              ) : null}
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary mt-4 inline-flex"
                >
                  {label(labels, 'welcomeOpenMap')}
                </a>
              ) : null}
```

- [ ] **Step 8: Add the contact strip**

In the same file, find:

```tsx
      {/* Sign-off */}
```

and replace it with:

```tsx
      {/* Reach us — phone from the studio record, WhatsApp from site settings,
          Instagram from site.instagramHandle. No hand-typed contact details.
          Each row renders only when its source field is set, so an incomplete
          studio record leaves a gap rather than a dead link. */}
      <section className="container-x pb-4">
        <Reveal className="rounded-3xl border border-cream/10 bg-ink-900/40 p-8 sm:p-10">
          <p className="display text-sm uppercase tracking-widest text-ember-400">
            {label(labels, 'welcomeReachUs')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {telHref ? (
              <a href={telHref} className="btn-secondary inline-flex">
                <Filled
                  template={label(labels, 'welcomeCallPhone')}
                  vars={{ phone: telephone }}
                  classNames={{ phone: 'font-semibold' }}
                />
              </a>
            ) : null}
            <a
              href={waText(confirmMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex"
            >
              {label(labels, 'ctaChatWhatsapp')}
            </a>
            {instagramHandle ? (
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex"
              >
                {label(labels, 'ctaDmInstagram')}
              </a>
            ) : null}
          </div>
        </Reveal>
      </section>

      {/* Sign-off */}
```

- [ ] **Step 9: Fill the new bundle fields on the server**

In `src/app/welcome/[track]/page.tsx`, find this exact block inside `buildBundle`:

```ts
    return {
      id: batch?.id ?? '',
      startDate: batch?.startDate ?? '',
      intakeDate,
      whenDays,
      whenTime,
      arriveBy,
      venue,
      mapUrl,
      gcalUrl,
      icsHref,
    };
```

and replace it with:

```ts
    const note = welcomeNoteFor(batch, cfg);
    return {
      id: batch?.id ?? '',
      startDate: batch?.startDate ?? '',
      intakeDate,
      whenDays,
      whenTime,
      arriveBy,
      venue,
      studioName: studio?.name ?? '',
      parkingNotes: studio?.parkingNotes ?? '',
      telephone: studio?.telephone ?? '',
      telHref: studio ? telHref(studio.telephone) : '',
      mapUrl,
      gcalUrl,
      icsHref,
      noteHeadline: note.headline,
      noteBody: note.body,
    };
```

- [ ] **Step 10: Extend the import and pass the two new props**

In the same file, find the import added in Task 4:

```ts
import {
  buildWelcomeOptions,
  resolveWelcomeBatch,
  resolveWelcomeStudio,
} from '@/lib/welcome-resolve';
```

and replace it with:

```ts
import {
  buildWelcomeOptions,
  resolveWelcomeBatch,
  resolveWelcomeStudio,
  telHref,
  welcomeNoteFor,
} from '@/lib/welcome-resolve';
```

Then find:

```tsx
      waDisplay={formatPhoneDisplay(wa)}
```

and replace it with:

```tsx
      waDisplay={formatPhoneDisplay(wa)}
      labels={content.labels}
      instagramHandle={content.site.instagramHandle}
```

- [ ] **Step 11: Verify**

Run: `npm run typecheck`
Expected: exits 0 with no output.

With `npm run dev` running:

```bash
curl -s "http://localhost:3000/welcome/latin?b=batch-rp8nn4" | grep -o 'href="tel:+918886072572"\|instagram.com/furorhyd\|Free - Valet parking\|PUP Unleash - HUDA Colony\|Open map\|Reach us'
```

Expected: all six strings appear — `href="tel:+918886072572"`, `instagram.com/furorhyd`, `Free - Valet parking`, `PUP Unleash - HUDA Colony`, `Open map`, `Reach us`. Before this task, the first three produced no output at all (Step 2). `Open map` was already on the page as a hardcoded literal and must still read exactly `Open map →` — that is the point of `welcomeOpenMap` defaulting to the shipping copy rather than to `Get directions →`.

- [ ] **Step 12: Commit**

```bash
git add src/app/welcome/[track]/page.tsx src/app/welcome/[track]/WelcomeView.tsx
git commit -m "feat: derived location, directions, phone and instagram on the confirmation page"
```

---

### Task 6: Stamp new batches with the IST business date

**Files:**
- Modify: `src/app/admin/batches/BatchesEditor.tsx` (anchors: `import { randomId } from '@/lib/id';`; `      startDate: new Date().toISOString().slice(0, 10),`)
- Test: a shell assertion plus a manual check. **No automated regression cover** — `add()` is a React event handler in a client component and this repo renders no components in tests.

**Interfaces:**
- Consumes: `todayIso()` from `src/lib/format.ts` (UTC+5:30).

- [ ] **Step 1: Prove the bug is reachable**

Run:

```bash
node -e "
const IST=5.5*60*60*1000;
const at=(iso)=>{const t=Date.parse(iso);return {utc:new Date(t).toISOString().slice(0,10), ist:new Date(t+IST).toISOString().slice(0,10)};};
console.log(JSON.stringify(at('2026-08-10T19:00:00Z')));
"
```

Expected: `{"utc":"2026-08-10","ist":"2026-08-11"}` — at 00:30 IST the two disagree. `visibleBatches` filters on `todayIso()` (IST), so a batch created between 00:00 and 05:30 IST is stamped *yesterday* and is invisible the instant it is saved.

- [ ] **Step 2: Use `todayIso()` in `add()`**

In `src/app/admin/batches/BatchesEditor.tsx`, find:

```ts
import { randomId } from '@/lib/id';
```

and replace it with:

```ts
import { randomId } from '@/lib/id';
import { todayIso } from '@/lib/format';
```

Then find:

```ts
      startDate: new Date().toISOString().slice(0, 10),
```

and replace it with:

```ts
      // todayIso(), not toISOString(): visibleBatches filters on the IST
      // business date, so a UTC stamp makes a batch created between 00:00 and
      // 05:30 IST invisible the moment it is saved.
      startDate: todayIso(),
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run typecheck && ! grep -q "toISOString" src/app/admin/batches/BatchesEditor.tsx && echo OK
```

Expected: `tsc` prints nothing, then `OK`, and the command exits 0. (`! grep -q` rather than `grep -c`: `grep` exits non-zero on zero matches, which a runner reads as a failed step.)

Manual: with `npm run dev` running, open `/admin/batches`, click **+ Add batch**, and confirm the new card's **Start date** field shows today's date in Hyderabad. Do not save.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/batches/BatchesEditor.tsx
git commit -m "fix: stamp new batches with the IST business date so they are visible on save"
```

---

### Task 7: Admin — welcome-page select, post-payment message, track defaults

**Files:**
- Modify: `src/app/admin/batches/BatchesEditor.tsx` (anchors: `  const branchOptions = c.studios.map((s) => ({ value: s.slug, label: s.name }));`; the whole `add()` function; `            <Field label="Razorpay pre-register link (optional)">`)
- Modify: `src/components/admin/WelcomePageEditor.tsx` (anchor: `                <Field label="SEO description" hint="Shown in the browser tab / link previews.">`)
- Test: manual verification in `/admin/batches` and `/admin/pages/welcome`. **Form markup, no automated cover** — the placeholder's resolution rule is pinned by `welcomeNoteFor` (Task 2), the field wiring is not.

**Important — do NOT add an import for `Field` or `Select`.** Both are **locally defined at the bottom of `BatchesEditor.tsx`** (`function Field({ label, hint, children })` and `function Select({ label, value, onChange, options })`). Importing anything of those names from `@/components/admin/fields` shadows the local definitions and changes the rendered markup.

**Interfaces:**
- Consumes: `Batch['welcomeTrackKey' | 'welcomeNote']`, `WelcomeTrack['noteHeadline' | 'noteBody']` from Task 1.
- Produces: a newly added batch is stamped with a real `welcomeTrackKey` at creation time.

- [ ] **Step 1: Add the track option list and the creation-time guess**

In `src/app/admin/batches/BatchesEditor.tsx`, find:

```ts
  const branchOptions = c.studios.map((s) => ({ value: s.slug, label: s.name }));
```

and replace it with:

```ts
  const branchOptions = c.studios.map((s) => ({ value: s.slug, label: s.name }));
  const trackOptions = [
    { value: '', label: '— none —' },
    ...c.welcome.tracks.map((t) => ({ value: t.key, label: t.trackLabel || t.key })),
  ];
  // The batch's welcome page is STORED, not re-derived at render time. This
  // only seeds a sensible first guess when the batch is created; the select
  // below is the source of truth from then on.
  function trackKeyForStyles(styleSlugs: string[]): string {
    return c.welcome.tracks.find((t) => t.styleSlugs.some((s) => styleSlugs.includes(s)))?.key ?? '';
  }
```

- [ ] **Step 2: Stamp the key on creation**

In the same file, find this exact block (it is the post-Task-1, post-Task-6 form of `add()`):

```ts
  function add() {
    const fresh: Batch = {
      id: randomId('batch'),
      styleSlugs: c.danceStyles[0]?.slug ? [c.danceStyles[0].slug] : ['salsa'],
      level: 'Foundation',
      branchSlug: c.studios[0]?.slug || 'jubilee-hills',
      daysOfWeek: ['Sat', 'Sun'],
      time: '9:30–10:30 AM',
      // todayIso(), not toISOString(): visibleBatches filters on the IST
      // business date, so a UTC stamp makes a batch created between 00:00 and
      // 05:30 IST invisible the moment it is saved.
      startDate: todayIso(),
      priceInr: 6500,
      reservationInr: 500,
      seatsLeft: null,
      status: 'Open',
      razorpayLink: null,
      welcomeTrackKey: '',
      welcomeNote: '',
    };
    setC((prev) => ({ ...prev, batches: [fresh, ...prev.batches] }));
    setDirty(true);
  }
```

and replace it with:

```ts
  function add() {
    const styleSlugs = c.danceStyles[0]?.slug ? [c.danceStyles[0].slug] : ['salsa'];
    const fresh: Batch = {
      id: randomId('batch'),
      styleSlugs,
      level: 'Foundation',
      branchSlug: c.studios[0]?.slug || 'jubilee-hills',
      daysOfWeek: ['Sat', 'Sun'],
      time: '9:30–10:30 AM',
      // todayIso(), not toISOString(): visibleBatches filters on the IST
      // business date, so a UTC stamp makes a batch created between 00:00 and
      // 05:30 IST invisible the moment it is saved.
      startDate: todayIso(),
      priceInr: 6500,
      reservationInr: 500,
      seatsLeft: null,
      status: 'Open',
      razorpayLink: null,
      // Stamped at creation so the post-payment message field is visibly
      // present the moment a batch exists — the literal ask in the brief.
      welcomeTrackKey: trackKeyForStyles(styleSlugs),
      welcomeNote: '',
    };
    setC((prev) => ({ ...prev, batches: [fresh, ...prev.batches] }));
    setDirty(true);
  }
```

- [ ] **Step 3: Add the two fields to the batch card**

In the same file, find:

```tsx
            <Field label="Razorpay pre-register link (optional)">
```

and replace it with:

```tsx
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Welcome page"
                value={b.welcomeTrackKey}
                onChange={(v) => patch(i, { welcomeTrackKey: v })}
                options={trackOptions}
              />
              <Field
                label="Post-payment message"
                hint="Shown on the confirmation page after payment. Leave blank to use the welcome page's default."
              >
                <textarea
                  rows={3}
                  value={b.welcomeNote}
                  onChange={(e) => patch(i, { welcomeNote: e.target.value })}
                  placeholder={
                    c.welcome.tracks.find((t) => t.key === b.welcomeTrackKey)?.noteBody ||
                    'e.g. Bring a friend — the first class is easier in pairs.'
                  }
                  className="input"
                />
              </Field>
            </div>

            <Field label="Razorpay pre-register link (optional)">
```

- [ ] **Step 4: Add the track-level default note**

In `src/components/admin/WelcomePageEditor.tsx`, find:

```tsx
                <Field label="SEO description" hint="Shown in the browser tab / link previews.">
                  <input
                    value={t.metaDesc}
                    onChange={(e) => patchTrackAt(i, { metaDesc: e.target.value })}
                    className="input"
                  />
                </Field>
```

and replace it with:

```tsx
                <Field label="SEO description" hint="Shown in the browser tab / link previews.">
                  <input
                    value={t.metaDesc}
                    onChange={(e) => patchTrackAt(i, { metaDesc: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field
                  label="Post-payment note — headline"
                  hint="Shown above the message on every confirmation for this track."
                >
                  <input
                    value={t.noteHeadline}
                    onChange={(e) => patchTrackAt(i, { noteHeadline: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field
                  label="Post-payment note — default message"
                  hint="Used for any batch on this track that has no message of its own."
                >
                  <textarea
                    rows={3}
                    value={t.noteBody}
                    onChange={(e) => patchTrackAt(i, { noteBody: e.target.value })}
                    className="input"
                  />
                </Field>
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: exits 0 with no output.

With `npm run dev` running, in a browser:

1. Open `/admin/pages/welcome`. On the **Latin beginner class** track, type `A note from Rish` into **Post-payment note — headline** and `Come 15 minutes early and say hi at the desk.` into **Post-payment note — default message**. Save.
2. Open `/admin/batches`. Every card now shows a **Welcome page** select and a **Post-payment message** textarea. Confirm the card for `batch-rp8nn4` reads `Latin beginner class` and its textarea's grey placeholder reads exactly `Come 15 minutes early and say hi at the desk.`
3. Confirm the **Intermediate** salsa card (`batch-004`) also reads `Latin beginner class` — the track is the confirmation *page*, not the class level.
4. Click **+ Add batch**. Confirm the new card's **Welcome page** select is already `Latin beginner class`, not `— none —`. Delete the test card without saving.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/batches/BatchesEditor.tsx src/components/admin/WelcomePageEditor.tsx
git commit -m "feat: welcome-page select and post-payment message on every batch card"
```

---

### Task 8: `hiddenReason` and the past-start-date warning

**Files:**
- Modify: `src/lib/content-helpers.ts` (anchor: the whole `visibleBatches` function)
- Modify: `src/lib/content.ts` (anchor: `  visibleBatches,`)
- Modify: `src/app/admin/batches/BatchesEditor.tsx` (anchors: `import { todayIso } from '@/lib/format';`; `          <div key={b.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">`)
- Test: `src/lib/content-helpers.test.ts`

**Interfaces:**
- Produces: `export function hiddenReason(batch: { startDate: string; status: string }): string | null` — the single expression of the public-visibility rule, now also used by `visibleBatches`.

- [ ] **Step 1: Write the failing test**

If `src/lib/content-helpers.test.ts` does not exist, create it with exactly this content. If an earlier plan already created it, **append** the `describe` block and make sure the imports and the two module-level helpers (`batch`, `content`) exist exactly once (R4).

```ts
import { describe, expect, it } from 'vitest';
import type { SiteContent } from './content-schema';
import { hiddenReason, visibleBatches } from './content-helpers';

// 2099 is always upcoming and 2020 always past, so nothing here depends on
// the wall clock.
type Row = {
  id: string;
  styleSlugs: string[];
  level: 'Foundation' | 'Intermediate' | 'Advanced';
  startDate: string;
  status: 'Open' | 'Filling Fast' | 'Closed';
};

const batch = (over: Partial<Row> & { id: string }): Row => ({
  styleSlugs: ['salsa'],
  level: 'Foundation',
  startDate: '2099-01-01',
  status: 'Open',
  ...over,
});

const content = (batches: Row[]) => ({ batches }) as unknown as SiteContent;

describe('hiddenReason', () => {
  it('returns null for an open, upcoming batch', () => {
    expect(hiddenReason(batch({ id: 'ok' }))).toBeNull();
  });

  // The guard that stops five of six batches silently going stale again.
  it('names a past start date', () => {
    expect(hiddenReason(batch({ id: 'past', startDate: '2020-01-01' }))).toBe(
      'This batch is hidden from the site (start date has passed).',
    );
  });

  it('names a Closed status ahead of the date', () => {
    expect(hiddenReason(batch({ id: 'shut', status: 'Closed' }))).toBe(
      'This batch is hidden from the site (status is Closed).',
    );
  });

  // One rule, two readers: the admin warning must never disagree with what
  // the public site actually shows.
  it('agrees with visibleBatches', () => {
    const rows = [
      batch({ id: 'ok' }),
      batch({ id: 'past', startDate: '2020-01-01' }),
      batch({ id: 'shut', status: 'Closed' }),
    ];
    expect(visibleBatches(content(rows)).map((b) => b.id)).toEqual(
      rows.filter((b) => hiddenReason(b) === null).map((b) => b.id),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/content-helpers.test.ts`
Expected: FAIL — 4 failed (4), `TypeError: hiddenReason is not a function`. (If your vite build surfaces the missing export at link time instead, the file is reported as failed with `SyntaxError: The requested module './content-helpers' does not provide an export named 'hiddenReason'` — both are the intended red.)

- [ ] **Step 3: Add `hiddenReason` and route `visibleBatches` through it**

In `src/lib/content-helpers.ts`, find:

```ts
export function visibleBatches(content: SiteContent) {
  const today = todayIso();
  return content.batches
    .filter((b) => b.startDate >= today && b.status !== 'Closed')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
```

and replace it with:

```ts
/**
 * Why a batch is absent from the public site, or null when it is visible.
 *
 * The public rule and the admin warning must be the same rule: five of six
 * live batches quietly aged out of the site with nothing anywhere saying so.
 */
export function hiddenReason(batch: { startDate: string; status: string }): string | null {
  if (batch.status === 'Closed') return 'This batch is hidden from the site (status is Closed).';
  if (batch.startDate < todayIso()) {
    return 'This batch is hidden from the site (start date has passed).';
  }
  return null;
}

export function visibleBatches(content: SiteContent) {
  return content.batches
    .filter((b) => hiddenReason(b) === null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/content-helpers.test.ts`
Expected: PASS — 4 passed (4).

- [ ] **Step 5: Re-export it and show the warning on the batch card**

In `src/lib/content.ts`, find:

```ts
  visibleBatches,
```

and replace it with:

```ts
  visibleBatches,
  hiddenReason,
```

In `src/app/admin/batches/BatchesEditor.tsx`, find:

```ts
import { todayIso } from '@/lib/format';
```

and replace it with:

```ts
import { todayIso } from '@/lib/format';
import { hiddenReason } from '@/lib/content-helpers';
```

Then find:

```tsx
          <div key={b.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
```

and replace it with:

```tsx
          <div key={b.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
            {hiddenReason(b) ? (
              <p className="rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-2 text-xs text-gold-300">
                {hiddenReason(b)}
              </p>
            ) : null}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npx vitest run src/lib/content-helpers.test.ts`
Expected: `tsc` exits 0 with no output; vitest PASS — 4 passed (4).

Manual: with `npm run dev` running, open `/admin/batches`. Every card whose **Start date** is before today in Hyderabad shows the amber notice `This batch is hidden from the site (start date has passed).` With the data as shipped on 2026-08-10 that is exactly **five** cards — every batch except `batch-ua7f9x`, which starts 2026-08-29. If the owner has already updated start dates, the count follows the data; the rule is what is being checked, not the number.

- [ ] **Step 7: Commit**

```bash
git add src/lib/content-helpers.ts src/lib/content-helpers.test.ts src/lib/content.ts src/app/admin/batches/BatchesEditor.tsx
git commit -m "feat: warn on the batch card when a batch is hidden from the public site"
```

---

### Task 9: `RazorpayRedirectHint` reads the stored key

**Files:**
- Modify: `src/app/admin/batches/BatchesEditor.tsx` (anchors: `            <RazorpayRedirectHint batch={b} tracks={c.welcome.tracks} />`; the component's leading comment through its `const url = …` line; the trailing `?d=` footnote; `import { hiddenReason } from '@/lib/content-helpers';`)
- Test: covered by `welcomeRedirectPath` in `src/lib/welcome-resolve.test.ts` (Task 2), plus a manual check

**Interfaces:**
- Consumes: `welcomeRedirectPath(batch): string | null` from Task 2.

- [ ] **Step 1: Confirm the contract the component must now use**

Run: `npx vitest run src/lib/welcome-resolve.test.ts -t "builds the pinned redirect"`
Expected: PASS — 1 passed. The component currently re-derives the track with `tracks.find((t) => t.styleSlugs.some((s) => batch.styleSlugs.includes(s)))`, which for `batch-004` (Intermediate salsa) returns the **Latin beginner** track by style overlap and hands out a beginner-intake URL. From here the track comes from the stored key instead.

- [ ] **Step 2: Update the call site**

In `src/app/admin/batches/BatchesEditor.tsx`, find:

```tsx
            <RazorpayRedirectHint batch={b} tracks={c.welcome.tracks} />
```

and replace it with:

```tsx
            <RazorpayRedirectHint batch={b} />
```

- [ ] **Step 3: Rewrite the component head**

In the same file, find this exact block:

```tsx
// Tells the studio admin which exact URL to paste into Razorpay as the
// "redirect after payment" — pinning the welcome page to THIS batch's date so
// two batches of the same style don't get conflated.
function RazorpayRedirectHint({
  batch,
  tracks,
}: {
  batch: Batch;
  tracks: SiteContent['welcome']['tracks'];
}) {
  const [copied, setCopied] = useState(false);
  const matchingTrack = tracks.find((t) => t.styleSlugs.some((s) => batch.styleSlugs.includes(s)));
  if (!matchingTrack) {
    return (
      <p className="text-xs text-cream/50">
        No welcome page matches this batch&apos;s styles yet — add one in{' '}
        <a href="/admin/pages/welcome" className="text-ember-400 hover:text-ember-300">
          Welcome pages
        </a>{' '}
        to enable a post-payment redirect.
      </p>
    );
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/welcome/${matchingTrack.key}?d=${batch.startDate}&b=${batch.id}`;
```

and replace it with:

```tsx
// Tells the studio admin which exact URL to paste into Razorpay as the
// "redirect after payment". The track comes from the batch's STORED
// welcomeTrackKey — the old style-overlap guess handed Intermediate customers
// a beginner-intake URL, and the confirmation page then showed them another
// batch's date, venue and calendar file.
function RazorpayRedirectHint({ batch }: { batch: Batch }) {
  const [copied, setCopied] = useState(false);
  const path = welcomeRedirectPath(batch);
  if (!path) {
    return (
      <p className="text-xs text-cream/50">
        No welcome page selected for this batch — pick one in the{' '}
        <strong className="text-cream/70">Welcome page</strong> field above, or add one in{' '}
        <a href="/admin/pages/welcome" className="text-ember-400 hover:text-ember-300">
          Welcome pages
        </a>
        , to enable a post-payment redirect.
      </p>
    );
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}${path}`;
```

- [ ] **Step 4: Correct the footnote**

In the same file, find:

```tsx
      <p className="mt-2 text-cream/40">
        The <code>?d=</code> param pins the welcome page to this batch&apos;s start date, so two
        batches of the same style stay distinct.
      </p>
```

and replace it with:

```tsx
      <p className="mt-2 text-cream/40">
        The <code>?b=</code> param pins the confirmation to THIS batch — its level, venue and
        time. <code>?d=</code> is kept so links minted before this change keep working.
      </p>
```

- [ ] **Step 5: Add the import**

In the same file, find:

```ts
import { hiddenReason } from '@/lib/content-helpers';
```

and replace it with:

```ts
import { hiddenReason } from '@/lib/content-helpers';
import { welcomeRedirectPath } from '@/lib/welcome-resolve';
```

`SiteContent` remains imported and remains used by `BatchesEditor`'s own props — do not remove it.

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: exits 0 with no output.

Manual: with `npm run dev` running, open `/admin/batches` and find the **Intermediate** salsa card (`batch-004`). Its redirect URL must end with `?d=2026-07-04&b=batch-004`. Then set that card's **Welcome page** select to `— none —`: the code block is replaced by the `No welcome page selected for this batch` notice. Set it back to `Latin beginner class` and do **not** save.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/batches/BatchesEditor.tsx
git commit -m "fix: razorpay redirect hint reads the batch's stored welcome track"
```

---

### Task 10: Write-path integrity check for `welcomeTrackKey`

Cross-record validation belongs in `integrity.ts` and **never** in a Zod refine (R3, spec §3.4.3). One of the four cases below exists specifically to pin that.

**Files:**
- Modify: `src/lib/integrity.ts` (anchors: the whole `rowsOf` function; `  const studios = slugSet(doc, 'studios');`; the `rowsOf(doc, 'batches').forEach` block)
- Modify: `src/lib/integrity.test.ts` (anchor: `import { integrityIssues } from './integrity';`; append a new `describe`)

**Interfaces:**
- Produces: `integrityIssues(doc)` now reports `{ path: ['batches', i, 'welcomeTrackKey'], message: 'Unknown welcome page "<key>"' }`.

- [ ] **Step 1: Write the failing test**

In `src/lib/integrity.test.ts`, find:

```ts
import { integrityIssues } from './integrity';
```

and replace it with:

```ts
import { integrityIssues } from './integrity';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';
```

Then append at the end of the file (the `check` helper is a module-level const, so an appended `describe` can use it):

```ts
describe('integrityIssues — welcome track references', () => {
  const withKey = (welcomeTrackKey: string) => ({
    danceStyles: [{ id: 'st_1', slug: 'salsa' }],
    studios: [{ id: 'sd_1', slug: 'jubilee-hills', styleSlugs: ['salsa'] }],
    batches: [{ id: 'b_1', styleSlugs: ['salsa'], branchSlug: 'jubilee-hills', welcomeTrackKey }],
    welcome: { tracks: [{ key: 'latin' }, { key: 'wcs' }] },
  });

  it('accepts a batch pointed at a real welcome track', () => {
    expect(check(withKey('latin'))).toEqual([]);
  });

  // A dangling key sends a paying customer to a 404 confirmation page.
  it('flags a batch pointed at a welcome track that does not exist', () => {
    expect(check(withKey('kizomba'))).toEqual([
      expect.objectContaining({ path: ['batches', 0, 'welcomeTrackKey'] }),
    ]);
  });

  it('allows the empty default, so an unmigrated batch never blocks a save', () => {
    expect(check(withKey(''))).toEqual([]);
  });

  // THE reason this is a write-path check and not a Zod .refine(): a read-path
  // refine would fail SiteContentSchema.parse() inside getContent(), whose
  // catch returns the bundled seed — so one bad batch would replace the ENTIRE
  // public site with seed content. As a write-path check the same violation
  // merely refuses the save.
  it('never fails a read — a bad welcomeTrackKey still parses', () => {
    const raw = JSON.parse(JSON.stringify(seed));
    raw.batches[0].welcomeTrackKey = 'no-such-track';
    expect(SiteContentSchema.safeParse(raw).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/integrity.test.ts`
Expected: FAIL — **1 failed, 11 passed** (the file had 8 tests; four are appended). The failure is `flags a batch pointed at a welcome track that does not exist`: `AssertionError: expected [] to deeply equal [ ObjectContaining {…} ]`.

- [ ] **Step 3: Add the check**

In `src/lib/integrity.ts`, find:

```ts
function rowsOf(doc: Doc, key: string): Row[] {
  const value = doc[key];
  return Array.isArray(value) ? (value as Row[]) : [];
}
```

and replace it with:

```ts
function rowsOf(doc: Doc, key: string): Row[] {
  const value = doc[key];
  return Array.isArray(value) ? (value as Row[]) : [];
}

/** Rows of a nested array, e.g. welcome.tracks. */
function nestedRows(doc: Doc, key: string, sub: string): Row[] {
  const parent = doc[key];
  if (parent == null || typeof parent !== 'object') return [];
  const value = (parent as Doc)[sub];
  return Array.isArray(value) ? (value as Row[]) : [];
}
```

Then find:

```ts
  const studios = slugSet(doc, 'studios');
```

and replace it with:

```ts
  const studios = slugSet(doc, 'studios');
  // welcome.tracks is keyed by `key`, not `slug` (see collections.ts).
  const welcomeTracks = new Set(
    nestedRows(doc, 'welcome', 'tracks')
      .map((t) => t.key)
      .filter((k): k is string => typeof k === 'string' && k !== ''),
  );
```

Then find:

```ts
  rowsOf(doc, 'batches').forEach((b, i) => {
    checkMany(b.styleSlugs, styles, 'dance style', ['batches', i, 'styleSlugs']);
    checkOne(b.branchSlug, studios, 'studio', ['batches', i, 'branchSlug']);
  });
```

and replace it with:

```ts
  rowsOf(doc, 'batches').forEach((b, i) => {
    checkMany(b.styleSlugs, styles, 'dance style', ['batches', i, 'styleSlugs']);
    checkOne(b.branchSlug, studios, 'studio', ['batches', i, 'branchSlug']);
    // Empty is the migration default and is skipped by checkOne — an
    // unstamped batch must never block someone else's save.
    checkOne(b.welcomeTrackKey, welcomeTracks, 'welcome page', ['batches', i, 'welcomeTrackKey']);
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/integrity.test.ts`
Expected: PASS — 12 passed (12).

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrity.ts src/lib/integrity.test.ts
git commit -m "feat: refuse a save that points a batch at a missing welcome page"
```

---

### Task 11: Level-aware `nextBatchPerStyle`

**Files:**
- Modify: `src/lib/content-helpers.ts` (anchors: `import type { SiteContent } from './content-schema';`; the whole `nextBatchPerStyle` function)
- Modify: `src/lib/content.ts` (anchor: `  nextBatchPerStyle,`)
- Modify: `src/app/page.tsx` (anchors: `nextBatchPerStyle, visibleBatches`; `            const b = nextPerStyle.get(s.slug);`; the `{b && branch ? (` opening)
- Test: `src/lib/content-helpers.test.ts` (append)

**Interfaces:**
- Produces (fixed by the shared contract — **breaking shape change**, every call site updated in this task):
```ts
export function nextBatchPerStyle(
  content: SiteContent,
): Map<string, { batch: Batch; isFallback: boolean }>;
export function fallbackLevelNote(level: string): string;
```
- Call sites, all of them: `src/lib/content.ts` (re-export only) and `src/app/page.tsx` (one consumer, inside the "Next batches" strip).
- **`src/lib/batch-order.ts` and `src/lib/batch-order.test.ts` are NOT touched.**

- [ ] **Step 1: Write the failing test**

In `src/lib/content-helpers.test.ts`, find:

```ts
import { hiddenReason, visibleBatches } from './content-helpers';
```

and replace it with:

```ts
import {
  fallbackLevelNote,
  hiddenReason,
  nextBatchPerStyle,
  visibleBatches,
} from './content-helpers';
```

Then append at the end of the file:

```ts
describe('nextBatchPerStyle', () => {
  // The strip was date-only, so it could front an Advanced Bachata card to a
  // first-timer. compareByLevel already sorts the boards; this surface did not.
  it('prefers the soonest Foundation batch over a sooner higher level', () => {
    const map = nextBatchPerStyle(
      content([
        batch({ id: 'adv', level: 'Advanced', startDate: '2099-01-01' }),
        batch({ id: 'found', level: 'Foundation', startDate: '2099-06-01' }),
      ]),
    );
    expect(map.get('salsa')?.batch.id).toBe('found');
    expect(map.get('salsa')?.isFallback).toBe(false);
  });

  // Honesty over hiding: an experienced dancer should still find their lane.
  it('falls back to a higher level and flags it when no Foundation batch exists', () => {
    const map = nextBatchPerStyle(content([batch({ id: 'int', level: 'Intermediate' })]));
    expect(map.get('salsa')?.batch.id).toBe('int');
    expect(map.get('salsa')?.isFallback).toBe(true);
  });

  it('picks the soonest of two Foundation batches', () => {
    const map = nextBatchPerStyle(
      content([
        batch({ id: 'late', startDate: '2099-09-01' }),
        batch({ id: 'early', startDate: '2099-02-01' }),
      ]),
    );
    expect(map.get('salsa')?.batch.id).toBe('early');
  });

  it('indexes a combined batch under every style it teaches', () => {
    const map = nextBatchPerStyle(
      content([batch({ id: 'combo', styleSlugs: ['salsa', 'bachata'] })]),
    );
    expect(map.get('salsa')?.batch.id).toBe('combo');
    expect(map.get('bachata')?.batch.id).toBe('combo');
  });

  it('leaves a style out entirely when every batch for it is hidden', () => {
    const map = nextBatchPerStyle(content([batch({ id: 'past', startDate: '2020-01-01' })]));
    expect(map.get('salsa')).toBeUndefined();
  });
});

describe('fallbackLevelNote', () => {
  it('labels the level honestly instead of hiding it', () => {
    expect(fallbackLevelNote('Intermediate')).toBe('Intermediate — danced before?');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/content-helpers.test.ts`
Expected: FAIL — 6 failed, 4 passed. The six new cases fail because `fallbackLevelNote` does not exist and the map still holds bare batches: `TypeError: fallbackLevelNote is not a function` and `TypeError: Cannot read properties of undefined (reading 'id')` on `map.get('salsa')?.batch.id`. (If your vite build surfaces the missing export at link time, the file is reported as failed with `SyntaxError: The requested module './content-helpers' does not provide an export named 'fallbackLevelNote'` — both are the intended red.)

- [ ] **Step 3: Rewrite the helper**

In `src/lib/content-helpers.ts`, find:

```ts
import type { SiteContent } from './content-schema';
```

and replace it with:

```ts
import type { Batch, SiteContent } from './content-schema';
```

Then find:

```ts
export function nextBatchPerStyle(content: SiteContent) {
  const map = new Map<string, ReturnType<typeof visibleBatches>[number]>();
  for (const b of visibleBatches(content)) {
    for (const slug of b.styleSlugs) {
      if (!map.has(slug)) map.set(slug, b);
    }
  }
  return map;
}
```

and replace it with:

```ts
/**
 * One card per style for the home page's "Next batches" strip.
 *
 * Soonest FOUNDATION batch per style, falling back to the soonest of any
 * level when there is no Foundation batch — with `isFallback` set, so the
 * card can say so rather than silently offering an Advanced class to someone
 * who has never danced.
 */
export function nextBatchPerStyle(
  content: SiteContent,
): Map<string, { batch: Batch; isFallback: boolean }> {
  const map = new Map<string, { batch: Batch; isFallback: boolean }>();
  // visibleBatches is already soonest-first, so the first Foundation batch we
  // see for a style is the soonest Foundation batch for that style.
  for (const b of visibleBatches(content)) {
    const isFoundation = b.level === 'Foundation';
    for (const slug of b.styleSlugs) {
      const held = map.get(slug);
      if (!held) map.set(slug, { batch: b, isFallback: !isFoundation });
      else if (held.isFallback && isFoundation) map.set(slug, { batch: b, isFallback: false });
    }
  }
  return map;
}

/** Honest label for a card that could only offer a higher level. */
export function fallbackLevelNote(level: string): string {
  return `${level} — danced before?`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/content-helpers.test.ts`
Expected: PASS — 10 passed (10).

- [ ] **Step 5: Update the re-export and the one real call site**

In `src/lib/content.ts`, find:

```ts
  nextBatchPerStyle,
```

and replace it with:

```ts
  nextBatchPerStyle,
  fallbackLevelNote,
```

In `src/app/page.tsx`, find this substring inside the existing `@/lib/content` import (deliberately a substring, so the edit survives whatever else Plans 1 and 2 added to that line):

```ts
nextBatchPerStyle, visibleBatches
```

and replace it with:

```ts
nextBatchPerStyle, fallbackLevelNote, visibleBatches
```

Then find:

```tsx
            const b = nextPerStyle.get(s.slug);
```

and replace it with:

```tsx
            const entry = nextPerStyle.get(s.slug);
            const b = entry?.batch;
```

- [ ] **Step 6: Label the fallback card**

In `src/app/page.tsx`, find this exact block:

```tsx
                {b && branch ? (
                  <>
                    <p className="mt-2 text-sm text-cream/70">
```

and replace it with:

```tsx
                {b && branch ? (
                  <>
                    {entry?.isFallback ? (
                      <p className="pill mt-2 bg-gold-500/15 text-gold-400">
                        {fallbackLevelNote(b.level)}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-cream/70">
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npx vitest run src/lib/content-helpers.test.ts src/lib/batch-order.test.ts`
Expected: `tsc` exits 0 with no output; vitest reports **2 files, 15 passed** — 10 from `content-helpers.test.ts` plus the **5** untouched `batch-order` cases (spec §5.3: "its five pinned cases").

Confirm `batch-order` really is untouched:

```bash
git diff --stat src/lib/batch-order.ts src/lib/batch-order.test.ts
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/lib/content-helpers.ts src/lib/content-helpers.test.ts src/lib/content.ts src/app/page.tsx
git commit -m "feat: level-aware next-batch strip with an honest higher-level fallback label"
```

---

### Task 12: Move `TonightTile` above the fold

Spec §6.2, revised 2026-08-10: no ribbon. `QuickEnroll` is `relative z-20 -mt-24` on an opaque fill, so it pulls 96px up into the hero's bottom padding and would have painted straight over a 32px in-flow ribbon. `TonightTile` is richer (live-dot pill, body copy, RSVP CTA), already admin-editable, and adds no second La Rumba surface.

**This task is a markup move. It ships with no automated regression cover** — the checks below are a `grep` count and a document-order assertion against the rendered HTML.

**Files:**
- Modify: `src/app/page.tsx` (anchors: `      <StyleFinder content={content} />` + the `<TonightTile …>` line below it; `      <KineticStrip styles={sortedStyles} />`)
- Test: rendered-HTML order assertion (Step 4)

**Interfaces:** none — pure markup move.

- [ ] **Step 1: Record the current order**

With `npm run dev` running:

```bash
curl -s http://localhost:3000/ > /tmp/home-before.html
node -e "
const h=require('fs').readFileSync('/tmp/home-before.html','utf8');
const a=h.indexOf('WhatsApp to RSVP'), b=h.indexOf('Doors open. Pick a date.');
console.log('tonightTile@'+a, 'nextBatches@'+b, a>b ? 'TILE IS BELOW THE STRIP (today)' : 'UNEXPECTED');
"
```

Expected: both indexes are `> -1` and the line ends `TILE IS BELOW THE STRIP (today)` — La Rumba currently sits eleven sections down the page.

- [ ] **Step 2: Delete the old placement**

In `src/app/page.tsx`, find this exact block:

```tsx
      <StyleFinder content={content} />

      <TonightTile content={content} />
```

and replace it with:

```tsx
      <StyleFinder content={content} />
```

- [ ] **Step 3: Insert the tile directly below the booking board**

In `src/app/page.tsx`, find:

```tsx
      <KineticStrip styles={sortedStyles} />
```

and replace it with:

```tsx
      {/* La Rumba sits directly below the booking board. Deliberately NOT a
          ribbon between <Hero> and <QuickEnroll>: QuickEnroll is `relative
          z-20 -mt-24` on an opaque fill, so it pulls 96px up into the hero's
          bottom padding and would have painted straight over a 32px in-flow
          ribbon. This tile is richer anyway — live-dot pill, body copy, RSVP
          CTA — already admin-editable, and adds no second La Rumba surface. */}
      <TonightTile content={content} />

      <KineticStrip styles={sortedStyles} />
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run typecheck && grep -c "<TonightTile" src/app/page.tsx
```

Expected: `tsc` exits 0 with no output, then `1` — the tile is rendered exactly once.

With `npm run dev` running:

```bash
curl -s http://localhost:3000/ > /tmp/home-after.html
node -e "
const h=require('fs').readFileSync('/tmp/home-after.html','utf8');
const a=h.indexOf('WhatsApp to RSVP'), b=h.indexOf('Doors open. Pick a date.');
console.log('tonightTile@'+a, 'nextBatches@'+b, a>-1 && a<b ? 'OK' : 'WRONG ORDER');
"
```

Expected: the line ends `OK` — the tile now precedes the "Next batches" strip in document order.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: move the La Rumba tile directly below the booking board"
```

---

### Task 13: `schema.org/Event` for La Rumba

**Files:**
- Modify: `src/lib/seo.ts` (anchor: the `// SERP fitting.` banner comment)
- Modify: `src/app/page.tsx` (anchors: `{ fitDescription, fitTitle }`; `import { TonightTile } from '@/components/TonightTile';`; `  const trialLabel = `; the `  return (` / `    <>` opening of `HomePage`)
- Test: `src/lib/seo.test.ts`

**Interfaces:**
- Produces: `weeklyScheduleLd(when: string)` and `tonightEventLd(content: SiteContent)`; the latter returns `null` when there is nothing honest to emit.
- Reuses the module-private `to24h(h, m, ampm)` already defined above the insertion point in `seo.ts`.

- [ ] **Step 1: Write the failing test**

`src/lib/seo.test.ts` is shared with Plan 4, which appends its SEO-field tests to it. This plan runs first, so it creates the file; **Plan 4 must append, never `Write`** (R4, review finding D1). If the file already exists when you reach this step, append the two `describe` blocks and their fixtures instead of creating it, and read the cumulative expected count off the run rather than the numbers below.

Create `src/lib/seo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SiteContent } from './content-schema';
import { tonightEventLd, weeklyScheduleLd } from './seo';

// The house rule for JSON-LD built from admin free text, already applied by
// openingHoursLd: any segment that does not parse suppresses the whole
// property. Wrong hours in a SERP are worse than none.

const gachibowli = {
  id: 'sd_9',
  slug: 'gachibowli',
  name: 'Gachibowli',
  neighborhood: 'Gachibowli',
  address: '1 Brew Lane, Gachibowli, Hyderabad',
  geo: { lat: 17.44, lng: 78.34 },
  hours: '',
  telephone: '+91 88860 72572',
  photos: [],
  parkingNotes: '',
  styleSlugs: [],
  displayOrder: 0,
};

const TONIGHT = {
  enabled: true,
  headline: 'La Rumba · Latin Social',
  body: "Hyderabad's weekly Latin social. All levels welcome. Entry at the Venue.",
  when: 'Every Saturday · 7 PM',
  ctaLabel: 'WhatsApp to RSVP',
  ctaContext: '',
};

const content = (over: Record<string, unknown> = {}) =>
  ({
    site: { title: 'Furor — Dance Hyderabad', socials: {} },
    tonight: TONIGHT,
    studios: [],
    ...over,
  }) as unknown as SiteContent;

describe('weeklyScheduleLd', () => {
  it('parses a weekday and a start time into a weekly schedule', () => {
    expect(weeklyScheduleLd('Every Saturday · 7 PM')).toEqual({
      '@type': 'Schedule',
      repeatFrequency: 'P1W',
      byDay: 'https://schema.org/Saturday',
      startTime: '19:00',
      scheduleTimezone: 'Asia/Kolkata',
    });
  });

  // The value shipping today still has the venue glued onto the end.
  it('tolerates the venue tail still being in the string', () => {
    const s = weeklyScheduleLd('Every Saturday · 7 PM onwards at Over the Moon Brew Co, Gachibowli ');
    expect(s?.startTime).toBe('19:00');
    expect(s?.byDay).toBe('https://schema.org/Saturday');
  });

  it('returns undefined when no weekday is named', () => {
    expect(weeklyScheduleLd('Every weekend · 7 PM')).toBeUndefined();
  });

  it('returns undefined when no time is given', () => {
    expect(weeklyScheduleLd('Every Saturday')).toBeUndefined();
  });
});

describe('tonightEventLd', () => {
  it('returns null when the tonight block is switched off', () => {
    expect(tonightEventLd(content({ tonight: { ...TONIGHT, enabled: false } }))).toBeNull();
  });

  it('returns null when the recurrence cannot be parsed', () => {
    expect(tonightEventLd(content({ tonight: { ...TONIGHT, when: 'Every weekend' } }))).toBeNull();
  });

  it('builds a recurring Event from the tonight block', () => {
    const ld = tonightEventLd(content());
    expect(ld?.['@type']).toBe('Event');
    expect(ld?.name).toBe('La Rumba · Latin Social');
    expect(ld?.eventSchedule).toMatchObject({
      byDay: 'https://schema.org/Saturday',
      startTime: '19:00',
    });
  });

  it('omits location when the copy names no known studio', () => {
    expect(tonightEventLd(content({ studios: [gachibowli] }))?.location).toBeUndefined();
  });

  it('attaches the studio Place when the copy names one', () => {
    const ld = tonightEventLd(
      content({
        studios: [gachibowli],
        tonight: { ...TONIGHT, body: 'Weekly Latin social at Over the Moon Brew Co, Gachibowli.' },
      }),
    );
    expect(ld?.location).toMatchObject({ '@type': 'Place', name: 'Gachibowli' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/seo.test.ts`
Expected: FAIL — 9 failed (9), `TypeError: weeklyScheduleLd is not a function`. (If your vite build surfaces the missing exports at link time, the file is reported as failed with `SyntaxError: The requested module './seo' does not provide an export named 'tonightEventLd'` — both are the intended red.)

- [ ] **Step 3: Add the builders**

In `src/lib/seo.ts`, find this exact banner (it is the only occurrence of `SERP fitting.`):

```ts
// ---------------------------------------------------------------------------
// SERP fitting.
```

and insert the following **immediately before** it:

```ts
const LD_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * `tonight.when` ("Every Saturday · 7 PM") → a weekly schema.org Schedule.
 *
 * All-or-nothing, same rule as openingHoursLd: this is admin free text, and a
 * wrong recurring-event time in search is worse than no event at all.
 */
export function weeklyScheduleLd(when: string) {
  const day = LD_WEEKDAYS.find((d) => new RegExp(`\\b${d}\\b`, 'i').test(when));
  const t = when.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!day || !t) return undefined;
  const startTime = to24h(Number(t[1]), Number(t[2] ?? '0'), t[3]);
  if (!startTime) return undefined;
  return {
    '@type': 'Schedule',
    repeatFrequency: 'P1W',
    byDay: `https://schema.org/${day}`,
    startTime,
    scheduleTimezone: 'Asia/Kolkata',
  };
}

/** The studio La Rumba runs at, when the tonight copy names one. There is no
 *  venue field on `tonight`, so an unrecognised venue emits no location at
 *  all rather than defaulting to studios[0] — a wrong Place is worse than none. */
function tonightVenue(content: SiteContent) {
  const haystack = `${content.tonight.when} ${content.tonight.body}`.toLowerCase();
  return content.studios.find(
    (s) =>
      (!!s.name && haystack.includes(s.name.toLowerCase())) ||
      (!!s.neighborhood && haystack.includes(s.neighborhood.toLowerCase())),
  );
}

/** A recurring `Event` node for La Rumba, or null when there is nothing
 *  honest to emit. Server-side only — rendered via <JsonLd data={...} />. */
export function tonightEventLd(content: SiteContent) {
  const t = content.tonight;
  if (!t.enabled || !t.headline || !t.when) return null;
  const eventSchedule = weeklyScheduleLd(t.when);
  if (!eventSchedule) return null;
  const venue = tonightVenue(content);
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${SITE_URL}/#la-rumba`,
    name: t.headline,
    description: t.body || undefined,
    url: SITE_URL,
    organizer: { '@id': ORG_ID },
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventSchedule,
    location: venue
      ? {
          '@type': 'Place',
          name: venue.name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: venue.address,
            addressLocality: 'Hyderabad',
            addressRegion: 'Telangana',
            addressCountry: 'IN',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: venue.geo.lat,
            longitude: venue.geo.lng,
          },
        }
      : undefined,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/seo.test.ts`
Expected: PASS — 9 passed (9).

- [ ] **Step 5: Render it on the home page**

In `src/app/page.tsx`, find this substring inside the `@/lib/seo` import:

```ts
{ fitDescription, fitTitle }
```

and replace it with:

```ts
{ fitDescription, fitTitle, tonightEventLd }
```

Then find:

```ts
import { TonightTile } from '@/components/TonightTile';
```

and replace it with:

```ts
import { TonightTile } from '@/components/TonightTile';
import { JsonLd } from '@/components/JsonLd';
```

Then find the line that begins:

```ts
  const trialLabel = 
```

and insert immediately **after** that whole line:

```ts
  // Recurring branded event, so La Rumba is findable in search. Returns null
  // when tonight is off or its recurrence cannot be parsed.
  const eventLd = tonightEventLd(content);
```

Finally, find the opening of `HomePage`'s returned fragment — this exact two-line sequence, which occurs once in the file (`generateMetadata` returns an object literal, not JSX). Do **not** include the `<Hero …>` line in the match; Plan 2 has changed it.

```tsx
  return (
    <>
```

and replace it with:

```tsx
  return (
    <>
      {eventLd ? <JsonLd data={eventLd} /> : null}

```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: exits 0 with no output.

With `npm run dev` running:

```bash
curl -s http://localhost:3000/ | grep -c '"@type":"Event"'
```

Expected: `1`.

```bash
curl -s http://localhost:3000/ | grep -c '#la-rumba'
```

Expected: `1`. (Grep for `#la-rumba` without a leading quote — the `@id` value is `https://www.dancehyderabad.com/#la-rumba`, so the character before the hash is `/`.)

```bash
curl -s http://localhost:3000/ | grep -c '"@type":"Place"'
```

Expected: `0`. With the document as shipped, neither studio's name nor neighbourhood appears in `tonight.when` or `tonight.body`, so no `location` is claimed. That is the intended all-or-nothing behaviour, not a bug.

- [ ] **Step 7: Commit**

```bash
git add src/lib/seo.ts src/lib/seo.test.ts src/app/page.tsx
git commit -m "feat: schema.org Event markup for the weekly La Rumba social"
```

---

### Task 14: Correct `/p/latinl1july2026`'s venue, map link and arrival time

**Files:**
- Modify: `data/site-content.json` (`customPages[0].blocks`), then `src/data/site-content.seed.json` via `npm run sync-seed` (R2)
- Test: a node assertion over **both** stored documents

**Interfaces:** none — a pure content correction.

**Context:** `customPages[0]` is the hand-authored confirmation for `batch-rp8nn4` — Foundation salsa, `branchSlug: pup-unleash-huda-colony`, `9:30–10:30 AM`, starting `2026-07-25`. It currently names *Alcazar Mall 2nd Floor (Nicy Studio), Jubilee Hills* (the **other** studio), tells people to *"arrive by 4:15 PM"* for a 9:30 AM class (4:15 PM is the **WCS** track's `arriveBy`), and its map button points at the Alcazar Mall pin. This is the live proof that hand-typed confirmation copy goes wrong, and the reason Tasks 1–7 exist. Retiring the page entirely is an **owner action** (spec §12.3), taken once per-batch welcome notes cover the job; this task only stops it being wrong today.

- [ ] **Step 1: Write the failing assertion**

Run:

```bash
node -e "
const c=require('./data/site-content.json');
const text=JSON.stringify(c.customPages[0].blocks);
const bad=['Alcazar Mall','4:15 PM','maps.app.goo.gl/fevboRQ19pPC8gx36'].filter(s=>text.includes(s));
console.log(bad.length? 'STILL WRONG: '+bad.join(' | ') : 'OK');
process.exit(bad.length?1:0);
"
```

Expected: `STILL WRONG: Alcazar Mall | 4:15 PM | maps.app.goo.gl/fevboRQ19pPC8gx36`, exit code 1.

- [ ] **Step 2: Apply the correction**

Run exactly this from the repo root. The studio name, address and coordinates are copied verbatim from the `pup-unleash-huda-colony` record, and `9:15 AM` is the class start (`9:30 AM`) minus the 15-minute registration window this codebase already uses everywhere else.

```bash
node -e "
const fs=require('fs');
const p='data/site-content.json';
const c=JSON.parse(fs.readFileSync(p,'utf8'));
const blocks=c.customPages[0].blocks;
const where=blocks.find(b=>b.type==='text'&&b.body.startsWith('Where'));
where.body='Where'+String.fromCharCode(10)+'PUP Unleash - HUDA Colony'+String.fromCharCode(10)+'Furor Entertainment'+String.fromCharCode(10)+'PUP – Paws Unleash Play, HUDA Enclave, Jubilee Hills, Hyderabad, Telangana 500110';
const map=blocks.find(b=>b.type==='button'&&b.label.startsWith('Open Map'));
map.href='https://www.google.com/maps/search/?api=1&query=17.426,78.4005';
const when=blocks.find(b=>b.type==='text'&&b.body.startsWith('When'));
when.body=when.body.replace('4:15 PM','9:15 AM');
fs.writeFileSync(p, JSON.stringify(c,null,2)+String.fromCharCode(10));
console.log(where.body);console.log('---');console.log(map.href);console.log('---');console.log(when.body);
"
```

Expected: the `Where` block now names `PUP Unleash - HUDA Colony` and `HUDA Enclave`; the href is `https://www.google.com/maps/search/?api=1&query=17.426,78.4005`; the `When` block contains `Please arrive by 9:15 AM for registration`.

Then propagate to the seed:

```bash
npm run sync-seed
```

Expected: `Wrote src/data/site-content.seed.json`.

- [ ] **Step 3: Run the assertion to verify it passes — on both files**

Run:

```bash
node -e "
const c=require('./data/site-content.json');
const s=require('./src/data/site-content.seed.json');
for (const [name,doc] of [['data',c],['seed',s]]) {
  const text=JSON.stringify(doc.customPages[0].blocks);
  const bad=['Alcazar Mall','4:15 PM','maps.app.goo.gl/fevboRQ19pPC8gx36'].filter(x=>text.includes(x));
  if (bad.length) { console.log(name+' STILL WRONG: '+bad.join(' | ')); process.exit(1); }
  if (!text.includes('HUDA Enclave') || !text.includes('9:15 AM')) { console.log(name+' MISSING CORRECTION'); process.exit(1); }
}
console.log('OK');
"
```

Expected: `OK`, exit code 0.

- [ ] **Step 4: Verify the document still parses and the seed is in sync**

Run: `npx vitest run src/lib/save-pipeline.test.ts src/lib/drafts-core.test.ts src/lib/content-schema.test.ts && npm run sync-seed -- --check`
Expected: all three test files green (they parse the seed at module load, so a malformed edit throws before any assertion); then `✓ seed is in sync with data/site-content.json`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add data/site-content.json src/data/site-content.seed.json
git commit -m "fix: correct the venue, map link and arrival time on /p/latinl1july2026"
```

---

### Task 15: Full verification

**Files:**
- Modify: none

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — **Test Files 38 passed (38), Tests 403 passed (403), 0 failed.**

Arithmetic against this plan's starting point — **34 files / 352 tests**, i.e. the 26/279 on `main` after Plans 1 and 2 have landed (R6), not the bare baseline:

| file | before | after | delta |
|---|---|---|---|
| `src/lib/content-schema.test.ts` (new, Task 1) | — | 3 | +3 |
| `src/lib/welcome-resolve.test.ts` (new, Tasks 2–3) | — | 25 | +25 |
| `src/lib/content-helpers.test.ts` (new, Tasks 8 + 11) | — | 10 | +10 |
| `src/lib/seo.test.ts` (new, Task 13) | — | 9 | +9 |
| `src/lib/integrity.test.ts` (Task 10) | 8 | 12 | +4 |
| **totals** | **34 files / 352** | **38 files / 403** | **+4 files / +51** |

352 + 3 + 25 + 10 + 9 + 4 = 403. If Plan 1 or Plan 2 shifted its own counts, the absolute totals move with them — the number that must hold is the **delta: +4 files, +51 tests, and zero pre-existing tests turned red.**

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 with no output.

- [ ] **Step 3: Confirm the seed and the live document have not diverged**

Run: `npm run sync-seed -- --check`
Expected: `✓ seed is in sync with data/site-content.json`, exit code 0.

- [ ] **Step 4: Confirm the untouchable files really are untouched**

Run:

```bash
git diff --stat main -- src/lib/batch-order.ts src/lib/batch-order.test.ts src/lib/roles.ts
```

Expected: no output. `LEVEL_ORDER`, `compareByLevel` and their pinned cases are unchanged, and no top-level content key was added, so `SECTION_PATHS` needed no edit.

- [ ] **Step 5: Confirm the tree is clean**

Run: `git status --short`
Expected: no output. Every file this plan touched has been committed by the task that touched it.

If anything is listed, it is almost always `data/site-content.json` or `src/data/site-content.seed.json` left dirty by a `sync-seed` run — fix and commit:

```bash
git add -A
git commit -m "fix: green the suite after the post-payment and batch-visibility slice"
```

---

## Owner actions this plan deliberately does not perform

Recorded so they are not mistaken for missing work (spec §12):

1. **Update the five stale `startDate` values** in `/admin/batches`. Nothing here invents class dates; Task 8's warning is what surfaces them, and Task 11's level-aware strip only becomes observable once real dates are in.
2. **Retire `/p/latinl1july2026`** once per-batch welcome notes cover the job. Task 14 corrects its venue, map link and arrival time immediately, ahead of that.
3. **Write the real post-payment copy** into the two welcome tracks, and any per-batch override. Task 7 ships the fields; it does not write the words.

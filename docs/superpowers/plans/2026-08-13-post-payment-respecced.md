# Post-Payment & Batches — Re-specced Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every batch its own post-payment message and a confirmation page whose venue, phone, Instagram and WhatsApp are derived from records rather than typed by hand — and fix the four live bugs around it.

**Architecture:** Builds on the owner's committed `src/lib/welcome-tracks.ts` (commit `1badefb`), which already binds a welcome track to its batches by `track.level` + style overlap. This plan adds a per-batch note, a derived contact block, and repairs the resolution path so a confirmation link stays correct after the class has started.

**Tech Stack:** Next.js 15 App Router, Zod 3 single-document CMS, vitest 4 (node environment, no DOM), TypeScript strict, Cloudflare Workers free plan.

**Execution order:** Plan 3 of 4. Runs after `2026-08-10-mobile-foundation.md`, before the editability backfill.

---

## Why this plan is a third the size of its predecessor

The original Plan 3 proposed **batch-declares-track**: a `welcomeTrackKey` join field on `BatchSchema`, a new `welcome-resolve.ts`, and an integrity check to keep the key honest.

The owner shipped **track-declares-level** instead (`1badefb`): `WelcomeTrackSchema` gained `level`, and `batchPoolForTrack(batches, track)` filters by `b.level === track.level && styleSlugs overlap`. That needs no join key, no integrity check, and it dissolves the hardcoded `level === 'Foundation'` filter as a consequence rather than a special case. It also fixed the track-editing UX that motivated it — slug follows label, duplicate-key detection, style-slug normalisation.

So `welcomeTrackKey`, `welcome-resolve.ts` and their integrity check are **cancelled**. What remains is the owner's original ask (a per-batch message and a real contact block) plus the bugs the binding change did not touch.

## Global Constraints

- **R1 — Anchor every edit on unique TEXT, never a line number.** Line numbers here are orientation only.
- **R2 — `data/site-content.json` is gitignored.** Content-data changes go: edit the live document → `npm run sync-seed` → verify `npm run sync-seed -- --check` → commit **`src/data/site-content.seed.json`**. A `git add data/site-content.json` step silently no-ops.
- **R3 — Validation never goes on the read path.** `src/lib/content.ts` wraps `SiteContentSchema.parse` in a try/catch that serves the bundled seed, so a read-path `.refine()` turns one bad record into a site-wide outage. Cross-record checks belong in `src/lib/integrity.ts` (write path only), as Tasks 11/12/14 of Plan 2 did.
- **R4 — Every new content field is `.default(...)`.** A required field fails validation on read and serves the seed site-wide.
- **R5 — Every code step contains real, complete code.** No "similar to Task N", no TBD.
- **R6 — Test counts drift.** Baseline at plan start: **39 files / 464 tests**. Report observed counts and your delta; judge on "all passing", never on a fixed absolute.
- **R7 — Commit style:** lowercase conventional prefix, imperative. **NEVER add a `Co-Authored-By` trailer.**
- **R8 — No new runtime dependency.**
- **R9 — No timing-based test assertions.** Plan 2 shipped a wall-clock `expect(elapsed).toBeLessThan(5)` that passed alone and failed under the parallel suite. Assert on work done, never elapsed time.
- **R10 — Do not run `npm run build` or start a dev server.** Both are slow here and eight zombie servers had to be killed during Plan 2. The controller performs browser verification.
- `BatchSchema` is a `z.preprocess` wrapper (a `ZodEffects`) — it has **no `.shape` and no `.extend()`**. New fields must be hand-edited into the inner `z.object`.

---

## File Structure

| File | Created / Modified | The ONE responsibility |
|---|---|---|
| `src/lib/content-schema.ts` | Modify | `welcomeNote` on `BatchSchema`; contact-row labels on `WelcomeSchema` |
| `src/lib/welcome-contact.ts` | Create | Pure: derive the contact rows (venue, maps link, tel, WhatsApp, Instagram) from a batch + studio + site settings |
| `src/lib/welcome-contact.test.ts` | Create | Pins derivation, including the no-batch and missing-studio cases |
| `src/lib/content-helpers.ts` | Modify | `nextBatchPerStyle` becomes level-aware and flags fallbacks |
| `src/lib/content-helpers.test.ts` | Create or append | Pins Foundation-first selection and the honest fallback flag |
| `src/app/welcome/[track]/page.tsx` | Modify | Resolve against all batches, not `visibleBatches`; drop the `studios[0]` fallback |
| `src/app/welcome/[track]/WelcomeView.tsx` | Modify | Render the derived contact block and the per-batch note |
| `src/app/admin/batches/BatchesEditor.tsx` | Modify | IST date stamp; per-batch note field; past-date warning |
| `src/app/page.tsx` | Modify | Move `TonightTile` above the fold-adjacent position; level-aware strip; Event JSON-LD |
| `src/lib/seo.ts` | Modify | `tonightEventLd()` for the La Rumba `Event` node |

---

### Task 1: Correct the live wrong-venue page

**This is first because it is wrong in production right now.** `customPages[0]` (`/p/latinl1july2026`) tells a paying customer to arrive at *Alcazar Mall, Jubilee Hills* by *4:15 PM*, for a batch whose `branchSlug` is `pup-unleash-huda-colony` running **9:30–10:30 AM**.

**Files:**
- Modify: `data/site-content.json` → `npm run sync-seed` → commit `src/data/site-content.seed.json`

**Interfaces:** none — content only.

- [ ] **Step 1: Read the batch this page confirms**

```bash
node -e "const c=require('./data/site-content.json');const b=c.batches.find(x=>x.id==='batch-rp8nn4');console.log(JSON.stringify({id:b.id,branchSlug:b.branchSlug,time:b.time,startDate:b.startDate},null,2));const s=c.studios.find(x=>x.slug===b.branchSlug);console.log(JSON.stringify({name:s.name,address:s.address},null,2));"
```

Record the real venue name, address and class time.

- [ ] **Step 2: Find every wrong string in the custom page**

```bash
node -e "const c=require('./data/site-content.json');const p=c.customPages[0];p.blocks.forEach((b,i)=>{const s=JSON.stringify(b);if(/Alcazar|4:15|Jubilee/.test(s))console.log(i,s.slice(0,240));});"
```

- [ ] **Step 3: Replace the venue and arrival time with the batch's real values**

Edit `data/site-content.json` so the page names the studio resolved in Step 1 and an arrival time consistent with that batch's `time`. Do not invent a new arrival convention — if the existing copy says "arrive by X minutes before", keep that relationship against the real start time.

- [ ] **Step 4: Sync and verify**

Run: `npm run sync-seed && npm run sync-seed -- --check`
Expected: `✓ seed is in sync with data/site-content.json`

- [ ] **Step 5: Confirm no wrong strings survive**

```bash
node -e "const c=require('./data/site-content.json');const s=JSON.stringify(c.customPages[0]);console.log('Alcazar:',s.includes('Alcazar'),'4:15:',s.includes('4:15'));"
```
Expected: both `false`.

- [ ] **Step 6: Commit**

```bash
git add src/data/site-content.seed.json
git commit -m "fix: the latin l1 confirmation page named the wrong venue and arrival time"
```

---

### Task 2: Confirmation links survive the class starting

**Files:**
- Modify: `src/app/welcome/[track]/page.tsx` (anchors: `batchPoolForTrack(visibleBatches(content), cfg)` and `?? content.studios[0]`)

**Interfaces:**
- Consumes: `batchPoolForTrack`, `pickDefaultBatch` from `src/lib/welcome-tracks.ts` (owner's, unchanged)
- Produces: a welcome page that resolves a batch regardless of its start date, and never silently substitutes another studio

- [ ] **Step 1: Capture the bug**

The page currently narrows to `visibleBatches(content)`, which drops anything whose `startDate` has passed. A customer who paid, then revisits their confirmation link the week after their class starts, gets an empty pool — the page falls back to `defaultBundle` and, for the venue, to `content.studios[0]`.

Since the seed reorder, `studios[0]` is **Jubilee Hills**, which is the wrong venue for the PUP batches. Record today's date and which batches are currently past-dated:

```bash
node -e "const c=require('./data/site-content.json');const t=new Date(Date.now()+5.5*3600e3).toISOString().slice(0,10);console.log('today IST',t);c.batches.forEach(b=>console.log(b.id,b.startDate,b.startDate>=t?'visible':'PAST',b.branchSlug));"
```

- [ ] **Step 2: Resolve against all batches**

Replace `batchPoolForTrack(visibleBatches(content), cfg)` with `batchPoolForTrack(content.batches, cfg)`. A confirmation page is a receipt — it must stay correct for a batch that has already begun.

Keep `visibleBatches` imported only if still used elsewhere in the file; if not, remove the now-unused import.

- [ ] **Step 3: Remove the wrong-venue fallback**

Replace `content.studios.find((s) => s.slug === batch?.branchSlug) ?? content.studios[0]` with a lookup that yields `undefined` when there is no batch, and have the view render its "we'll confirm the venue" copy rather than a confidently wrong address. A wrong address is worse than an absent one.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean. If `studio` is now possibly `undefined`, thread that through rather than asserting non-null.

- [ ] **Step 5: Commit**

```bash
git add "src/app/welcome/[track]/page.tsx"
git commit -m "fix: confirmation links keep resolving after the class has started"
```

---

### Task 3: The derived contact block

`WelcomeView`'s props are `track, trackLabel, copy, waNumber, waDisplay, vcardHref, defaultBundle, options, paymentState` — **no phone, no Instagram, no studio**. Two of the four things the owner asked for are structurally absent, not merely unstyled.

**Files:**
- Create: `src/lib/welcome-contact.ts`, `src/lib/welcome-contact.test.ts`
- Modify: `src/lib/content-schema.ts` (contact-row labels on `WelcomeSchema`), `src/app/welcome/[track]/page.tsx`, `src/app/welcome/[track]/WelcomeView.tsx`

**Interfaces:**
- Produces: `contactRows(args: { studio?: Studio; site: SiteSettings }): ContactRow[]` where `ContactRow = { kind: 'venue'|'directions'|'phone'|'whatsapp'|'instagram'; label: string; value: string; href?: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { contactRows } from './welcome-contact';

const studio = {
  slug: 'pup-unleash-huda-colony',
  name: 'PUP Unleash - HUDA Colony',
  address: 'PUP - Paws Unleash Play, HUDA Enclave, Jubilee Hills, Hyderabad, Telangana 500110',
  geo: { lat: 17.426, lng: 78.4005 },
  telephone: '+91 88860 72572',
  parkingNotes: 'Free - Valet parking',
} as never;

const site = { whatsappNumber: '918886072572', instagramHandle: 'furorhyd' } as never;

describe('contactRows', () => {
  it('derives venue, directions, phone, whatsapp and instagram from records', () => {
    const rows = contactRows({ studio, site });
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toEqual(['venue', 'directions', 'phone', 'whatsapp', 'instagram']);
  });

  it('builds a maps link from the stored coordinates, not from the address text', () => {
    const r = contactRows({ studio, site }).find((x) => x.kind === 'directions');
    expect(r?.href).toContain('17.426');
    expect(r?.href).toContain('78.4005');
  });

  it('builds a tel: href with no spaces', () => {
    const r = contactRows({ studio, site }).find((x) => x.kind === 'phone');
    expect(r?.href).toBe('tel:+918886072572');
  });

  it('omits venue, directions and phone when the studio is unknown', () => {
    const kinds = contactRows({ studio: undefined, site }).map((r) => r.kind);
    expect(kinds).toEqual(['whatsapp', 'instagram']);
  });

  it('never invents an address', () => {
    const rows = contactRows({ studio: undefined, site });
    expect(JSON.stringify(rows)).not.toContain('Hyderabad');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/welcome-contact.test.ts`
Expected: FAIL — `Failed to load .../welcome-contact` (the module does not exist yet).

- [ ] **Step 3: Implement `contactRows`**

Create `src/lib/welcome-contact.ts`. It must:
- take `{ studio?: Studio; site: SiteSettings }` and return rows in the order the test pins
- build the directions href from `studio.geo.lat` / `.lng`, never by string-searching the address
- strip spaces from `telephone` for the `tel:` href while keeping the human-readable value for display
- emit only WhatsApp and Instagram when `studio` is undefined
- import **no** zod and **no** `content-schema` value (type-only imports are fine) — `src/lib/client-bundle.test.ts` fails otherwise if this is ever reached from a client component

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/welcome-contact.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Add the row labels to `WelcomeSchema`**

Add defaulted label fields so the studio can reword the block: `contactHeading` (default `'Where to find us'`), `contactParking` (default `'Parking'`), `contactDirections` (default `'Get directions'`). Every field `.default(...)` per R4.

- [ ] **Step 6: Thread studio and site into `WelcomeView` and render the block**

Widen the props, pass the resolved `studio` (possibly `undefined`) and `content.site` from `page.tsx`, and render the rows. When `studio` is undefined, render the existing "we'll confirm the venue" copy rather than an empty block.

- [ ] **Step 7: Verify**

Run: `npx vitest run` and `npm run typecheck`
Expected: all passing, clean typecheck. Report counts.

- [ ] **Step 8: Commit**

```bash
git add src/lib/welcome-contact.ts src/lib/welcome-contact.test.ts src/lib/content-schema.ts "src/app/welcome/[track]/page.tsx" "src/app/welcome/[track]/WelcomeView.tsx" src/data/site-content.seed.json
git commit -m "feat: derived contact block on the confirmation page"
```

---

### Task 4: The per-batch post-payment message

The owner's original ask: *"when creating the batches or any classes, the post payment field should get automatically created."*

**Files:**
- Modify: `src/lib/content-schema.ts` (`welcomeNote` on the inner `z.object` of `BatchSchema`), `src/app/admin/batches/BatchesEditor.tsx`, `src/app/welcome/[track]/WelcomeView.tsx`

- [ ] **Step 1: Add the field**

In `BatchSchema`'s inner `z.object` (anchor: `razorpayLink: safeUrl().nullable().optional(),`), add:

```ts
// The per-batch post-payment message. Empty means "use the track's copy",
// so a batch created and never edited still ships a warm confirmation.
welcomeNote: z.string().default(''),
```

`BatchSchema` is a `ZodEffects` — hand-edit the inner object; `.extend()` does not exist on it.

- [ ] **Step 2: Give it a field in the batch editor, present at creation**

In `BatchesEditor.tsx`, add a "Post-payment message" textarea to the batch card, and include `welcomeNote: ''` in `add()`'s new-batch object so the field visibly exists the moment a batch is created. Show the track's default copy as the textarea's placeholder so the studio can see what ships if they leave it blank.

- [ ] **Step 3: Render it on the confirmation page**

In `WelcomeView`, render the resolved batch's `welcomeNote` when non-empty, falling back to the existing track copy when empty. Prose only — venue, date and time continue to come from the derived block, so a note can never contradict the record.

- [ ] **Step 4: Verify**

Run: `npx vitest run` and `npm run typecheck`. Report counts. No content-data change is needed — the field is defaulted (R4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/content-schema.ts src/app/admin/batches/BatchesEditor.tsx "src/app/welcome/[track]/WelcomeView.tsx"
git commit -m "feat: per-batch post-payment message, created with the batch"
```

---

### Task 5: Two admin correctness fixes

**Files:**
- Modify: `src/app/admin/batches/BatchesEditor.tsx`

- [ ] **Step 1: Stamp the batch date in IST, not UTC**

`add()` uses `new Date().toISOString().slice(0, 10)` while every visibility filter uses `todayIso()` from `src/lib/format.ts`, which adds +5:30. Between 00:00 and 05:30 IST a newly created batch is stamped *yesterday* and is invisible on every public surface the moment it is saved.

Replace the UTC stamp with `todayIso()`.

- [ ] **Step 2: Warn when a batch has fallen out of visibility**

Add an inline notice on any batch card whose `startDate` is before `todayIso()`, saying it is hidden from the site. This is the guard that stops the "five of six batches silently invisible" situation recurring.

- [ ] **Step 3: Verify**

Run: `npm run typecheck` and `npx vitest run`. Confirm with:
```bash
! grep -q "new Date().toISOString()" src/app/admin/batches/BatchesEditor.tsx && echo OK
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/batches/BatchesEditor.tsx
git commit -m "fix: stamp new batches in ist and flag ones that have gone invisible"
```

---

### Task 6: Beginner-first per-style strip

`nextBatchPerStyle` picks by date only and shows one card per style, so it can front an Advanced card to a first-timer — the exact thing spec §5 exists to prevent. `compareByLevel` already ships and is used by `QuickEnroll` and `BatchesBrowser`; this is the one surface that ignores it.

**Files:**
- Modify: `src/lib/content-helpers.ts`, `src/app/page.tsx`
- Create or append: `src/lib/content-helpers.test.ts`

**Interfaces:**
- Produces: `nextBatchPerStyle(content): Map<string, { batch: Batch; isFallback: boolean }>` — **a breaking shape change**; update every call site in the same commit.

- [ ] **Step 1: Write the failing test**

Cover: a style with a Foundation batch and a later Advanced one returns the Foundation batch with `isFallback: false`; a style with only Advanced returns it with `isFallback: true`; a style with no visible batch is absent from the map.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/content-helpers.test.ts`
Expected: FAIL on the shape (currently a bare `Batch`, not `{ batch, isFallback }`).

- [ ] **Step 3: Implement**

Prefer the soonest `Foundation` batch per style; fall back to the soonest of any level and set `isFallback`. Do not change `batch-order.ts` — `LEVEL_ORDER` and its five pinned cases stay exactly as they are.

- [ ] **Step 4: Update every call site**

Find them with `grep -rn "nextBatchPerStyle" src`. Label a fallback card honestly (e.g. "Intermediate — danced before?") rather than hiding it; an experienced dancer should still find their lane.

- [ ] **Step 5: Verify and commit**

```bash
git add src/lib/content-helpers.ts src/lib/content-helpers.test.ts src/app/page.tsx
git commit -m "feat: the per-style strip leads with foundation batches"
```

---

### Task 7: La Rumba moves up, and becomes findable

**Files:**
- Modify: `src/app/page.tsx`, `src/lib/seo.ts`

- [ ] **Step 1: Move the tile**

`TonightTile` currently renders near the bottom of the home page. Move it to sit directly below the booking board, before `KineticStrip`. It is richer than a ribbon, already admin-editable, already carries its RSVP CTA — spec §6.2 chose moving it over building a second surface.

- [ ] **Step 2: Add `tonightEventLd()` to `src/lib/seo.ts`**

Emit a `schema.org/Event` node derived from `content.tonight` plus the venue studio, following the file's existing JSON-LD conventions. Return `null` when `tonight.enabled` is false so nothing invalid ships.

- [ ] **Step 3: Render it**

Add the node via the existing `JsonLd` component on the home page, guarded on `tonightEventLd()` returning non-null.

- [ ] **Step 4: Verify and commit**

Run `npx vitest run` and `npm run typecheck`.

```bash
git add src/app/page.tsx src/lib/seo.ts
git commit -m "feat: la rumba sits under the booking board and emits event json-ld"
```

---

### Task 8: Full-suite verification

- [ ] **Step 1: Run everything**

```
npx vitest run
npm run typecheck
npm run sync-seed -- --check
git status --short
```

Expected: all tests passing, clean typecheck, seed in sync, empty status. Report the final counts and the delta from the 39 files / 464 tests baseline.

- [ ] **Step 2: Confirm no read-path validation was added**

```bash
git diff <plan-base>..HEAD -- src/lib/content-schema.ts | grep -c "^+.*refine"
```
Expected: `0`.

- [ ] **Step 3: Confirm the client bundle guard still passes**

Run: `npx vitest run src/lib/client-bundle.test.ts`
Expected: all passing — no `'use client'` file may reach zod or `content-schema` through a value import.

---

## Owner actions outside the code

1. **Update the five stale `startDate` values** in `/admin/batches`. Nothing here invents class dates, and Task 5's warning now makes the situation visible.
2. **Write the per-batch notes.** Task 4 creates the field and ships the track copy as the fallback; the words are the studio's.
3. **Retire `/p/latinl1july2026`** once per-batch notes cover the same job. Task 1 corrects its venue and time immediately, ahead of that.

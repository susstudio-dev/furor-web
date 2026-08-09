# Editable site, honest confirmations, and a first-visit hero

**Date:** 2026-08-09
**Trigger:** owner brief — (A) batches should auto-get a post-payment message, and the
confirmation page should carry location / phone / Instagram / WhatsApp; (B) every string on
the site, including button copy, should be editable from `/admin`; (C) beginner batches
should lead on the home page; (D) the hero should make the social channels and La Rumba
obvious to a first-time visitor without stealing focus from booking.
**Process:** 6-agent recon workflow (5 parallel readers + 1 adversarial completeness critic
that re-verified every claim against the files and ran the suite). Owner decisions taken
2026-08-09 and recorded inline.

---

## 0. What the recon changed about the brief

Three findings reshaped the work before any design was written.

1. **Ask C already ships.** `compareByLevel` (`src/lib/batch-order.ts:19-24`) sorts
   Foundation → Intermediate → Advanced with a date tie-break; `QuickEnroll.pickBoard`
   (`src/components/QuickEnroll.tsx:21-29`) already forces 3 Foundation + 1 higher, and
   `BatchesBrowser` already defaults to that sort. It is invisible because **five of six
   batches have a `startDate` before today**, so `visibleBatches`
   (`src/lib/content-helpers.ts:4-9`) leaves exactly one batch site-wide. Owner confirmed:
   the dates are stale. Ask C is mostly a data problem plus one genuinely level-blind
   surface.

2. **Two confirmation-page bugs are live.** `/welcome/[track]` hard-filters
   `b.level === 'Foundation'` (`src/app/welcome/[track]/page.tsx:157`), while
   `RazorpayRedirectHint` (`src/app/admin/batches/BatchesEditor.tsx:184-236`) happily hands
   out a `/welcome/...?b=batch-004` URL for an **Intermediate** batch. `WelcomeView` finds
   no match and silently keeps `defaultBundle` — a paying customer sees another batch's
   date, venue and calendar file. Separately, `customPages[0]` (`/p/latinl1july2026`) names
   *Alcazar Mall, Jubilee Hills* and *"arrive by 4:15 PM"* for a batch whose `branchSlug` is
   `pup-unleash-huda-colony` and whose class runs 9:30–10:30 AM. Hand-authored confirmation
   copy is already wrong in production — which is the strongest argument for ask A.

3. **The hero has no spare vertical room.** `hero.subHeadline` is 297 characters ≈ 8 lines
   at `text-lg` in a 335px column. The hero content block (`src/components/Hero.tsx:89`,
   `pt-8 pb-36`) measures ≈690px plus a 64px sticky header — taller than a 667px iPhone SE
   viewport. `Hero.tsx:113-117` records that the "See batches" button was *deliberately
   deleted* to hold one filled action per viewport. Ask D is therefore a subtraction
   exercise, not an addition one.

Corrections to earlier assumptions, for the record: `site.socials.youtube` **does** exist
(`src/lib/content-schema.ts:22`, present in data, editable at
`src/app/admin/site/SiteEditor.tsx:90-91`) — it is simply never rendered above the footer.
And `QuickEnroll` is a **server** component, so ordering changes there cost zero client JS.

## 1. Owner decisions (2026-08-09)

| # | Decision | Answer |
|---|---|---|
| 1 | Are the past-dated batches stale, recurring, or ended? | **Stale.** Owner updates dates in admin; no recurrence field. |
| 2 | Where does the post-payment message live? | **Track default + per-batch override.** |
| 3 | How far does "everything editable" go? | **All four scopes**: buttons/headings/empty states, alt + screen-reader text, page titles + SEO descriptions, WhatsApp prefill templates. |
| 4 | Where do La Rumba and the social channels go? | **Header icons + a slim ribbon** between hero and booking board. Hero keeps one filled action. |
| 5 | Hero sub-headline | **Trim to ~130 chars**; this spec drafts the copy, owner may rewrite in admin. |
| 6 | YouTube URL (`https://youtube.com/furorhyd` is not a valid channel shape) | **Keep it admin-editable**; add a format hint and validation; header renders the icon only when set. Owner verifies the real URL before deploy. |
| 7 | The wrong `/p/latinl1july2026` page | **Fix venue and time now, retire the page** once per-batch welcome notes cover the job. |

## 2. Architecture

Everything lands in the existing single-document CMS. No new dependency, no new storage, no
new runtime concept. The four asks touch four disjoint areas of one Zod schema, plus three
new pure functions in `src/lib` that carry all the new logic and all the new tests.

```
content-schema.ts
├── labels            (NEW top-level key)  → ask B
├── site.socials      (exists)             → ask D  (render only)
├── hero.posterAlt    (NEW field)          → ask B
├── tonight           (exists)             → ask D  (render only)
├── batches[]
│   ├── welcomeTrackKey  (NEW)             → ask A
│   └── welcomeNote      (NEW)             → ask A
├── welcome
│   ├── tracks[].noteHeadline / noteBody   (NEW) → ask A
│   └── contact* labels                    (NEW) → ask A
└── pages.*.seoTitle / seoDescription      (NEW) → ask B

src/lib (new pure modules, each independently testable)
├── labels.ts          resolve a label with its shipped default
├── book-label.ts      bookLabel(level, labels) — one source of truth for CTA copy
├── welcome-resolve.ts resolveWelcomeBatch(query, batches, tracks) + welcomeNoteFor()
└── nav.ts             the shared, id-keyed nav array for Header + Footer
```

Every new field is `z.string().default('<the exact literal shipping today>')`. That is the
documented house pattern (`content-schema.ts:196-199`, `429-433`) and it matters: a required
field here fails validation on read and serves the **seed document site-wide**
(`src/lib/content.ts:104`). Defaults mean existing stored content auto-migrates with no data
migration step.

## 3. Ask A — post-payment message and the contact block

### 3.1 Schema

`BatchSchema` — two fields added to the inner `z.object` at `content-schema.ts:142-161`:

```ts
// Which welcome track this batch's payment redirect lands on. Stored rather
// than guessed: the old "first track whose styleSlugs intersect" heuristic
// silently handed Intermediate customers another batch's intake details.
welcomeTrackKey: z.string().default(''),
// The per-batch post-payment message. Empty means "use the track default",
// so a batch created and never edited still ships a warm confirmation.
welcomeNote: z.string().default(''),
```

`WelcomeTrackSchema` (`content-schema.ts:434`) gains `noteHeadline` and `noteBody`, both
defaulted to `''`.

**Note:** `BatchSchema` is a `ZodEffects` (a `z.preprocess` wrapper), so it exposes neither
`.shape` nor `.extend()`. Both fields must be hand-edited into the inner object. Any future
schema-driven form generator must special-case `_def.schema` for batches.

### 3.2 Auto-creation

`add()` in `src/app/admin/batches/BatchesEditor.tsx:24-41` stamps `welcomeTrackKey` from the
first track matching the newly chosen style, and `welcomeNote: ''`. The batch card gains a
**"Post-payment message"** textarea whose placeholder is the resolved track default, so the
field is visibly present the moment a batch is created — the literal ask.

A **"Welcome page"** select next to it exposes `welcomeTrackKey`, so a batch whose styles
match no track (or match the wrong one) can be pointed by hand.

### 3.3 The contact block

`WelcomeView` currently receives `track, trackLabel, copy, waNumber, waDisplay, vcardHref,
defaultBundle, options, paymentState` — no phone, no Instagram, no `tel:` link at all. Two of
the four things the brief names are structurally absent, not merely un-editable.

The new block is **derived from records, never hand-typed** — precisely because hand-typing
produced the wrong address now live on `/p/latinl1july2026`:

| row | source |
|---|---|
| Location | `studio.name`, `studio.address`, `studio.parkingNotes` |
| Directions | Google Maps link built from `studio.geo.lat` / `.lng` |
| Phone | `studio.telephone` → `tel:` link |
| WhatsApp | existing `waNumber` / `waDisplay` |
| Instagram | `site.instagramHandle` |

Row labels come from `labels` (§4). Only the prose — `welcomeNote` / `noteBody` — is free
text. The studio can say anything warm it likes; it cannot make the address wrong.

### 3.4 Bugs fixed in the same pass

1. **Drop the Foundation filter** at `welcome/[track]/page.tsx:157`; `?b=` becomes
   authoritative. Intermediate and Advanced customers get their own batch's details.
2. **Resolve against all batches, not `visibleBatches`.** Today, the moment a batch's
   `startDate` passes, the welcome pool empties, `buildBundle(undefined)` runs and `studio`
   falls back to `content.studios[0]` = Jubilee Hills — the wrong venue for five of six live
   batches. A paid customer revisiting their link the week after class is shown the wrong
   address. Confirmation links must stay correct forever.
3. **`welcomeTrackKey` integrity is checked on write only** — `src/lib/integrity.ts:70-73`,
   beside the existing `branchSlug` check. Never a `.refine()`: a read-path refine turns one
   bad batch into a site-wide seed fallback.
4. **`add()` stamps IST, not UTC.** `BatchesEditor.tsx:32` uses
   `new Date().toISOString().slice(0,10)` while `visibleBatches` filters on `todayIso()`
   (`src/lib/format.ts:17-22`, UTC+5:30). Between 00:00 and 05:30 IST a new batch is stamped
   *yesterday* and is invisible the instant it is saved. Switch to `todayIso()`.
5. **`RazorpayRedirectHint` reads the stored key** instead of re-deriving it.
6. **A past-start-date warning on the batch card** — an inline "This batch is hidden from the
   site (start date has passed)" notice. This is the guard that stops §0.1 recurring.

## 4. Ask B — every string editable

### 4.1 Measured scope

≈230–250 render sites, ≈170–185 distinct strings, across 31 public files, concentrated in
six: `BatchesBrowser` (~37), `QuickEnroll` (~30), `Footer` (15), `WelcomeView` (14),
`page.tsx` (13), `Header` (12).

**Deduplication is the whole game.** `"Chat on WhatsApp"` appears at 10 sites,
`"DM on Instagram"` at 8, the nav item set at 3, and `Address` / `Hours` / `Parking` /
`Get directions` at 2 each. Roughly **55 of the distinct strings sit in the conversion
funnel** (hero CTA, batch-card CTAs, empty states, welcome actions) — that is where
editability pays for itself first.

### 4.2 Shape: a hybrid, and why

The ~170 distinct strings split into two populations, and they want different homes:

- **~50 cross-cutting strings** — CTA verbs, nav items, filter and badge labels, empty
  states, aria labels. These recur across many components and have no natural owning
  section. They go in one new flat `labels` key.
- **~120 section-specific strings** — headings, leads and body copy that belong to exactly
  one page or block. These go into their existing page/section objects, following the
  `ctaLabel` / `whatsappLabel` convention already used throughout `content-schema.ts`
  (e.g. `TrialSchema:69,74`). Putting these in a global bag would divorce them from their
  editing context; the studio edits the batches page copy on the batches screen.

```ts
labels: LabelsSchema   // NEW top-level key in SiteContentSchema
```

A **flat** object of ~50 `z.string().default(...)` fields, grouped by name prefix only —
`ctaChatWhatsapp`, `ctaDmInstagram`, `ctaBookFoundation`, `ctaBookTrial`, `navAbout`,
`emptyNoBatches`, `filterAllStyles`, `welcomeSaveContact`, …

Flat is a performance decision, not a style one. Every public request runs
`JSON.parse` + `mergeWithSeed` + a full `SiteContentSchema.parse` (`content.ts:100`; only the
raw *string* is 30s-cached at `content.ts:22`), under the Workers free-plan 10ms CPU cap.
Zod cost scales with **node count**. ~50 string leaves in one flat object is linear growth;
the same 50 split across 15 nested single-key groups is not. Flat also lets one admin screen
render as a searchable grid rather than 15 accordions.

### 4.3 Three chokepoints, not 31 editors

Roughly 110 of the ~230 render sites are reachable through three edits:

1. **`EnquiryCTA`** (`src/components/EnquiryCTA.tsx:99-105`) takes content-driven default
   labels → removes the "Chat on WhatsApp" ×10 and "DM on Instagram" ×8 duplication.
2. **`bookLabel(level, labels)`** — a new shared helper used by `BatchActions.tsx:18-19,34`,
   `QuickEnroll.tsx:128` and `Hero.tsx:120-122`, which currently each build the same label
   independently. This also fixes a live inconsistency: `QuickEnroll.tsx:165` renders the raw
   enum `Filling Fast` while `BatchesBrowser` hardcodes `Filling fast` — two casings of the
   same word ship on one site.
3. **A shared, id-keyed nav array** for `Header` and `Footer`. This is load-bearing:
   `Header.tsx:32` branches on `item.label === 'Dance Styles'`, so making nav labels editable
   silently breaks the style dropdown the first time someone renames that item. Stable `id`s
   must land **before** any label becomes editable.

### 4.4 The three extra scopes

- **Alt and screen-reader text.** Image alt belongs with its image, not in a label bag:
  `hero.posterAlt` joins `HeroSchema` (default = today's literal at `Hero.tsx:40`).
  `aria-label`s on icon-only controls are chrome and go into `labels`.
- **Page titles and SEO descriptions.** 8 static `title:` literals and ~10 fallback
  descriptions gain `seoTitle` / `seoDescription` fields on their page objects. They still
  run through the existing `fitTitle` / `fitDescription` budget helpers, and the admin field
  shows a live character counter — an over-long title gets trimmed, never shipped broken.
- **WhatsApp prefill templates.** The six templates in `src/lib/enquiry.ts:38-78` become
  editable, **and `assertCleanMessage` (`enquiry.ts:27-36`) moves to save time as a Zod
  refine.** Today it *throws* on `<`, `>`, `{{`, `}}` or `undefined` — meaning an admin can
  currently author a template that crashes a CTA at click time, on the visitor's device.
  Validating at save turns a production crash into a form error.

### 4.5 Deliberately structural — never exposed

Analytics event names; schema.org vocabulary; route paths and `href`s; CSS class hooks;
`razorpay_payment_link_status`; and the Zod **enum values** `Foundation` / `Filling Fast`,
which are live URL state in `BatchesBrowser` (`:141-148`, compared at `:242`, `:453`) —
renaming them would break bookmarked and shared links. Display labels for those enums are
editable; the values are not.

### 4.6 Admin

One `/admin/labels` screen: a searchable two-column grid grouped by prefix, each field
showing its shipped default as placeholder plus a "reset to default" action.

Registration order matters, and each step has a test that fails until it is done:

1. `SECTION_PATHS` in `src/lib/roles.ts:49` — else `roles.test.ts:13` fails immediately and
   section-scoped accounts cannot save the screen.
2. `NAV` + `SECTION_FOR_HREF` in `src/app/admin/layout.tsx:24,65`.
3. `page.tsx` calling `requireWriteAccess('labels')` — else
   `admin-pages-guarded.test.ts:35-47` fails.

## 5. Ask C — beginners first, and actually visible

Current data (`data/site-content.json`, all six records): Foundation 4, Intermediate 1,
Advanced 1. The enum forbids any other value. Beginner-first is fully expressible today; **no
schema change is needed.**

1. **The stale dates are the fix.** Owner updates `startDate` in admin. Once real dates are
   in, the level ordering that already ships becomes observable for the first time. §3.4.6's
   past-date warning prevents a repeat.
2. **The per-style "Next batches" strip is genuinely level-blind.** `nextBatchPerStyle`
   (`src/lib/content-helpers.ts:19-27`) picks by date only and shows one card per style, so
   it *can* front an Advanced Bachata card to a first-timer. (Latent today only because the
   sole Bachata batch is past-dated and renders the "coming soon" fallback at
   `page.tsx:202-218`.) It becomes: **soonest Foundation per style, falling back to the
   soonest of any level**, with the fallback card labelled honestly
   ("Intermediate — danced before?"). Honesty over hiding: an experienced dancer should still
   find their lane.
3. `batch-order.ts` and `batch-order.test.ts` are **unchanged**. `LEVEL_ORDER` and its five
   pinned cases stay exactly as they are.

## 6. Ask D — a first visit that shows the channels and the social

### 6.1 Social icons in the header

Instagram, YouTube and WhatsApp as inline-SVG icon links in the header's right cluster
(`Header.tsx:96-108` — the only slot with real room). 44px touch targets, `aria-label` from
`labels`, each rendered **only when its URL is set**, so nothing ships broken. `site.socials`
already holds all three and is already admin-editable.

This costs the hero zero pixels and puts the channels on **every** page, not only home.
No client JS; no new dependency.

The `SiteEditor` YouTube field gains a format hint (`https://youtube.com/@handle`) and
URL-shape validation. **Owner action:** verify the stored
`https://youtube.com/furorhyd` resolves, or replace it, before deploy. Until then the icon
simply does not render.

### 6.2 The La Rumba ribbon

A single quiet line between the hero and the booking board:

> **La Rumba** · every Saturday, 7 PM · Over the Moon Brew Co, Gachibowli →

Driven entirely by `content.tonight`, which already exists, is already admin-editable, and
already carries an `enabled` switch. Server-rendered, ~32px tall, anchoring to the existing
`TonightTile` further down the page. It does not touch the hero's attention ratio: the hero
still has exactly one filled action.

### 6.3 Trim the hero sub-headline — the change that makes room

The ribbon costs ~32px; the 297-character sub-headline costs ~110px more than it needs to.
Trimming it recovers more than the ribbon spends, so the booking board ends up **higher** on
a phone than it is today. Without this, ask D quietly buries ask C.

Proposed copy (~142 chars), owner-editable in admin:

> Salsa, Bachata and West Coast Swing in Hyderabad. Never danced a step? Foundation is built
> for exactly you — feel the music once, then decide.

What is deliberately dropped and why: the "India's most loved" claim (the pill directly above
already reads "India's largest Latin dance school"); the two venue names (they appear in the
Visit Us section and on every batch card); and the literal **₹500** — the button immediately
below derives the price from live batch data, and hardcoding it in prose means the copy lies
the day the deposit changes. This follows the codebase's own rule at `Hero.tsx:13-14`.

### 6.4 Fix the La Rumba tile's silent clipping

`TonightTile.tsx:16-22` puts the whole `when` string inside a `.pill`, which is
`whitespace-nowrap` (`globals.css:136-140`), inside a wrapper that is `overflow-clip`
(`TonightTile.tsx:10`). The live value is 72 characters ≈ 520px. On a 375px phone
(`container-x` leaves 335px) roughly the last third — **including the venue name** — is cut
off: not wrapped, not scrollable, not visible. Promoting La Rumba starts here. The pill keeps
day + time; the venue moves to its own line.

### 6.5 Event JSON-LD

A `schema.org/Event` node for La Rumba via the existing `JsonLd` component, derived from
`content.tonight` + the venue studio. Makes a recurring branded event findable in search.
Server-side only.

## 7. What deliberately does not change

The hero headline and count-in, `CinematicHeadline`, the hero video/poster treatment,
`KineticStrip`, `RhythmSignature`, `StyleFinder`, the testimonials section, `batch-order.ts`,
the Razorpay integration model (outbound links to hosted pages; no server-side checkout), the
draft → review → publish pipeline, and the auth/authz model. No countdowns, no fabricated
urgency, no invented copy, no new dependencies, no forms.

## 8. Testing

There is **no test in this repo that renders a component** (26 files, 279 tests, all green at
spec time, all logic-level). So the design deliberately puts every new decision in a pure
function that can be tested:

| module | tests |
|---|---|
| `book-label.ts` | Foundation vs higher-level copy; falls back to shipped default when a label is blank |
| `welcome-resolve.ts` | `?b=` wins over track default; resolves a past-dated batch; Intermediate batch resolves to itself, not `defaultBundle`; unknown id degrades safely |
| `nav.ts` | ids stable under label rename; the dropdown branch keys on id, not label |
| `labels.ts` | every field falls back to its shipped literal when empty |
| `content-helpers.ts` | `nextBatchPerStyle` prefers Foundation; falls back to any level and flags it |
| `enquiry.ts` | admin-authored template containing `<`, `{{` or `undefined` is rejected at save, not at click |
| `integrity.ts` | unresolvable `welcomeTrackKey` fails on write; a bad key never fails on read |

Existing tests that will fail until their registration step is done — these are guards
working as designed, not regressions:

- `roles.test.ts:13-18` — diffs `Object.keys(SiteContentSchema.shape)` against
  `SECTION_PATHS`; fails the moment `labels` exists until it is assigned to exactly one
  section. `:20-26` catches the inverse (a phantom grant).
- `admin-pages-guarded.test.ts:35-47` — every `src/app/admin/**/page.tsx` must call
  `requireSubject(` / `requireCapability(` / `requireWriteAccess(`.
- `save-pipeline.test.ts:7` and `drafts-core.test.ts` parse the bundled seed at import, so a
  schema/seed mismatch throws at module load rather than in an assertion. The seed must be
  updated in the same commit as any schema change.

Adding a defaulted field to `BatchSchema` or `WelcomeSchema`, or changing hardcoded copy to
content-driven copy, breaks nothing.

One constraint to respect: `DENY_IDS` (`roles.ts:65`) unconditionally denies `*.id` and
`*.*.id` for every role including owner, so no new field may be named `id` at depth 1–2. And
any new id-keyed array must be registered in `collections.ts:9` or it emits a coarse `set`
and cannot produce per-field diffs (`review-regressions.test.ts:28-41`).

## 9. Performance and risk

- **Zod node count** grows by ~170 string leaves across the whole document (≈50 in `labels`,
  ≈120 distributed into existing page objects), on a document parsed per request under a 10ms
  CPU cap. Keeping `labels` flat rather than nested keeps that half of the growth linear
  (§4.2), and the section-specific half adds leaves to objects that already exist rather than
  creating new nesting levels. **This is the single measurable risk in the spec.** Measure
  parse time before slice 1 and after slice 5 with the existing observability API. If the
  margin is thin, the mitigation is ready to hand: the 30s content cache (`content.ts:22`)
  currently memoises only the raw string, and can be widened to hold the parsed object —
  which removes per-request Zod cost entirely.
- **Client JS**: net new ≈ 0. Header icons are inline SVG in a server component; the ribbon
  is server markup; `QuickEnroll` is already a server component. Home first-load is ~119KB
  against a 100KB budget — already over, and unchanged by this work. Reducing it is separate,
  and worth scheduling.
- **CSP**: `frame-src` is `https://www.google.com https://maps.google.com` only
  (`next.config.mjs:87`). Nothing here embeds YouTube, so no CSP change. If a video embed is
  ever wanted, that is a separate security decision.
- **Biggest risk**: making nav labels editable before the id refactor lands would break the
  style dropdown. Sequencing (§10) puts the ids first.

## 10. Sequencing

Five slices. `labels` lands first so later slices write into it rather than being re-edited.

1. **Labels foundation** — `LabelsSchema`, `/admin/labels`, `roles.ts` + `admin/layout.tsx`
   registration, the three chokepoints (`EnquiryCTA`, `bookLabel`, id-keyed `nav.ts`).
   Absorbs ~110 render sites on its own.
2. **Post-payment** — batch + track schema fields, the admin textarea and welcome-page
   select, the derived contact block, and the six fixes in §3.4. Plus the standalone
   correction of `/p/latinl1july2026`'s venue and time.
3. **Level visibility** — level-aware `nextBatchPerStyle`, the past-date warning. *(Owner
   updates the real start dates in admin.)*
4. **Hero and header** — social icons, La Rumba ribbon, sub-headline trim, tile clip fix,
   Event JSON-LD.
5. **Editability backfill** — the ~120 section-specific strings into their own page and
   section objects (§4.2), `hero.posterAlt` and the aria labels, SEO title and description
   fields, and the WhatsApp templates with save-time validation. Largest slice, lowest risk:
   every change is one hardcoded literal becoming a defaulted schema field, and it lands
   after the chokepoints have already absorbed the duplicated half.

## 11. Owner actions outside the code

1. Update the five stale `startDate` values in `/admin/batches`. Nothing in this spec invents
   class dates.
2. Verify or replace the YouTube URL in `/admin/site`.
3. Retire `/p/latinl1july2026` once slice 2 ships (its venue and time are corrected
   immediately, ahead of that).

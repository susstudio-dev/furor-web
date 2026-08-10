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

3. **The hero has no spare vertical room.** `hero.subHeadline` is 268 characters ≈ 8 lines
   at `text-lg` in a 335px column. The hero content block (`src/components/Hero.tsx:89`,
   `pt-8 pb-36`) measures ≈690px plus a 64px sticky header — taller than a 667px iPhone SE
   viewport. `Hero.tsx:113-117` records that the "See batches" button was *deliberately
   deleted* to hold one filled action per viewport. Ask D is therefore a subtraction
   exercise, not an addition one.

A follow-up mobile audit (2026-08-10, 4 agents) then overturned two decisions taken here
and added a fifth workstream. Both reversals are recorded in §6; the mobile work is §7.

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
| 4 | Where do La Rumba and the social channels go? | ~~Header icons + a slim ribbon~~ — **superseded 2026-08-10**, see #8 and #9. |
| 5 | Hero sub-headline | **Trim to ~130 chars**; this spec drafts the copy, owner may rewrite in admin. |
| 6 | YouTube URL (`https://youtube.com/furorhyd` is not a valid channel shape) | **Keep it admin-editable**; add a format hint and validation; header renders the icon only when set. Owner verifies the real URL before deploy. |
| 7 | The wrong `/p/latinl1july2026` page | **Fix venue and time now, retire the page** once per-batch welcome notes cover the job. |

Amended after the mobile audit (2026-08-10):

| # | Decision | Answer |
|---|---|---|
| 8 | Three 44px social icons need 412px in a 335px header (§6.1) | **One icon in the mobile header — Instagram.** ThemeToggle moves into the burger drawer; all three socials get a 44px row inside the drawer and the footer. Desktop keeps all three inline. |
| 9 | The La Rumba ribbon would render invisible behind `QuickEnroll` (§6.2) | **Drop the ribbon. Move the existing `TonightTile` up** to sit directly below the booking board. It is richer, already editable, already carries the RSVP CTA, and adds no duplicate surface. |
| 10 | The `<100KB` first-load JS budget is below the measured framework floor (§9) | **Split it.** Total `< 115KB gz`; plus a hard, actionable sub-budget of **app-authored client JS `< 12KB gz` per route** (home is 23.4KB today). |
| 11 | Public routes are uncached at the edge | **Cache 60s and purge on admin save**, so an Instagram burst hits the edge while owner edits still appear immediately. |

## 2. Architecture

Everything lands in the existing single-document CMS. No new runtime dependency, no new
storage, no new runtime concept. The four asks touch four disjoint areas of one Zod schema,
plus four new pure functions in `src/lib` that carry all the new logic and all the new tests.

The fifth workstream (§7, mobile) touches no schema at all: it is a build-time image script,
a hand-written `<picture>`, CSS, and header markup.

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

### 6.1 Social icons — one in the header, all three in the drawer

> **Revised 2026-08-10.** The original design put three 44px icons in the header's right
> cluster. Measured at 375px, that does not fit and is not a matter of taste.

`container-x` is `px-5` (`globals.css:133-135`) → **335px of content width at 375px**. The
desktop `<nav>` is `hidden lg:flex` (`Header.tsx:63-64`), so below `lg` it is not a flex item
and contributes nothing. What remains:

| element | width | source |
|---|---|---|
| `BrandMark size={52}` | 156 | 52 × 363/121, measured from the PNG header |
| row `gap-3` | 12 | `Header.tsx:59` |
| `ThemeToggle` | 42 | `ThemeToggle.tsx:74,85` |
| cluster `gap-2` | 8 | `Header.tsx:96` |
| burger | 38 | `p-2` overrides `.btn-ghost` px-4 |
| **used today** | **256** | 79px slack |

Three 44px targets with `gap-2` cost `3 × (44 + 8) = 156px` → **412px needed against 335px
available**: over by 77px at 375px and **92px at 360px**, the dominant Android width in this
market. Nothing in the ancestor chain sets `overflow-x`, so it becomes a horizontally
scrolling page, not a clipped one. Every alternative was costed; only one fits at 360px.

**What ships:**

1. **Instagram alone in the mobile header**, at 44×44. It is the traffic source, and the one
   link a visitor who arrived from Instagram would use to check the school is real before
   paying.
2. **`ThemeToggle` moves into the burger drawer.** Safe: `layout.tsx:95-100` already runs a
   pre-paint script honouring `prefers-color-scheme`, so system-mode visitors are served
   correctly without ever opening it.
3. **The burger grows to 44×44** (`h-11 w-11`), from 38px — it is one of only two controls in
   the mobile header and is currently under the touch minimum.
4. **All three socials as a 44px row inside the drawer** — `3 × 44 + 2 × 12 = 156px` in a
   335px drawer, 179px spare.
5. **Mirrored in the footer**, which already renders Instagram/Facebook/YouTube as text links
   (`Footer.tsx:27-43`) but is missing WhatsApp despite already importing `buildWhatsAppHref`
   at `Footer.tsx:3`.
6. **Desktop (`lg:`) keeps all three inline** — the space exists there.

Result: header row `256 → 264px` in a 335px box. Inline SVG (~250 B gzipped each), no
requests, no client JS, sharp at every DPR. Each icon renders **only when its URL is set**.

The `SiteEditor` YouTube field gains a format hint (`https://youtube.com/@handle`) and
URL-shape validation. **Owner action:** verify the stored `https://youtube.com/furorhyd`
resolves, or replace it. Until then that icon does not render.

### 6.2 La Rumba — move the tile, don't add a ribbon

> **Revised 2026-08-10.** The specced ribbon would have been invisible.

`QuickEnroll` is `relative z-20 -mt-24` on an opaque fill (`QuickEnroll.tsx:77`, and
`.quick-enroll` fakes glass over a solid background). It pulls up 96px into the hero's
`pb-36`, so it begins **64px above** where a 32px in-flow ribbon between `<Hero>` and
`<QuickEnroll>` would start. The ribbon would have been painted over completely.

The better answer is that the ribbon was redundant anyway: `TonightTile` (`page.tsx:278`)
already renders "La Rumba · Latin Social" from `content.tonight` — with a live-dot pill, body
copy and an RSVP CTA — and `tonight.enabled` is already `true`. It was simply sitting eleven
sections down the page.

**So: move `TonightTile` up to sit directly below the booking board** (first child of the
`relative` wrapper at `page.tsx:71`, before `KineticStrip`). It is richer than a ribbon,
already admin-editable, already converts, costs the fold nothing, and adds no second La Rumba
surface to reconcile.

### 6.3 Trim the hero sub-headline — the change that makes room

The 268-character sub-headline runs ~8 lines at `text-lg` (18px/28px) in a 335px column and
costs ~110px more than it needs to. Trimming it moves the booking board **up** the phone
screen — which is the point, since the board is the conversion surface and is currently below
the fold.

It is also reused verbatim as the home meta description (`page.tsx:24`). **Decouple those**
so SEO copy stops dictating what a visitor sees first; the meta description gets its own
field from §4.4.

Proposed copy (142 chars), owner-editable in admin:

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
(`TonightTile.tsx:10`). The live value is 67 characters — `"Every Saturday · 7 PM onwards at
Over the Moon Brew Co, Gachibowli "`, trailing space included. On a 375px phone the tail,
**including the venue name**, is cut off: not wrapped, not scrollable, not visible. Moving La
Rumba up the page starts by making it legible.

Two changes, one content and one structural:

1. **Content.** `tonight.when` becomes `"Every Saturday · 7 PM"`; the venue moves into
   `tonight.body`. Strip the trailing space.
2. **Structural.** Harden `.pill` at `globals.css:139` with `max-w-full overflow-hidden
   text-ellipsis`. This protects the **ten other `.pill` call sites that render
   admin-controlled text** (`QuickEnroll.tsx:161`, `page.tsx:189`, `page.tsx:368`,
   `instructors/page.tsx:83-86`, …). Without it, every newly-editable label from §4 that
   lands in a pill is a fresh instance of this same bug — a long string razor-cutting itself
   with no warning to whoever typed it.

This is why §4 also adds a character-count hint in the admin for any field that renders into
a pill.

### 6.5 Event JSON-LD

A `schema.org/Event` node for La Rumba via the existing `JsonLd` component, derived from
`content.tonight` + the venue studio. Makes a recurring branded event findable in search.
Server-side only.

## 7. Mobile optimization

Added 2026-08-10 after a 4-agent mobile audit. Every number below was measured, not
estimated — the AVIF sizes come from encoding the real files with the installed `sharp`.

This matters more than any other section here: visitors arrive **mostly on mobile**, from
Instagram and WhatsApp forwards, on mid-range Android over Indian mobile data. The home route
currently ships **1,454,235 bytes of images**.

### 7.1 The three findings that dominate everything else

**1. `next/image` emits no `srcset` and no `sizes` at all.** `next.config.mjs:112` sets
`images: { unoptimized: true }` because there is no optimizer on the Workers free plan.
Verified in the installed Next 15.5.22 source — `generateImgAttrs` in
`next/dist/shared/lib/get-img-props.js:96-103` returns early when `unoptimized` is set,
discarding `srcSet` **and** `sizes` before either reaches the element. **All ten `sizes=`
props in this codebase are dead code.** A 375px phone downloads the identical 2000×1335 file
a 4K desktop does.

**2. The photos are ~5–12× oversized for every slot they appear in.** All ten
`public/photos/*.jpg` are the same 2000×1335 (2.7 MP) landscape master. Hero: 5.3× linear
oversize. Style cards: 6.0×. Studio thumbnails: **12.4×** — 191 KB for a 161px-wide image.

**3. On a light-theme phone the hero photo is very nearly invisible.** `.hero-scrim-x`
(`globals.css:200-208`, the base rule that light-theme mobile gets) is **fully opaque**
`ink-950` from 0% to 66%, then 0.92 at 86% and 0.74 at 100%. So 297 KB is downloaded,
decoded into ~10.7 MB of phone memory, and painted almost entirely behind a solid rectangle.

### 7.2 Measured savings

Encoded from the real source files with `sharp@0.34.5`, already present in `node_modules`:

| asset | today | after | saving |
|---|---|---|---|
| hero, mobile portrait crop 750×1380 AVIF q50 | 297,280 B | 40,488 B | **−86.4%** |
| hero, same at q40 | 297,280 B | 28,105 B | −90.5% |
| hero, zero-format-risk JPEG at the right crop | 297,280 B | 82,894 B | −72.1% |
| style card 750×938 AVIF q50 | 249,269 B | 34,421 B | −86.2% |
| studio photo 750×562 AVIF q50 | 285,131 B | 39,783 B | −86.0% |
| `rishi.png` (a photograph stored as PNG) → AVIF | 265,600 B | 16,000 B | −94% |
| **home route, all images** | **1,454,235 B** | **~222,000 B** | **−85%** |
| **`/instructors`** | **6,926,052 B** | **~55,000 B** | **−99.2%** |

The mobile hero win comes as much from the **crop** as the format: the render box is 375×690
CSS px (aspect 0.543) while the source is 1.498 — `object-cover` throws away 63.7% of the
width. A purpose-built portrait crop stops paying for pixels that are never on screen.

### 7.3 The slice

**M1 — Build-time responsive images.** A new `scripts/build-images.mjs` using `sharp`, run as
a manual/prebuild step, emitting AVIF + WebP + JPEG variants committed to `public/photos/`:
hero portrait 750×1380 and 1125×2070 (gravity matching `object-[78%_38%]`), hero landscape
1080×721 for `sm:+`, style cards 750×938, studio 750×562 and thumbs 384×288, avatars 256/512.
`sharp` becomes an explicit **devDependency** — it is currently only a transitive of Next, so
relying on it undeclared is fragile. Build-time only: zero Worker CPU, no interaction with the
10ms cap, no Cloudflare spend.

**M2 — Hand-written `<picture>` on the hero, and honest priority hints.** Since `next/image`
contributes nothing but `decoding="async"` under `unoptimized`, the LCP element gets a real
`<picture>` with AVIF and WebP `<source>`s (which must precede the `<img>`) plus a JPEG
fallback, `fetchpriority="high"`, and a hand-written matching `<link rel="preload">` — a bare
AVIF preload would be wasted on a browser that picks WebP. Also removes the competing
`priority` on `BrandMark.tsx:28`. Delete the ten dead `sizes` props.

**M3 — Header, per §6.1.** Must land before any social icon ships, or the primary surface
scrolls sideways.

**M4 — Reclaim the fold.** The §6.3 sub-headline trim, plus `Hero.tsx:89` `pb-36 → pb-28`,
`mt-6 → mt-4` on the sub and `mt-8 → mt-6` on the CTA block. Estimated to move the board's top
edge from ~736px to ~556px — **111px of the card visible on a 667px iPhone SE**, where today
it is entirely below the fold.

**M5 — Cap uploads at the source.** Resize client-side in the admin before upload
(`createImageBitmap` + `OffscreenCanvas` + `convertToBlob`, long edge ≤1600px), with a
server-side ceiling as a backstop. **It must be client-side**: re-encoding in the Worker is
seconds of CPU against a 10ms cap. Without this, admin uploads silently bypass M1 and the
`/instructors` problem returns.

**M6 — Edge caching (decision #11).** `public, max-age=0, s-maxage=60,
stale-while-revalidate=600` on public routes, with a purge from the admin save handler so
owner edits still appear immediately. `/admin` keeps `no-store`
(`next.config.mjs:129-133`). Add `immutable` rules to `public/_headers` for `/uploads/*`
(filenames are server-generated UUIDs, so this is genuinely safe) and for M1's variants.

**M7 — De-risk the fold against the font swap.** The h1's second line sits at ~309px in a
335px column — 8% headroom, one font-swap away from becoming three lines and swinging the
fold by 40px, which would dwarf every padding tweak in M4. Replace the `Georgia` fallback at
`globals.css:148` with `var(--font-sans)`, whose metrics are far closer. Also scope
`.animate-kenburns` to `sm:+` — it drives an infinite compositor animation over ~11.7 MB of
GPU texture on phones, for an effect hidden behind the opaque scrim anyway.

### 7.4 Explicitly rejected

Listed so they are not re-litigated: **Cloudflare Polish** (Pro plan only) and **Image
Transformations** (would require turning `unoptimized` off, re-enabling an 8-entry srcset that
burns ~8 of the ~5,000 free monthly transformations *per image*, plus a Worker subrequest per
image — build-time AVIF is free and measured). Also rejected: an `overflow-x: clip` guard on
`body` (it would hide the exact class of bug §6.1 exists to prevent, making future overflow
silent instead of visible); the `MagneticInit` layout thrash (behind `pointer: fine`, so zero
mobile cost); footer tap-target debt (real, but below the fold on the last screen of every
page — track separately); and making `Hero` a server component (correct, worth ~5–12 KB, but
a refactor competing for review attention with 1.23 MB of image savings — queue it after
M1–M4 are measured).

### 7.5 What must be measured

Capture **before** touching anything, since two items rest on estimated glyph advances:

| metric | today | how |
|---|---|---|
| home image bytes | 1,454,235 B / 7 requests | commit `scripts/audit-image-weight.mjs` so it stays re-runnable |
| LCP resource bytes | 297,280 B | same script, hero only. Target < 45,000 B |
| Lighthouse mobile LCP/CLS/INP | est. ~2,870 ms LCP | `npx lighthouse --preset=perf --form-factor=mobile` against the deployed Worker, median of 3 |
| first-load JS | 123.60 KB gz home; floor 100.14 KB | `next build` + a committed `scripts/audit-bundle.mjs` |
| **board position on a 375×667 phone** | est. 736px | DevTools `document.querySelector('#start-this-week').getBoundingClientRect().top`. **This is the number that validates or kills M4's arithmetic — measure it first.** |
| no horizontal scroll | 256px used of 335 | assert `documentElement.scrollWidth === innerWidth` at 360, 375, 390px |
| Worker CPU vs the 10ms cap | unknown | `wrangler tail`; `wrangler.jsonc:69` already enables observability |
| AVIF in the Instagram in-app browser | unverified | open the deployed URL from a real `@furorhyd` link on iOS and Android; confirm the AVIF source is chosen |

There is no Lighthouse, Playwright or Puppeteer in this repo — browser-side numbers run via
`npx` or against the deployed Worker.

**Two unknowns to resolve cheaply first:** why `next/font` currently emits **zero** font
preloads (candidates: `htmlLimitedBots` at `next.config.mjs:102`, the fully-dynamic root
layout via `await connection()` at `layout.tsx:76`, or Next 15.5 behaviour — the fix differs
by cause); and whether `NEXT_PUBLIC_GA4_ID` is actually set in production, because if it is,
`gtag.js` loads `afterInteractive` (`Analytics.tsx:13,15`), inside the INP window on a
mid-range Android.

## 8. What deliberately does not change

The hero headline and count-in, `CinematicHeadline`, `KineticStrip`, `RhythmSignature`,
`StyleFinder`, the testimonials section, `batch-order.ts`, the Razorpay integration model
(outbound links to hosted pages; no server-side checkout), the draft → review → publish
pipeline, and the auth/authz model. No countdowns, no fabricated urgency, no invented copy,
no forms.

**No new runtime dependency.** §7 adds `sharp` to **devDependencies** only — it already sits
in `node_modules` as a transitive of Next, and declaring it makes the build-time image script
reproducible. Nothing new ships to the browser or the Worker.

The hero *poster treatment* does change (§7.2): same photograph, same crop intent, new
formats and a mobile-specific crop. The visual result is intended to be indistinguishable.

## 9. Testing

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

## 10. Performance and risk

- **Zod node count** grows by ~170 string leaves across the whole document (≈50 in `labels`,
  ≈120 distributed into existing page objects), on a document parsed per request under a 10ms
  CPU cap. Keeping `labels` flat rather than nested keeps that half of the growth linear
  (§4.2), and the section-specific half adds leaves to objects that already exist rather than
  creating new nesting levels. **This is the single measurable risk in the spec.** Measure
  parse time before slice 1 and after slice 5 with the existing observability API. If the
  margin is thin, the mitigation is ready to hand: the 30s content cache (`content.ts:22`)
  currently memoises only the raw string, and can be widened to hold the parsed object —
  which removes per-request Zod cost entirely.
- **Client JS**: net new ≈ 0. Header icons are inline SVG; `QuickEnroll` and `TonightTile` are
  already server components.
- **The first-load JS budget is unmeetable as written (decision #10).** Measured: the
  React/Next framework floor alone is **100.14 KB gz** — above the stated `<100KB` budget
  before a single line of application code. Home is 123.60 KB. The budget splits into a total
  of **`< 115KB gz`** plus a hard, actionable sub-budget of **app-authored client JS
  `< 12KB gz` per route** (home is 23.46 KB today). `PRODUCT.md` is updated to say so; the old
  number was unreachable without leaving Next.js for an islands architecture, which is a
  separate decision and is complicated by `/admin` sharing the root layout.
- **CSP**: `frame-src` is `https://www.google.com https://maps.google.com` only
  (`next.config.mjs:87`). Nothing here embeds YouTube — the header links out — so no CSP
  change. A video embed would be a separate security decision.
- **Two named risks**, both sequenced around in §11: making nav labels editable before the
  id refactor lands would break the style dropdown; and shipping a social icon into the
  mobile header before §6.1's header fix would push the primary surface into horizontal
  scroll.
- **The one freshness trade** is M6: public routes gain a 60s edge cache. Owner edits still
  appear immediately via a purge on save, so the 30s freshness promise in `PRODUCT.md` holds
  for the admin path; anonymous visitors may see up to 60s-old content.

## 11. Sequencing

Six slices. `labels` lands first so later slices write into it rather than being re-edited;
the image work is independent of everything else and can run in parallel.

1. **Labels foundation** — `LabelsSchema`, `/admin/labels`, `roles.ts` + `admin/layout.tsx`
   registration, the three chokepoints (`EnquiryCTA`, `bookLabel`, id-keyed `nav.ts`).
   Absorbs ~110 render sites on its own.
2. **Post-payment** — batch + track schema fields, the admin textarea and welcome-page
   select, the derived contact block, and the six fixes in §3.4. Plus the standalone
   correction of `/p/latinl1july2026`'s venue and time.
3. **Level visibility** — level-aware `nextBatchPerStyle`, the past-date warning. *(Owner
   updates the real start dates in admin.)*
4. **Hero and header** — the §6.1 header fix **first**, then the Instagram icon and drawer
   row, `TonightTile` moved up, the sub-headline trim, the `.pill` hardening and tile content
   fix, Event JSON-LD.
5. **Editability backfill** — the ~120 section-specific strings into their own page and
   section objects (§4.2), `hero.posterAlt` and the aria labels, SEO title and description
   fields, and the WhatsApp templates with save-time validation. Largest slice, lowest risk:
   every change is one hardcoded literal becoming a defaulted schema field, and it lands
   after the chokepoints have already absorbed the duplicated half.
6. **Mobile optimization (§7)** — M1/M2 images, M4 fold, M5 upload caps, M6 edge cache,
   M7 font fallback. **Independent of slices 1–3 and 5**, so it can run in parallel; its only
   ordering constraint is that M3 (the header) is the same work as slice 4's first step and
   must precede the social icon.

Highest value first, if slices must be prioritised: **slice 6's M1+M2 alone remove ~85% of
the home route's bytes** and are the largest single improvement available to a visitor
arriving from Instagram on mobile data.

## 12. Owner actions outside the code

1. Update the five stale `startDate` values in `/admin/batches`. Nothing in this spec invents
   class dates.
2. Verify or replace the YouTube URL in `/admin/site`.
3. Retire `/p/latinl1july2026` once slice 2 ships (its venue and time are corrected
   immediately, ahead of that).
4. Edit `tonight.when` down to `"Every Saturday · 7 PM"` and move the venue into
   `tonight.body` (§6.4) — a content change, not a code change.
5. Confirm whether `NEXT_PUBLIC_GA4_ID` is set in production (§7.5). If it is not, the paid
   conversion path has no measurement at all and none of this work can be evaluated.

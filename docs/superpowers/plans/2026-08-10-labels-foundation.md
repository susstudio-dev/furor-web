# Labels Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the editable-string foundation — one flat `labels` content key with 56 shipped defaults, a `/admin/labels` screen, and the three chokepoints (`EnquiryCTA`, `bookLabel()`, an id-keyed `nav.ts`) that absorb ~110 render sites — without changing a single rendered character on the public site.

**Architecture:** A new top-level Zod key `labels` (flat, every field `z.string().default('<the exact literal shipping today>')`) plus three new pure modules in `src/lib` — `labels.ts` (resolver + shipped defaults), `book-label.ts` (one booking verb, one status casing) and `nav.ts` (stable id-keyed nav shared by Header and Footer). All new decision logic lives in those pure functions, which is where all the new tests live; the components only consume them. One searchable `/admin/labels` grid renders the whole flat key set from `LABEL_DEFAULTS`, so no field list is hand-maintained.

**Tech Stack:** Next.js 15 App Router, Zod 3 single-document CMS, vitest 4 (node environment, no DOM), TypeScript strict (ES2022), Cloudflare Workers free plan.

**Execution order:** Plan 1 of 4. Runs first, before `docs/superpowers/plans/2026-08-10-mobile-foundation.md`. Spec §4.3 is explicit that stable nav `id`s must land **before** any label becomes editable — `Header.tsx:32` currently branches on `item.label === 'Dance Styles'`, so the first rename in `/admin/labels` would silently empty the style dropdown. The same ordering is what stops Plan 2's header/footer rewrite from shipping seven fresh hardcoded `aria-label`s and a `POSTER_ALT` constant that would strand `hero.posterAlt` permanently: this plan defines `ariaToggleMenu`, `ariaMenu`, `ariaSocialInstagram`, `ariaSocialFacebook`, `ariaSocialYoutube`, `ariaSocialWhatsapp` and makes `Hero.tsx` read `content.hero.posterAlt` so Plan 2 has something to consume.

## Global Constraints

- **R1 — Anchor every edit on unique TEXT, never on a line number.** Four plans edit `content-schema.ts`, `page.tsx`, `Hero.tsx`, `Header.tsx`, `Footer.tsx`, `WelcomeView.tsx`, `seo.ts` and the seed. Line numbers are invalid the moment an earlier plan runs. Every Modify step below quotes a unique surrounding string as its anchor; any line number in this document is orientation only.
- **R2 — Never hand-write `src/data/site-content.seed.json`.** `scripts/sync-seed.mjs` regenerates the seed **from** `data/site-content.json`, so a hand-written seed edit is destroyed by the next `npm run sync-seed`. Any content-data change edits `data/site-content.json`, then runs `npm run sync-seed`, and commits the tracked seed `src/data/site-content.seed.json`. **`data/site-content.json` is GITIGNORED** (`.gitignore:8-9`) and can never appear in a commit — a `git add data/site-content.json` step silently no-ops, and any clean-tree gate that assumes it was committed is misleading. The seed is the tracked artifact and the fallback the app serves on a fresh clone or in CI. **This plan makes no content-data change at all** — every new field is `z.string().default(...)`, which is the documented no-migration mechanism (spec §2), and duplicating 56 literals into two JSON files would create a third place for them to drift. Task 9 proves the two files stayed in sync with `npm run sync-seed -- --check`, expecting `✓ seed is in sync with data/site-content.json`.
- **R3 — Content validation NEVER goes on the read path.** No `.refine()` / `.superRefine()` that can reject a stored document. `src/lib/content.ts` wraps `SiteContentSchema.parse(mergeWithSeed(...))` in a `try` whose `catch` returns `seedResult()`, so a read-path refine turns one bad field into a site-wide outage. Nothing in this plan adds a refine. Cross-record and format validation belongs in `src/lib/integrity.ts` (write path only), beside the existing `branchSlug` check.
- **R4 — Never `Write` a test file another plan already created.** Within this plan, `src/lib/labels.test.ts` is created once (Task 1) and **appended** in Tasks 2, 5 and 8 — each append extends the single import block at the top of the file rather than adding a second import statement for the same module. Do **not** create `src/lib/content-schema.ts`'s test file (`src/lib/content-schema.test.ts`): Plan 3 creates it.
- **R5 — Every code step contains real, complete code.** No "following X exactly", no "similar to Task N", no TBD/TODO, no deliberately-wrong-then-corrected code.
- **R6 — Test-count arithmetic must add up.** Baseline is **26 files / 279 tests** (verified 2026-08-10, `npx vitest run`, Node v24.18.0, vitest 4.1.10). This plan's own delta is **+3 files / +38 tests**, so it ends at **29 files / 317 tests**. If an earlier change shifts the baseline, carry the delta, not the absolute: three new files (`labels.test.ts` 21, `book-label.test.ts` 9, `nav.test.ts` 7 = 37) plus **one** extra case in the existing `src/lib/admin-pages-guarded.test.ts` `it.each` sweep, which today runs 1 + 31 admin pages = 32 tests and becomes 33 when `/admin/labels/page.tsx` is added. 279 + 37 + 1 = 317.
- **R7 — Commit style:** lowercase conventional prefix, imperative. **NEVER add a `Co-Authored-By` trailer to any commit.**
- **R8 — No runtime dependency.** No new npm package of any kind in this plan.
- Every new content field MUST be `.default('<the exact literal shipping today>')`. A required field fails validation on read and serves the bundled seed site-wide.
- `labels` stays **flat**. Every public request runs a full `SiteContentSchema.parse` under the Workers free-plan 10 ms CPU cap and Zod cost scales with node count: 56 string leaves in one object is linear growth; the same 56 split across nested groups is not. Flat also lets `/admin/labels` render as one searchable grid instead of a stack of accordions.
- Adding a top-level content key REQUIRES registering it in `SECTION_PATHS` (`src/lib/roles.ts`) or `src/lib/roles.test.ts` fails.
- Any new `src/app/admin/**/page.tsx` MUST call `requireWriteAccess(` / `requireSubject(` / `requireCapability(` or `src/lib/admin-pages-guarded.test.ts` fails.
- `DENY_IDS` (`src/lib/roles.ts`) denies `*.id` and `*.*.id` for every role including owner. No new field named `id` at depth 1–2.
- **Never expose in admin:** analytics event names, schema.org vocabulary, route paths / `href`s, CSS class hooks, `razorpay_payment_link_status`, and the Zod **enum values** `Open` / `Filling Fast` / `Closed` and `Foundation` / `Intermediate` / `Advanced` — the status values are live URL state in `BatchesBrowser` and renaming them would break bookmarked links. Display labels for those enums become editable; the values do not.
- Tests are vitest: `npx vitest run`, config `vitest.config.mts`, `include: ['src/**/*.test.ts']`, `environment: 'node'`. Colocated as `src/lib/foo.ts` → `src/lib/foo.test.ts`, matching `src/lib/batch-order.test.ts` / `src/lib/roles.test.ts`: `import { describe, expect, it } from 'vitest';` on line 1, a tiny local factory helper, one `describe` per exported symbol.
- **No test in this repo renders a React component.** Do not add React Testing Library or jsdom. Markup-only work is verified by a concrete manual check and ships with no automated regression cover — each such step says so explicitly.
- `npm run typecheck` = `tsc --noEmit` and must be clean at the end of every task **after** its implementation step. During a red step it may legitimately fail on the not-yet-added field; the steps say when.

---

## File Structure

| File | Created / Modified | The ONE responsibility |
|---|---|---|
| `src/lib/content-schema.ts` | Modify | `LabelsSchema` (56 defaulted strings), `type Labels`, `hero.posterAlt`, `labels` on `SiteContentSchema` |
| `src/lib/labels.ts` | Create | `LABEL_DEFAULTS`, `LabelKey`, `Labels`, `label()` fallback, `enquiryDefaultLabel()`, `PILL_KEYS`, `PILL_CHAR_LIMIT` |
| `src/lib/labels.test.ts` | Create | Pins every shipped default literal, the empty-value fallback and the enquiry default chain |
| `src/lib/book-label.ts` | Create | `bookLabel(level, labels)` + `statusLabel(status, labels)` — one booking verb, one status casing |
| `src/lib/book-label.test.ts` | Create | Foundation vs higher level; blank falls back; the `Filling Fast`/`Filling fast` split is gone |
| `src/lib/nav.ts` | Create | `NavItem`, `NAV_ITEMS` with stable ids, `navLabel()` |
| `src/lib/nav.test.ts` | Create | Ids survive a label rename; the dropdown branch keys on id, not text |
| `src/lib/roles.ts` | Modify | Register `labels` as its own grantable section |
| `src/app/admin/layout.tsx` | Modify | `/admin/labels` menu entry + its section mapping |
| `src/app/admin/labels/page.tsx` | Create | Guarded server shell for the labels screen |
| `src/app/admin/labels/LabelsEditor.tsx` | Create | Searchable grid generated from `LABEL_DEFAULTS`; placeholder = shipped default; reset-to-default |
| `src/components/EnquiryCTA.tsx` | Modify | Chokepoint 1 — content-driven default labels via a required `labels` prop |
| `src/components/BatchActions.tsx` | Modify | Chokepoint 2 — consume `bookLabel()`; take `labels` |
| `src/components/QuickEnroll.tsx` | Modify | Chokepoint 2 — consume `bookLabel()` / `statusLabel()`; thread `labels` |
| `src/components/Hero.tsx` | Modify | Chokepoint 2 CTA + read `content.hero.posterAlt` |
| `src/components/BatchesBrowser.tsx` | Modify | Chokepoint 2 — `statusLabel()` everywhere; take `labels` |
| `src/components/Header.tsx` | Modify | Chokepoint 3 — consume `NAV_ITEMS` / `navLabel`; dropdown keys on `id` |
| `src/components/Footer.tsx` | Modify | Chokepoint 3 — consume `NAV_ITEMS` / `navLabel`; Call / WhatsApp / Privacy / Terms labels |
| `src/components/StyleFinder.tsx` | Modify | Take `labels` for its two `EnquiryCTA`s |
| `src/components/FloatingTalkToUs.tsx` | Modify | Take `labels`; its own aria + "Talk to us" copy |
| `src/components/StickyTrialBar.tsx` | Modify | Take `labels` for its icon-variant aria label |
| `src/components/TrialBanner.tsx` | Modify | Pass `labels` through to its two `EnquiryCTA`s |
| `src/components/TonightTile.tsx` | Modify | Pass `labels` through to its `EnquiryCTA` |
| `src/app/layout.tsx` | Modify | Pass `labels` into `FloatingTalkToUs` |
| `src/app/page.tsx` | Modify | Pass `labels` into every child that now needs it; `bookLabel` for `trialLabel` |
| `src/app/batches/page.tsx` | Modify | Pass `labels` into `BatchesBrowser` |
| `src/app/dance-styles/[slug]/page.tsx` | Modify | Pass `labels`; `statusLabel` for its inline pill |
| `src/app/about/page.tsx` | Modify | Pass `labels` into its two `EnquiryCTA`s |
| `src/app/contact/page.tsx` | Modify | Pass `labels` into its two `EnquiryCTA`s |
| `src/app/faqs/page.tsx` | Modify | Pass `labels` into its two `EnquiryCTA`s |
| `src/app/instructors/page.tsx` | Modify | Pass `labels` into its two `EnquiryCTA`s |
| `src/app/admin/hero/HeroEditor.tsx` | Modify | The `posterAlt` field |

**Deliberately NOT in this plan** (they belong to Plan 4, `2026-08-10-editability-backfill.md`): the 12 `filter*` keys and the `/batches` filter-bar copy, which move onto the batches-page screen per spec §4.2 ("the studio edits the batches page copy on the batches screen"); `site.footerCopyright`; `seoTitle` / `seoDescription`; the WhatsApp prefill templates; and every per-screen string backfill.

---

### Task 1: `LabelsSchema` — the 56 cross-cutting literals

**Files:**
- Modify: `src/lib/content-schema.ts` (anchors: `export const SiteContentSchema = z.object({` and `export type WelcomeTrack = z.infer<typeof WelcomeTrackSchema>;`)
- Test: `src/lib/labels.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export const LabelsSchema: z.ZodDefault<z.ZodObject<...>>;  // 56 z.string().default('<literal>') fields
  export type Labels = z.infer<typeof LabelsSchema>;
  ```

This task deliberately does **not** add `labels` to `SiteContentSchema` — that lands in Task 3 together with its `SECTION_PATHS` registration, so the suite is green at every commit.

**Why 56 and not 62.** The spec budgets "~50 cross-cutting strings" and the budget exists for Zod parse cost under the 10 ms CPU cap. The 12 `filter*` keys move to Plan 4's batches-page screen (62 − 12 = 50); four new `ariaSocial*` keys are added here so Plan 2's header/footer social icons consume them instead of hardcoding four fresh `aria-label`s that nothing would ever make editable; and the post-payment group carries **five** `welcome*` keys rather than three, because those five are exactly what Plan 3's welcome-page rewrite consumes. 50 + 4 + 2 = **56**.

**Which plan consumes what.** Tasks 5–8 below wire up `cta*` (all 18), `nav*` (all 11), `badge*` (`badgeFillingFast`, `badgeOpen`, `badgeClosed`), `ariaHome`, `ariaPrimaryNav`, `ariaToggleMenu`, `ariaMenu`, `ariaClose`, `ariaOpenTalkToUs`, `ariaCloseTalkToUs`. Plan 2 consumes `ariaSocialInstagram` / `Facebook` / `Youtube` / `Whatsapp` (new markup) and must preserve the four Header aria labels this plan wires. **Plan 3 (`2026-08-10-post-payment-batches.md`) consumes all five `welcome*` keys** in one contact block: `welcomeWhereHeading` and `welcomeOpenMap` replace the two literals already on the "Where" card (`WelcomeView.tsx:254` and `:265`), and `welcomeParking`, `welcomeReachUs` and `welcomeCallPhone` are the three rows Plan 3 adds beneath it. Plan 4 consumes the five `empty*` keys, `badgeBookingOpen` and `badgeFoundationStartHere`.

**`welcomeGetDirections` does not exist — Plan 3 must consume `welcomeOpenMap`.** The map link ships `Open map →` today (`WelcomeView.tsx:265`), and the whole premise of this schema is that every default reproduces the literal shipping today. A key defaulting to `Get directions →` would silently rewrite visitor-facing copy on first deploy.

- [ ] **Step 1: Write the failing test**

Create `src/lib/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';

const labels = (over: Partial<Labels> = {}): Labels => LabelsSchema.parse(over);

describe('LabelsSchema', () => {
  // Pinned budget. The spec allows ~50 cross-cutting strings because every
  // public request runs a full SiteContentSchema.parse under a 10ms CPU cap
  // and Zod cost scales with node count. The 12 filter* keys deliberately
  // live on the batches page instead of here.
  it('parses an empty object into the full shipped label set', () => {
    expect(Object.keys(labels())).toHaveLength(56);
  });

  // The four screen-reader labels Plan 2's header/footer rewrite must consume
  // instead of hardcoding. They have no render site today; they exist so the
  // rewrite has something editable to point at.
  it('carries the social aria labels the icon links will need', () => {
    const l = labels();
    expect(l.ariaSocialInstagram).toBe('Furor on Instagram');
    expect(l.ariaSocialFacebook).toBe('Furor on Facebook');
    expect(l.ariaSocialYoutube).toBe('Furor on YouTube');
    expect(l.ariaSocialWhatsapp).toBe('Furor on WhatsApp');
  });

  // The deduplication payoff: "Chat on WhatsApp" ships at 10 render sites and
  // "DM on Instagram" at 8.
  it('reproduces the enquiry CTA literals exactly', () => {
    const l = labels();
    expect(l.ctaChatWhatsapp).toBe('Chat on WhatsApp');
    expect(l.ctaEnquireWhatsapp).toBe('Enquire on WhatsApp');
    expect(l.ctaDmInstagram).toBe('DM on Instagram');
    expect(l.ctaBookFoundation).toBe('Book my first class');
    expect(l.ctaBookTrial).toBe('Book my trial class');
  });

  it('carries the nav item set that Header and Footer both render', () => {
    const l = labels();
    expect(l.navHome).toBe('Home');
    expect(l.navDanceStyles).toBe('Dance Styles');
    expect(l.navBatches).toBe('Batches & Pricing');
    expect(l.navBlog).toBe('Blog');
    expect(l.navExplore).toBe('Explore');
  });

  // The live inconsistency this key exists to kill: QuickEnroll prints the raw
  // enum "Filling Fast" while BatchesBrowser hardcodes "Filling fast" — two
  // casings of one word on one site.
  it('gives the status enums one display casing', () => {
    const l = labels();
    expect(l.badgeFillingFast).toBe('Filling fast');
    expect(l.badgeOpen).toBe('Open');
    expect(l.badgeClosed).toBe('Closed');
  });

  it('keeps a stored value over the default', () => {
    const l = labels({ ctaChatWhatsapp: 'Message us' });
    expect(l.ctaChatWhatsapp).toBe('Message us');
    expect(l.ctaDmInstagram).toBe('DM on Instagram');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/labels.test.ts`
Expected: FAIL with `TypeError: Cannot read properties of undefined (reading 'parse')` — `LabelsSchema` is not exported yet, so the imported binding is `undefined` when `labels()` calls `.parse`. (There is no `vi.mock` anywhere in this repo, so no mock-related message can appear.)

- [ ] **Step 3: Add `LabelsSchema` to `content-schema.ts`**

In `src/lib/content-schema.ts`, insert the following immediately **before** the line `export const SiteContentSchema = z.object({`:

```ts
// ─── Cross-cutting labels ──────────────────────────────────────────────────
// The 56 strings that recur across many components and have no natural owning
// section: CTA verbs, nav items, badge labels, empty states, screen-reader
// text. Section-specific headings and body copy do NOT live here — they go on
// their own page/section object, following the ctaLabel / whatsappLabel
// convention already used above (TrialSchema).
//
// FLAT on purpose. Every public request runs a full SiteContentSchema.parse
// under the Workers free-plan 10ms CPU cap, and Zod cost scales with node
// count: 56 string leaves in one object is linear growth; the same 56 split
// across nested groups is not. Flat also lets /admin/labels render as one
// searchable grid instead of a stack of accordions.
//
// Every default is the exact literal shipping today, with two documented
// exceptions. (1) The four ariaSocial* labels have no render site yet — they
// exist so the header/footer social icons consume an editable string instead
// of hardcoding a fresh one. (2) welcomeParking, welcomeReachUs and
// welcomeCallPhone have no render site yet either: the welcome page has no
// parking line, no "Reach us" block and no call link today. Plan 3 adds those
// three rows, so the defaults here are the literals PLAN 3 RENDERS, not
// literals lifted from the current file. The other two welcome keys are lifted
// from the current file (WelcomeView.tsx:254 and :265).
//
// A REQUIRED field here would fail validation on read and serve the bundled
// seed site-wide, so defaults are what make this a no-migration change.
export const LabelsSchema = z
  .object({
    // — Calls to action —
    ctaChatWhatsapp: z.string().default('Chat on WhatsApp'),
    ctaEnquireWhatsapp: z.string().default('Enquire on WhatsApp'),
    ctaDmInstagram: z.string().default('DM on Instagram'),
    ctaBookFoundation: z.string().default('Book my first class'),
    ctaBookTrial: z.string().default('Book my trial class'),
    ctaChatFirst: z.string().default('or chat first'),
    ctaChatFirstWhatsapp: z.string().default('or chat first on WhatsApp'),
    ctaChatOnWhatsapp: z.string().default('or chat on WhatsApp'),
    ctaEnquire: z.string().default('Enquire'),
    ctaNotifyWhatsapp: z.string().default('Notify me on WhatsApp'),
    ctaGrabSeatWhatsapp: z.string().default('Grab a seat on WhatsApp'),
    ctaTalkToUs: z.string().default('Talk to us'),
    ctaSeeAllBatches: z.string().default('See all batches'),
    ctaAllStyles: z.string().default('All styles'),
    ctaExplore: z.string().default('Explore →'),
    ctaGetDirections: z.string().default('Get directions'),
    ctaCall: z.string().default('Call'),
    ctaWhatsapp: z.string().default('WhatsApp'),

    // — Navigation —
    navHome: z.string().default('Home'),
    navAbout: z.string().default('About'),
    navDanceStyles: z.string().default('Dance Styles'),
    navInstructors: z.string().default('Instructors'),
    navBatches: z.string().default('Batches & Pricing'),
    navBlog: z.string().default('Blog'),
    navFaqs: z.string().default('FAQs'),
    navContact: z.string().default('Contact'),
    navExplore: z.string().default('Explore'),
    navPrivacy: z.string().default('Privacy'),
    navTerms: z.string().default('Terms'),

    // — Empty states —
    emptyNoBatches: z
      .string()
      .default(
        "No batches match these filters yet. Chat with us — we'll tell you when one opens.",
      ),
    emptyNextBatchSoon: z.string().default('Next {style} batch coming soon.'),
    emptyNewBatchesTitle: z.string().default('New batches drop every week.'),
    emptyNewBatchesBody: z
      .string()
      .default("Tell us your style — we'll hold you a seat in the next one."),
    emptyNoFinderBatch: z
      .string()
      .default(
        'No upcoming {track} beginner batch listed yet — chat with us and we’ll tell you when the next one starts.',
      ),

    // — Badges. These are DISPLAY labels for the status enum; the enum VALUES
    //   are live URL state in BatchesBrowser and never change.
    badgeFillingFast: z.string().default('Filling fast'),
    badgeOpen: z.string().default('Open'),
    badgeClosed: z.string().default('Closed'),
    badgeBookingOpen: z.string().default('Booking open'),
    badgeFirstTimersWelcome: z.string().default('first-timers welcome'),
    badgeFoundationStartHere: z.string().default('Foundation · start here'),

    // — Screen-reader / icon-only controls —
    ariaHome: z.string().default('Furor — Dance Hyderabad home'),
    ariaPrimaryNav: z.string().default('Primary'),
    ariaToggleMenu: z.string().default('Toggle menu'),
    ariaMenu: z.string().default('Menu'),
    ariaOpenTalkToUs: z.string().default('Open talk to us'),
    ariaCloseTalkToUs: z.string().default('Close talk to us'),
    ariaClose: z.string().default('Close'),
    // No render site yet. These four exist so the header and footer social
    // icons have an editable label to consume the day they ship.
    ariaSocialInstagram: z.string().default('Furor on Instagram'),
    ariaSocialFacebook: z.string().default('Furor on Facebook'),
    ariaSocialYoutube: z.string().default('Furor on YouTube'),
    ariaSocialWhatsapp: z.string().default('Furor on WhatsApp'),

    // — Post-payment (the /welcome/[track] page) —
    //   welcomeWhereHeading and welcomeOpenMap are the literals shipping in
    //   WelcomeView.tsx today (:254 and :265). The other three have no render
    //   site yet — Plan 3 adds the parking line, the "Reach us" block and the
    //   call link, and these are the exact strings it renders. Do NOT rename
    //   welcomeOpenMap to welcomeGetDirections: the map link reads "Open map →"
    //   today, and a "Get directions →" default would rewrite live copy.
    welcomeWhereHeading: z.string().default('Where'),
    welcomeOpenMap: z.string().default('Open map →'),
    welcomeParking: z.string().default('Parking: {notes}'),
    welcomeReachUs: z.string().default('Reach us'),
    welcomeCallPhone: z.string().default('Call {phone}'),
  })
  .default({});
```

Then append the type export at the very bottom of the file, immediately **after** the line `export type WelcomeTrack = z.infer<typeof WelcomeTrackSchema>;`:

```ts
export type Labels = z.infer<typeof LabelsSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/labels.test.ts`
Expected: PASS — 6 passed (6)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**
```bash
git add src/lib/content-schema.ts src/lib/labels.test.ts
git commit -m "feat: LabelsSchema — 56 cross-cutting site strings as defaulted content"
```

---

### Task 2: `src/lib/labels.ts` — the resolver and its shipped defaults

**Files:**
- Create: `src/lib/labels.ts`
- Modify: `src/lib/labels.test.ts` (anchor: the import block on lines 1–2, and append at end of file)

**Interfaces:**
- Consumes: `LabelsSchema`, `type Labels` from `./content-schema` (Task 1).
- Produces:
  ```ts
  export type { Labels };                                  // re-exported from content-schema
  export const LABEL_DEFAULTS: Labels;                     // flat, 56 entries
  export type LabelKey = keyof typeof LABEL_DEFAULTS;
  export function label(labels: Labels, key: LabelKey): string;
  export const PILL_KEYS: ReadonlySet<LabelKey>;
  export const PILL_CHAR_LIMIT: number;                    // 24
  ```

- [ ] **Step 1: Write the failing test**

In `src/lib/labels.test.ts`, replace the import block — the first two lines:

```ts
import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';
```

with:

```ts
import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';
import { LABEL_DEFAULTS, label, PILL_CHAR_LIMIT, PILL_KEYS } from './labels';
```

Then append to the end of the file:

```ts
describe('LABEL_DEFAULTS', () => {
  it('is derived from the schema, so it can never drift from it', () => {
    expect(LABEL_DEFAULTS).toEqual(labels());
  });
});

describe('label', () => {
  it('returns the stored value when the studio has set one', () => {
    expect(label(labels({ ctaChatWhatsapp: 'Message us' }), 'ctaChatWhatsapp')).toBe('Message us');
  });

  // The whole point of the fallback: clearing a field in the admin must
  // restore the shipped copy, never render an empty button.
  it('falls back to the shipped literal when the field is empty', () => {
    expect(label(labels({ ctaChatWhatsapp: '' }), 'ctaChatWhatsapp')).toBe('Chat on WhatsApp');
  });

  it('treats a whitespace-only value as empty', () => {
    expect(label(labels({ ctaBookTrial: '   ' }), 'ctaBookTrial')).toBe('Book my trial class');
  });

  it('every field falls back to its own shipped literal, not a shared one', () => {
    const blank = Object.fromEntries(
      Object.keys(LABEL_DEFAULTS).map((k) => [k, '']),
    ) as Labels;
    for (const key of Object.keys(LABEL_DEFAULTS) as (keyof typeof LABEL_DEFAULTS)[]) {
      expect(label(blank, key)).toBe(LABEL_DEFAULTS[key]);
    }
  });

  // Defence in depth, not theory: content.ts merges stored bytes with the seed
  // before parsing, but a document hand-edited at /admin/json can still be
  // short a key, and an empty button is a conversion bug.
  it('survives a document missing the key entirely', () => {
    expect(label({} as Labels, 'ctaEnquire')).toBe('Enquire');
  });
});

describe('PILL_KEYS', () => {
  // .pill is whitespace-nowrap (globals.css) and several call sites sit inside
  // overflow-clip wrappers, so a long value razor-cuts itself with no warning
  // to whoever typed it. The admin shows a character hint for exactly these.
  it('names exactly the labels that render inside a .pill', () => {
    expect([...PILL_KEYS].sort()).toEqual([
      'badgeClosed',
      'badgeFillingFast',
      'badgeFirstTimersWelcome',
      'badgeOpen',
    ]);
  });

  it('every pill key is a real label key', () => {
    for (const k of PILL_KEYS) expect(LABEL_DEFAULTS[k]).toBeTypeOf('string');
  });

  it('pins the pill budget the admin hint counts against', () => {
    expect(PILL_CHAR_LIMIT).toBe(24);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/labels.test.ts`
Expected: FAIL with `Error: Failed to load url ./labels (resolved id: .../src/lib/labels). Does the file exist?`

- [ ] **Step 3: Create `src/lib/labels.ts`**

```ts
import { LabelsSchema } from './content-schema';
import type { Labels } from './content-schema';

export type { Labels };

/**
 * The literals shipping today, derived from the schema rather than restated.
 *
 * A hand-maintained second copy of 56 strings is a drift bug waiting to
 * happen. Parsing an empty object through LabelsSchema yields exactly the
 * defaults, once per isolate at module load.
 */
export const LABEL_DEFAULTS: Labels = LabelsSchema.parse({});

export type LabelKey = keyof typeof LABEL_DEFAULTS;

/**
 * Resolve one label.
 *
 * An empty (or whitespace-only, or absent) stored value means "use the shipped
 * copy", so clearing a field in /admin restores the default instead of
 * rendering a blank button. That is the behaviour the admin screen's
 * placeholder and its "reset to default" action both promise.
 */
export function label(labels: Labels, key: LabelKey): string {
  const stored = (labels as Record<string, unknown> | undefined)?.[key];
  if (typeof stored === 'string' && stored.trim() !== '') return stored;
  return LABEL_DEFAULTS[key];
}

/**
 * Labels that render inside a `.pill`.
 *
 * `.pill` is `whitespace-nowrap` and several of its call sites sit inside
 * `overflow-clip` wrappers, so an over-long value is silently cut mid-word —
 * not wrapped, not scrollable, not visible. The admin shows a character hint
 * for these so the editor finds out at typing time rather than from the live
 * site. Membership is measured, not guessed: these four are the only label
 * keys whose render site carries the `.pill` class today.
 */
export const PILL_KEYS: ReadonlySet<LabelKey> = new Set<LabelKey>([
  'badgeFillingFast',
  'badgeOpen',
  'badgeClosed',
  'badgeFirstTimersWelcome',
]);

/** Roughly what fits in a pill at 375px without clipping the sibling text. */
export const PILL_CHAR_LIMIT = 24;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/labels.test.ts`
Expected: PASS — 15 passed (15)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**
```bash
git add src/lib/labels.ts src/lib/labels.test.ts
git commit -m "feat: label() resolver with shipped-default fallback"
```

---

### Task 3: Register `labels` in the document, in roles and in the admin menu

**Files:**
- Modify: `src/lib/content-schema.ts` (anchor: `  welcome: WelcomeSchema,\n});`)
- Modify: `src/lib/roles.ts` (anchor: `  welcome: ['welcome'],`)
- Modify: `src/app/admin/layout.tsx` (anchors: `  { label: 'Hero', href: '/admin/hero' },` and `  '/admin/hero': 'hero',`)
- Test: `src/lib/roles.test.ts` (existing — it is the guard for this task; no new tests)

**Interfaces:**
- Consumes: `LabelsSchema` (Task 1).
- Produces: `content.labels` typed as `Labels` on `SiteContent`; section key `labels` grantable to a section-scoped Editor.

**No content-data change.** `LabelsSchema` is `.default({})` and every field is defaulted, so a stored document without a `labels` key parses to the full set. `data/site-content.json` and `src/data/site-content.seed.json` are both left untouched — see R2 for why, and Task 9 proves they stayed in sync.

- [ ] **Step 1: Break the guard on purpose — add the key without registering it**

In `src/lib/content-schema.ts`, find the end of `SiteContentSchema`:

```ts
  welcome: WelcomeSchema,
});
```

and replace it with:

```ts
  welcome: WelcomeSchema,
  labels: LabelsSchema,
});
```

- [ ] **Step 2: Run the guard test to verify it fails**

Run: `npx vitest run src/lib/roles.test.ts`
Expected: FAIL — `SECTION_PATHS > covers every writable top-level key of the content document`, with `AssertionError: expected [ 'labels' ] to deeply equal []`.

- [ ] **Step 3: Register the section in `roles.ts`**

In `src/lib/roles.ts`, find the last entry of `SECTION_PATHS`:

```ts
  welcome: ['welcome'],
};
```

and replace it with:

```ts
  welcome: ['welcome'],
  labels: ['labels'],
};
```

- [ ] **Step 4: Run the guard test to verify it passes**

Run: `npx vitest run src/lib/roles.test.ts`
Expected: PASS — 4 passed (4)

- [ ] **Step 5: Add the admin menu entry and its section mapping**

In `src/app/admin/layout.tsx`, in the `NAV` array, find:

```ts
  { label: 'Hero', href: '/admin/hero' },
```

and replace it with:

```ts
  { label: 'Hero', href: '/admin/hero' },
  { label: 'Buttons & labels', href: '/admin/labels' },
```

Then in `SECTION_FOR_HREF`, find:

```ts
  '/admin/hero': 'hero',
```

and replace it with:

```ts
  '/admin/hero': 'hero',
  '/admin/labels': 'labels',
```

- [ ] **Step 6: Run the seed-parsing tests to verify the document still validates**

`src/lib/save-pipeline.test.ts` and `src/lib/drafts-core.test.ts` both `SiteContentSchema.parse(seed)` at import, so a schema/seed mismatch throws at module load rather than in an assertion. This is the check that the `.default({})` really does cover a document with no `labels` key.

Run: `npx vitest run src/lib/roles.test.ts src/lib/save-pipeline.test.ts src/lib/drafts-core.test.ts`
Expected: PASS — 3 files, no `SiteContentSchema.parse` throw at module load.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 8: Commit**
```bash
git add src/lib/content-schema.ts src/lib/roles.ts src/app/admin/layout.tsx
git commit -m "feat: register labels as a content section and an admin menu entry"
```

---

### Task 4: `/admin/labels` — the searchable grid

**Files:**
- Create: `src/app/admin/labels/page.tsx`
- Create: `src/app/admin/labels/LabelsEditor.tsx`
- Test: `src/lib/admin-pages-guarded.test.ts` (existing — it is the guard for this task)

**Interfaces:**
- Consumes: `LABEL_DEFAULTS`, `LabelKey`, `PILL_KEYS`, `PILL_CHAR_LIMIT` from `@/lib/labels`; `EditorStyles` from `@/components/admin/fields`; `SaveBar` from `@/components/admin/SaveBar`; `saveSiteContent` from `@/lib/admin-save`; `getContent` from `@/lib/content`; `requireWriteAccess` from `@/lib/guard`.
- Produces: a route at `/admin/labels`.

Follows the existing editor pattern (`src/app/admin/hero/HeroEditor.tsx`): local `useState<SiteContent>`, a `patch` that sets `dirty`, `SaveBar` at the bottom, `EditorStyles` for the shared `.input` CSS. The grid is **generated from `LABEL_DEFAULTS`**, so there is no hand-maintained field list to drift from the schema.

**This task ships no automated regression cover for the grid itself.** The guard sweep proves the route enforces access server-side; nothing in this repo renders a React component in a test. Step 6 is the concrete manual check, with exact numbers.

- [ ] **Step 1: Create the page WITHOUT its guard, so the sweep fails**

Create `src/app/admin/labels/page.tsx`:

```tsx
import { getContent } from '@/lib/content';
import { LabelsEditor } from './LabelsEditor';

export default async function Page() {
  const c = await getContent();
  return (
    <div className="p-6 sm:p-10 max-w-4xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Buttons &amp; labels</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Every button, menu item and badge</h1>
      <p className="mt-2 text-cream/70">
        The short strings that repeat all over the site. Leave a field blank to keep the wording we
        ship — the grey text in each box is that default.
      </p>
      <LabelsEditor initial={c} />
    </div>
  );
}
```

Create `src/app/admin/labels/LabelsEditor.tsx` (full implementation now — the guard is the thing under test, not the editor):

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { EditorStyles } from '@/components/admin/fields';
import { LABEL_DEFAULTS, PILL_CHAR_LIMIT, PILL_KEYS, type LabelKey } from '@/lib/labels';
import { saveSiteContent } from '@/lib/admin-save';

// Grouped by name prefix only — deliberately not by nesting. The document key
// is flat for parse cost (see content-schema.ts), so the grouping lives here,
// in the one place a human reads it. Every key in LABEL_DEFAULTS starts with
// exactly one of these prefixes.
const GROUPS: { prefix: string; title: string; blurb: string }[] = [
  { prefix: 'cta', title: 'Buttons', blurb: 'Every call-to-action verb on the site.' },
  { prefix: 'nav', title: 'Menu items', blurb: 'Header menu and the footer Explore list.' },
  {
    prefix: 'empty',
    title: 'When there is nothing to show',
    blurb: 'Shown when a list comes back empty. {style} and {track} are filled in for you.',
  },
  { prefix: 'badge', title: 'Badges', blurb: 'The small chips on batch cards and rows.' },
  { prefix: 'aria', title: 'Screen-reader text', blurb: 'Read aloud, never shown on screen.' },
  {
    prefix: 'welcome',
    title: 'After payment',
    blurb:
      'Headings and buttons on the confirmation page. {notes} and {phone} are filled in for you.',
  },
];

const ALL_KEYS = Object.keys(LABEL_DEFAULTS) as LabelKey[];

// Counts code POINTS, not UTF-16 code units: this copy contains "·", "→" and
// emoji, and .length would tell a studio their 13-character badge is 15.
function charCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

export function LabelsEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState('');

  function patch(key: LabelKey, value: string) {
    setC((prev) => {
      const labels: SiteContent['labels'] = { ...prev.labels, [key]: value };
      return { ...prev, labels };
    });
    setDirty(true);
  }

  // Search matches the key, the shipped default AND the current value, so
  // "whatsapp" still finds ctaChatWhatsapp after it has been renamed to
  // "Message us".
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return new Set<LabelKey>(ALL_KEYS);
    return new Set<LabelKey>(
      ALL_KEYS.filter(
        (k) =>
          k.toLowerCase().includes(needle) ||
          LABEL_DEFAULTS[k].toLowerCase().includes(needle) ||
          (c.labels[k] ?? '').toLowerCase().includes(needle),
      ),
    );
  }, [q, c.labels]);

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search — try “whatsapp”, “book”, “menu”"
          className="input"
          aria-label="Search labels"
        />
        <p className="mt-1.5 text-xs text-cream/40">
          {matches.size} of {ALL_KEYS.length} labels
        </p>
      </div>

      <div className="mt-6 grid gap-6">
        {GROUPS.map((g) => {
          const keys = ALL_KEYS.filter((k) => k.startsWith(g.prefix) && matches.has(k));
          if (keys.length === 0) return null;
          return (
            <div key={g.prefix} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5">
              <p className="display text-sm uppercase tracking-widest text-ember-400">{g.title}</p>
              <p className="mt-1 text-xs text-cream/50">{g.blurb}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {keys.map((k) => {
                  const value = c.labels[k] ?? '';
                  const shown = value.trim() === '' ? LABEL_DEFAULTS[k] : value;
                  const over = PILL_KEYS.has(k) && charCount(shown) > PILL_CHAR_LIMIT;
                  return (
                    <label key={k} className="block">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-xs uppercase tracking-widest text-cream/60">{k}</span>
                        {value.trim() !== '' ? (
                          <button
                            type="button"
                            onClick={() => patch(k, '')}
                            className="text-[11px] text-cream/40 hover:text-ember-400"
                          >
                            Reset to default
                          </button>
                        ) : null}
                      </span>
                      <div className="mt-1.5">
                        <input
                          value={value}
                          onChange={(e) => patch(k, e.target.value)}
                          placeholder={LABEL_DEFAULTS[k]}
                          className="input"
                        />
                      </div>
                      {PILL_KEYS.has(k) ? (
                        <p className={`mt-1 text-xs ${over ? 'text-gold-400' : 'text-cream/40'}`}>
                          {charCount(shown)}/{PILL_CHAR_LIMIT} characters
                          {over ? ' — too long, it will be cut off' : ''} · shown in a small rounded
                          chip that never wraps.
                        </p>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}
```

- [ ] **Step 2: Run the guard sweep to verify it fails**

Run: `npx vitest run src/lib/admin-pages-guarded.test.ts`
Expected: FAIL — the case named `labels\page.tsx` fails with `AssertionError: labels\page.tsx has no server-side access check: expected false to be true`. The file total moves from 32 to 33 cases, with 1 failing.

- [ ] **Step 3: Add the server-side guard**

In `src/app/admin/labels/page.tsx`, find:

```tsx
import { getContent } from '@/lib/content';
import { LabelsEditor } from './LabelsEditor';

export default async function Page() {
  const c = await getContent();
```

and replace it with:

```tsx
import { getContent } from '@/lib/content';
import { LabelsEditor } from './LabelsEditor';
import { requireWriteAccess } from '@/lib/guard';

export default async function Page() {
  await requireWriteAccess('labels');
  const c = await getContent();
```

- [ ] **Step 4: Run the guard sweep to verify it passes**

Run: `npx vitest run src/lib/admin-pages-guarded.test.ts`
Expected: PASS — 33 passed (33)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 6: Manual verification (no automated cover for this markup)**

Run `npm run dev`, sign in, open `http://localhost:3000/admin/labels`. In the DevTools console run:

```js
document.querySelectorAll('input.input').length
```
Expected: **57** — 56 label inputs plus the search box.

```js
[...document.querySelectorAll('.display.text-sm.uppercase')].map(e => e.textContent.trim())
```
Expected: contains `Buttons`, `Menu items`, `When there is nothing to show`, `Badges`, `Screen-reader text`, `After payment` — the six groups, so no key is orphaned by a prefix typo.

Type `whatsapp` into the search box, then run:

```js
document.querySelectorAll('input.input').length
```
Expected: **9** — the search box plus 8 matches (`ctaChatWhatsapp`, `ctaEnquireWhatsapp`, `ctaChatFirstWhatsapp`, `ctaChatOnWhatsapp`, `ctaNotifyWhatsapp`, `ctaGrabSeatWhatsapp`, `ctaWhatsapp`, `ariaSocialWhatsapp`).

Clear the search. Set `badgeFillingFast` to `Almost completely full already`, and confirm the hint under it turns amber and reads `30/24 characters — too long, it will be cut off`. Click **Reset to default**, confirm the box empties and the placeholder reads `Filling fast`, then **Save** and confirm `Saved ✓`.

- [ ] **Step 7: Commit**
```bash
git add src/app/admin/labels
git commit -m "feat: /admin/labels — searchable label grid with shipped defaults as placeholders"
```

---

### Task 5: Chokepoint 1 — `EnquiryCTA` takes content-driven labels

**Files:**
- Create: nothing.
- Modify: `src/lib/labels.ts` (anchor: the closing of `export const PILL_CHAR_LIMIT = 24;` — append after it)
- Modify: `src/components/EnquiryCTA.tsx` (anchors: `} from '@/lib/enquiry';`, `  className?: string;`, `  className,`, and the `const text =` default chain)
- Modify: `src/components/FloatingTalkToUs.tsx` (anchor: `export function FloatingTalkToUs({`)
- Modify: `src/components/StickyTrialBar.tsx` (anchor: `export function StickyTrialBar({`)
- Modify: `src/components/BatchesBrowser.tsx` (anchors: `  instagramHandle: string;\n}`, `export function BatchesBrowser({ rows, styles, studios, whatsappNumber, instagramHandle }: Props) {`, and the empty-state `<EnquiryCTA .../>` one-liner)
- Modify: `src/components/StyleFinder.tsx`, `src/components/TrialBanner.tsx`, `src/components/TonightTile.tsx`, `src/components/QuickEnroll.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/batches/page.tsx`, `src/app/about/page.tsx`, `src/app/contact/page.tsx`, `src/app/faqs/page.tsx`, `src/app/instructors/page.tsx`, `src/app/dance-styles/[slug]/page.tsx`
- Test: `src/lib/labels.test.ts` (append)

**Interfaces:**
- Consumes: `label`, `type Labels` from `@/lib/labels`.
- Produces:
  ```ts
  export function enquiryDefaultLabel(
    channel: 'whatsapp' | 'instagram',
    variant: 'primary' | 'secondary' | 'batch-row' | 'link' | 'icon',
    labels: Labels,
  ): string;
  ```
  and `EnquiryCTA` gains a **required** `labels: Labels` prop.

**`labels` is required, not optional.** Every one of the 29 `EnquiryCTA` render sites (`grep -rn "<EnquiryCTA" src/ | wc -l` → `29`) is reachable from the content document — this task threads it into all of them, which is the proof. An optional prop plus a `labels ?? ({} as Labels)` fallback would let a future call site silently opt out of editability and would make `/admin/labels` lie about its own reach. Defence-in-depth against a hand-edited `/admin/json` document already lives in `label()` itself, which handles a missing key.

- [ ] **Step 1: Write the failing test**

In `src/lib/labels.test.ts`, replace the third import line:

```ts
import { LABEL_DEFAULTS, label, PILL_CHAR_LIMIT, PILL_KEYS } from './labels';
```

with:

```ts
import {
  enquiryDefaultLabel,
  LABEL_DEFAULTS,
  label,
  PILL_CHAR_LIMIT,
  PILL_KEYS,
} from './labels';
```

Then append to the end of the file:

```ts
// The exact resolution EnquiryCTA performs, lifted out as a pure function so
// the chokepoint has a test even though no test in this repo renders a
// component. This one function is what removes "Chat on WhatsApp" from ten
// render sites and "DM on Instagram" from eight.
describe('enquiryDefaultLabel', () => {
  it('gives the batch-row variant its own WhatsApp verb', () => {
    expect(enquiryDefaultLabel('whatsapp', 'batch-row', labels())).toBe('Enquire on WhatsApp');
  });

  it('gives every other WhatsApp variant the shared verb', () => {
    expect(enquiryDefaultLabel('whatsapp', 'primary', labels())).toBe('Chat on WhatsApp');
    expect(enquiryDefaultLabel('whatsapp', 'secondary', labels())).toBe('Chat on WhatsApp');
    expect(enquiryDefaultLabel('whatsapp', 'link', labels())).toBe('Chat on WhatsApp');
    expect(enquiryDefaultLabel('whatsapp', 'icon', labels())).toBe('Chat on WhatsApp');
  });

  it('gives Instagram its own verb regardless of variant', () => {
    expect(enquiryDefaultLabel('instagram', 'primary', labels())).toBe('DM on Instagram');
    expect(enquiryDefaultLabel('instagram', 'batch-row', labels())).toBe('DM on Instagram');
  });

  it('follows an edited label across every WhatsApp render site at once', () => {
    const edited = labels({ ctaChatWhatsapp: 'Message us on WhatsApp' });
    expect(enquiryDefaultLabel('whatsapp', 'primary', edited)).toBe('Message us on WhatsApp');
    expect(enquiryDefaultLabel('whatsapp', 'link', edited)).toBe('Message us on WhatsApp');
    // batch-row keeps its own key, so one edit cannot silently rewrite two.
    expect(enquiryDefaultLabel('whatsapp', 'batch-row', edited)).toBe('Enquire on WhatsApp');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/labels.test.ts`
Expected: FAIL with `SyntaxError: [vite] The requested module './labels' does not provide an export named 'enquiryDefaultLabel'`

- [ ] **Step 3: Add `enquiryDefaultLabel` to `src/lib/labels.ts`**

Append to `src/lib/labels.ts`, after `export const PILL_CHAR_LIMIT = 24;`:

```ts
/**
 * The label an EnquiryCTA shows when the call site does not name one.
 *
 * `labels` is required. Every render site is reachable from the content
 * document — an optional parameter here would let a future call site opt out
 * of editability with no error anywhere, and /admin/labels would quietly stop
 * being the source of truth it claims to be. The unions are written inline
 * rather than imported so this module keeps a single dependency (the schema).
 */
export function enquiryDefaultLabel(
  channel: 'whatsapp' | 'instagram',
  variant: 'primary' | 'secondary' | 'batch-row' | 'link' | 'icon',
  labels: Labels,
): string {
  if (channel === 'instagram') return label(labels, 'ctaDmInstagram');
  return variant === 'batch-row'
    ? label(labels, 'ctaEnquireWhatsapp')
    : label(labels, 'ctaChatWhatsapp');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/labels.test.ts`
Expected: PASS — 19 passed (19)

- [ ] **Step 5: Make `EnquiryCTA` content-driven**

In `src/components/EnquiryCTA.tsx`, find:

```tsx
} from '@/lib/enquiry';
```

and replace it with:

```tsx
} from '@/lib/enquiry';
import { enquiryDefaultLabel, type Labels } from '@/lib/labels';
```

Find:

```tsx
  className?: string;
}
```

and replace it with:

```tsx
  className?: string;
  /** The content document's labels. Required: every render site is reachable
   *  from the document, and an optional prop would let a call site silently
   *  opt out of /admin/labels. */
  labels: Labels;
}
```

Find:

```tsx
  className,
}: Props) {
```

and replace it with:

```tsx
  className,
  labels,
}: Props) {
```

Find:

```tsx
  const text =
    label ??
    (channel === 'whatsapp'
      ? variant === 'batch-row'
        ? 'Enquire on WhatsApp'
        : 'Chat on WhatsApp'
      : 'DM on Instagram');
```

and replace it with:

```tsx
  const text = label ?? enquiryDefaultLabel(channel, variant, labels);
```

- [ ] **Step 6: Give the three prop-only components a `labels` prop**

`src/components/FloatingTalkToUs.tsx` — find:

```tsx
export function FloatingTalkToUs({
  whatsappNumber,
  instagramHandle,
}: {
  whatsappNumber: string;
  instagramHandle: string;
}) {
```

and replace it with:

```tsx
export function FloatingTalkToUs({
  whatsappNumber,
  instagramHandle,
  labels,
}: {
  whatsappNumber: string;
  instagramHandle: string;
  labels: Labels;
}) {
```

In the same file, find:

```tsx
import type { EnquiryContext } from '@/lib/enquiry';
```

and replace it with:

```tsx
import type { EnquiryContext } from '@/lib/enquiry';
import { label, type Labels } from '@/lib/labels';
```

Then, still in `FloatingTalkToUs.tsx`:

- find `          aria-label="Close"` and replace with `          aria-label={label(labels, 'ariaClose')}`
- find `            <p className="display text-sm uppercase tracking-widest text-cream/60">Talk to us</p>` and replace with:
  ```tsx
            <p className="display text-sm uppercase tracking-widest text-cream/60">
              {label(labels, 'ctaTalkToUs')}
            </p>
  ```
- find:
  ```tsx
                channel="whatsapp"
                variant="primary"
                label="Chat on WhatsApp"
                className="w-full"
  ```
  and replace with:
  ```tsx
                channel="whatsapp"
                variant="primary"
                labels={labels}
                className="w-full"
  ```
- find:
  ```tsx
                channel="instagram"
                variant="secondary"
                label="DM on Instagram"
                className="w-full"
  ```
  and replace with:
  ```tsx
                channel="instagram"
                variant="secondary"
                labels={labels}
                className="w-full"
  ```
- find `          aria-label={open ? 'Close talk to us' : 'Open talk to us'}` and replace with:
  ```tsx
          aria-label={open ? label(labels, 'ariaCloseTalkToUs') : label(labels, 'ariaOpenTalkToUs')}
  ```
- find `          <span className="hidden sm:inline">Talk to us</span>` and replace with:
  ```tsx
          <span className="hidden sm:inline">{label(labels, 'ctaTalkToUs')}</span>
  ```

`src/components/StickyTrialBar.tsx` — find:

```tsx
import { EnquiryCTA } from './EnquiryCTA';
```

and replace it with:

```tsx
import { EnquiryCTA } from './EnquiryCTA';
// Aliased: this component already has a prop called `label` (the button text),
// which would shadow the resolver inside the function body.
import { label as labelText, type Labels } from '@/lib/labels';
```

Find:

```tsx
export function StickyTrialBar({
  whatsappNumber,
  label,
}: {
  whatsappNumber: string;
  label: string;
}) {
```

and replace it with:

```tsx
export function StickyTrialBar({
  whatsappNumber,
  label,
  labels,
}: {
  whatsappNumber: string;
  label: string;
  labels: Labels;
}) {
```

Find:

```tsx
          variant="icon"
          ariaLabel="Chat on WhatsApp"
        />
```

and replace it with:

```tsx
          variant="icon"
          labels={labels}
          ariaLabel={labelText(labels, 'ctaChatWhatsapp')}
        />
```

`src/components/BatchesBrowser.tsx` — find:

```tsx
  instagramHandle: string;
}
```

and replace it with:

```tsx
  instagramHandle: string;
  labels: Labels;
}
```

Find:

```tsx
import { BatchActions } from './BatchActions';
```

and replace it with:

```tsx
import { BatchActions } from './BatchActions';
import { type Labels } from '@/lib/labels';
```

Find:

```tsx
export function BatchesBrowser({ rows, styles, studios, whatsappNumber, instagramHandle }: Props) {
```

and replace it with:

```tsx
export function BatchesBrowser({
  rows,
  styles,
  studios,
  whatsappNumber,
  instagramHandle,
  labels,
}: Props) {
```

Find:

```tsx
              <EnquiryCTA whatsappNumber={whatsappNumber} instagramHandle={instagramHandle} ctx={{ source: 'primary' }} variant="primary" label="Chat on WhatsApp" />
```

and replace it with:

```tsx
              <EnquiryCTA whatsappNumber={whatsappNumber} instagramHandle={instagramHandle} ctx={{ source: 'primary' }} variant="primary" labels={labels} />
```

- [ ] **Step 7: Thread `labels` into every remaining render site**

Each edit below deletes a `label="..."` prop **only** where it restates the resolved default, and adds `labels={...}` to every `<EnquiryCTA>`.

`src/components/StyleFinder.tsx` — find `                variant="primary"\n                label="Chat on WhatsApp"` and replace with `                variant="primary"\n                labels={content.labels}`. Then find `                channel="instagram"\n                variant="secondary"\n                label="DM on Instagram"` and replace with `                channel="instagram"\n                variant="secondary"\n                labels={content.labels}`.

`src/components/TrialBanner.tsx` — the two labels here already come from `content.trial` (`ctaLabel` / `whatsappLabel`, both defaulted in `TrialSchema`), so they stay. Find:

```tsx
                    variant="batch-row"
                    label={t.whatsappLabel || 'Or chat on WhatsApp'}
```
and replace with:
```tsx
                    variant="batch-row"
                    labels={content.labels}
                    label={t.whatsappLabel || 'Or chat on WhatsApp'}
```

Find:
```tsx
                variant="primary"
                label={t.ctaLabel || 'Chat on WhatsApp'}
```
and replace with:
```tsx
                variant="primary"
                labels={content.labels}
                label={t.ctaLabel || 'Chat on WhatsApp'}
```

`src/components/TonightTile.tsx` — find:
```tsx
              variant="primary"
              label={t.ctaLabel || 'WhatsApp to RSVP'}
```
and replace with:
```tsx
              variant="primary"
              labels={content.labels}
              label={t.ctaLabel || 'WhatsApp to RSVP'}
```

`src/components/QuickEnroll.tsx` — three sites. Find:
```tsx
                                variant="link"
                                label="or chat first"
```
and replace with:
```tsx
                                variant="link"
                                labels={content.labels}
                                label="or chat first"
```
Find:
```tsx
                            variant="batch-row"
                            label={`${bookLabel} on WhatsApp`}
```
and replace with:
```tsx
                            variant="batch-row"
                            labels={content.labels}
                            label={`${bookLabel} on WhatsApp`}
```
Find:
```tsx
                variant="primary"
                label="Grab a seat on WhatsApp"
```
and replace with:
```tsx
                variant="primary"
                labels={content.labels}
                label={label(content.labels, 'ctaGrabSeatWhatsapp')}
```
and find `import { EnquiryCTA } from './EnquiryCTA';` and replace with:
```tsx
import { EnquiryCTA } from './EnquiryCTA';
import { label } from '@/lib/labels';
```
(The two remaining `label=` strings in this file are replaced in Task 6, which owns `bookLabel`.)

`src/app/layout.tsx` — find:
```tsx
        <FloatingTalkToUs
          whatsappNumber={content.site.whatsappNumber}
          instagramHandle={content.site.instagramHandle}
        />
```
and replace with:
```tsx
        <FloatingTalkToUs
          whatsappNumber={content.site.whatsappNumber}
          instagramHandle={content.site.instagramHandle}
          labels={content.labels}
        />
```

`src/app/batches/page.tsx` — find:
```tsx
        whatsappNumber={content.site.whatsappNumber}
        instagramHandle={content.site.instagramHandle}
      />
```
and replace with:
```tsx
        whatsappNumber={content.site.whatsappNumber}
        instagramHandle={content.site.instagramHandle}
        labels={content.labels}
      />
```

`src/app/page.tsx` — add the resolver import. Find `import { EnquiryCTA } from '@/components/EnquiryCTA';` and replace with:
```tsx
import { EnquiryCTA } from '@/components/EnquiryCTA';
import { label } from '@/lib/labels';
```
Find:
```tsx
                        variant="batch-row"
                        label="Notify me on WhatsApp"
```
and replace with:
```tsx
                        variant="batch-row"
                        labels={content.labels}
                        label={label(content.labels, 'ctaNotifyWhatsapp')}
```
Find:
```tsx
              variant="secondary"
              label="or chat on WhatsApp"
```
and replace with:
```tsx
              variant="secondary"
              labels={content.labels}
              label={label(content.labels, 'ctaChatOnWhatsapp')}
```
Find:
```tsx
              channel="instagram"
              variant="secondary"
              label="DM on Instagram"
              className="!border-on-ember/45 !text-on-ember hover:!border-on-ember magnetic"
```
and replace with:
```tsx
              channel="instagram"
              variant="secondary"
              labels={content.labels}
              className="!border-on-ember/45 !text-on-ember hover:!border-on-ember magnetic"
```
Find:
```tsx
      <StickyTrialBar whatsappNumber={content.site.whatsappNumber} label={trialLabel} />
```
and replace with:
```tsx
      <StickyTrialBar
        whatsappNumber={content.site.whatsappNumber}
        label={trialLabel}
        labels={content.labels}
      />
```

`src/app/about/page.tsx` — find:
```tsx
                variant="primary"
                label="Chat on WhatsApp"
```
and replace with:
```tsx
                variant="primary"
                labels={content.labels}
```
Find:
```tsx
                channel="instagram"
                variant="secondary"
                label="DM on Instagram"
```
and replace with:
```tsx
                channel="instagram"
                variant="secondary"
                labels={content.labels}
```

`src/app/faqs/page.tsx` — find:
```tsx
                variant="primary"
                label="Chat on WhatsApp"
```
and replace with:
```tsx
                variant="primary"
                labels={content.labels}
```
Find:
```tsx
                channel="instagram"
                variant="secondary"
                label="DM on Instagram"
```
and replace with:
```tsx
                channel="instagram"
                variant="secondary"
                labels={content.labels}
```
(These two blocks are byte-identical to `about/page.tsx`'s, 16-space indentation included — `faqs/page.tsx:85-86` and `:92-94`. Both anchors are unique inside `faqs/page.tsx`, which has exactly one `<EnquiryCTA>` pair.)

`src/app/instructors/page.tsx` — find:
```tsx
              variant="primary"
              label="Chat on WhatsApp"
```
and replace with:
```tsx
              variant="primary"
              labels={content.labels}
```
Find:
```tsx
              channel="instagram"
              variant="secondary"
              label="DM on Instagram"
            />
          </div>
        </div>
```
and replace with:
```tsx
              channel="instagram"
              variant="secondary"
              labels={content.labels}
            />
          </div>
        </div>
```

`src/app/contact/page.tsx` — find:
```tsx
              variant="primary"
              label="Chat on WhatsApp"
              className="!bg-ink-950 !text-cream hover:!bg-ink-800"
```
and replace with:
```tsx
              variant="primary"
              labels={content.labels}
              className="!bg-ink-950 !text-cream hover:!bg-ink-800"
```
Find:
```tsx
              channel="instagram"
              variant="secondary"
              label="DM on Instagram"
              className="!border-on-ember/45 !text-on-ember hover:!border-on-ember"
```
and replace with:
```tsx
              channel="instagram"
              variant="secondary"
              labels={content.labels}
              className="!border-on-ember/45 !text-on-ember hover:!border-on-ember"
```

`src/app/dance-styles/[slug]/page.tsx` — find:
```tsx
              ctx={{ source: 'primary', style: { slug: style.slug, name: style.name } }}
              variant="primary"
              label="Chat on WhatsApp"
```
and replace with:
```tsx
              ctx={{ source: 'primary', style: { slug: style.slug, name: style.name } }}
              variant="primary"
              labels={content.labels}
```
Find:
```tsx
              channel="instagram"
              variant="secondary"
              label="DM on Instagram"
```
and replace with:
```tsx
              channel="instagram"
              variant="secondary"
              labels={content.labels}
```
Find:
```tsx
                variant="primary"
                label={`Notify me about ${style.name}`}
```
and replace with:
```tsx
                variant="primary"
                labels={content.labels}
                label={`Notify me about ${style.name}`}
```
(That template string is section-specific copy and moves to `pages.danceStyles` in Plan 4.)

- [ ] **Step 8: Typecheck and run the full suite**

Run: `npm run typecheck`
Expected: no output, exit 0. If any `Property 'labels' is missing` error appears, a render site was missed — the required prop is doing exactly the job it was made required for; fix each reported file and re-run.

Run: `npx vitest run`
Expected: PASS — `Test Files 27 passed (27)`, `Tests 299 passed (299)` (279 baseline + 19 in `labels.test.ts` + 1 added to the admin guard sweep in Task 4).

- [ ] **Step 9: Commit**
```bash
git add src/lib/labels.ts src/lib/labels.test.ts src/components/EnquiryCTA.tsx src/components/FloatingTalkToUs.tsx src/components/StickyTrialBar.tsx src/components/BatchesBrowser.tsx src/components/StyleFinder.tsx src/components/TrialBanner.tsx src/components/TonightTile.tsx src/components/QuickEnroll.tsx src/app/layout.tsx src/app/page.tsx src/app/batches/page.tsx src/app/about/page.tsx src/app/contact/page.tsx src/app/faqs/page.tsx src/app/instructors/page.tsx "src/app/dance-styles/[slug]/page.tsx"
git commit -m "feat: EnquiryCTA takes content-driven labels at all twenty-nine render sites"
```

---

### Task 6: Chokepoint 2 — `bookLabel()`, `statusLabel()` and one casing for "Filling fast"

**Files:**
- Create: `src/lib/book-label.ts`
- Test: `src/lib/book-label.test.ts` (create)
- Modify: `src/components/BatchActions.tsx` (anchor: `export function BatchActions({`)
- Modify: `src/components/QuickEnroll.tsx` (anchors: `const bookLabel = foundation ? 'Book my first class' : 'Book my trial class';` and `{b.status}`)
- Modify: `src/components/Hero.tsx` (anchor: `            <a href="#start-this-week" className="btn-primary magnetic downbeat">`)
- Modify: `src/components/BatchesBrowser.tsx` (anchors: the `status` facet line, the preset line, the `Filling fast` pill, and `function labelFor(`)
- Modify: `src/app/page.tsx` (anchor: `  const trialLabel = \`Book my first class`)
- Modify: `src/app/dance-styles/[slug]/page.tsx` (anchor: the inline `Filling fast` pill)

**Interfaces:**
- Consumes: `label`, `type Labels` from `@/lib/labels`.
- Produces:
  ```ts
  export function bookLabel(level: string, labels: Labels): string;
  export function statusLabel(status: string, labels: Labels): string;
  ```

The stored enum **values** (`Open` / `Filling Fast` / `Closed`) do not change: they are live URL state in `BatchesBrowser` and renaming them would break bookmarked and shared links. What a visitor **reads** becomes editable and gains exactly one casing site-wide.

- [ ] **Step 1: Write the failing test**

Create `src/lib/book-label.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';
import { bookLabel, statusLabel } from './book-label';

const labels = (over: Partial<Labels> = {}): Labels => LabelsSchema.parse(over);

describe('bookLabel', () => {
  it('calls a Foundation batch a first class', () => {
    expect(bookLabel('Foundation', labels())).toBe('Book my first class');
  });

  it('calls every higher level a trial class', () => {
    expect(bookLabel('Intermediate', labels())).toBe('Book my trial class');
    expect(bookLabel('Advanced', labels())).toBe('Book my trial class');
  });

  // Defence in depth, not coverage: the schema enum forbids this value today.
  it('treats an unknown level as a trial rather than a beginner class', () => {
    expect(bookLabel('Masterclass', labels())).toBe('Book my trial class');
  });

  it('follows the edited label at every call site at once', () => {
    const edited = labels({ ctaBookFoundation: 'Reserve my first class' });
    expect(bookLabel('Foundation', edited)).toBe('Reserve my first class');
    expect(bookLabel('Advanced', edited)).toBe('Book my trial class');
  });

  it('falls back to the shipped default when the label is blank', () => {
    expect(bookLabel('Foundation', labels({ ctaBookFoundation: '' }))).toBe('Book my first class');
  });
});

describe('statusLabel', () => {
  // The live inconsistency: QuickEnroll printed the raw enum "Filling Fast",
  // BatchesBrowser hardcoded "Filling fast". Two casings of one word on one
  // site. One function, one casing.
  it('gives the Filling Fast enum exactly one display casing', () => {
    expect(statusLabel('Filling Fast', labels())).toBe('Filling fast');
  });

  it('renders the other statuses', () => {
    expect(statusLabel('Open', labels())).toBe('Open');
    expect(statusLabel('Closed', labels())).toBe('Closed');
  });

  it('is editable without touching the stored enum value', () => {
    expect(statusLabel('Filling Fast', labels({ badgeFillingFast: 'Almost full' }))).toBe(
      'Almost full',
    );
  });

  // An unrecognised status must show something, not an empty chip.
  it('echoes an unknown status rather than blanking the badge', () => {
    expect(statusLabel('Waitlist', labels())).toBe('Waitlist');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/book-label.test.ts`
Expected: FAIL with `Error: Failed to load url ./book-label (resolved id: .../src/lib/book-label). Does the file exist?`

- [ ] **Step 3: Create `src/lib/book-label.ts`**

```ts
import { label, type Labels } from './labels';

/**
 * One source of truth for a booking CTA's copy.
 *
 * BatchActions, QuickEnroll, Hero and the home page each built this same label
 * independently, which is how two of them can drift apart without anyone
 * noticing.
 */
export function bookLabel(level: string, labels: Labels): string {
  return level === 'Foundation'
    ? label(labels, 'ctaBookFoundation')
    : label(labels, 'ctaBookTrial');
}

/**
 * The display label for a batch's status.
 *
 * The stored ENUM VALUES ('Open' | 'Filling Fast' | 'Closed') are live URL
 * state in BatchesBrowser — read from ?status=, compared, and shared in
 * bookmarked links. They are structural and never editable. What a visitor
 * READS is editable, and now has exactly one casing site-wide.
 */
export function statusLabel(status: string, labels: Labels): string {
  if (status === 'Filling Fast') return label(labels, 'badgeFillingFast');
  if (status === 'Open') return label(labels, 'badgeOpen');
  if (status === 'Closed') return label(labels, 'badgeClosed');
  return status;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/book-label.test.ts`
Expected: PASS — 9 passed (9)

- [ ] **Step 5: Adopt `bookLabel` in `BatchActions`**

In `src/components/BatchActions.tsx`, find:

```tsx
import { EnquiryCTA } from './EnquiryCTA';
```

and replace it with:

```tsx
import { EnquiryCTA } from './EnquiryCTA';
import { bookLabel } from '@/lib/book-label';
import { label, type Labels } from '@/lib/labels';
```

Find:

```tsx
export function BatchActions({
  batch,
  style,
  branch,
  whatsappNumber,
  primaryLabelWhenNoLink = 'Enquire on WhatsApp',
  whatsappLabelWhenLink = 'or chat first',
}: {
  batch: Batch;
  style: { slug: string; name: string };
  branch: { slug: string; name: string };
  whatsappNumber: string;
  primaryLabelWhenNoLink?: string;
  whatsappLabelWhenLink?: string;
}) {
  const ctx = {
    source: 'batch_row' as const,
    style,
    branch,
    batch,
  };
  const bookLabel = batch.level === 'Foundation' ? 'Book my first class' : 'Book my trial class';
```

and replace it with:

```tsx
export function BatchActions({
  batch,
  style,
  branch,
  whatsappNumber,
  labels,
  primaryLabelWhenNoLink,
  whatsappLabelWhenLink,
}: {
  batch: Batch;
  style: { slug: string; name: string };
  branch: { slug: string; name: string };
  whatsappNumber: string;
  labels: Labels;
  primaryLabelWhenNoLink?: string;
  whatsappLabelWhenLink?: string;
}) {
  const ctx = {
    source: 'batch_row' as const,
    style,
    branch,
    batch,
  };
  // The former hardcoded defaults are now the label document's defaults, so an
  // edit in /admin/labels reaches every batch row on the site.
  const book = bookLabel(batch.level, labels);
  const noLinkLabel = primaryLabelWhenNoLink ?? label(labels, 'ctaEnquireWhatsapp');
  const chatLabel = whatsappLabelWhenLink ?? label(labels, 'ctaChatFirst');
```

Find:

```tsx
          {bookLabel} · {formatInr(batch.reservationInr)}
```

and replace it with:

```tsx
          {book} · {formatInr(batch.reservationInr)}
```

Find:

```tsx
        <EnquiryCTA
          whatsappNumber={whatsappNumber}
          ctx={ctx}
          variant="link"
          label={whatsappLabelWhenLink}
        />
```

and replace it with:

```tsx
        <EnquiryCTA
          whatsappNumber={whatsappNumber}
          ctx={ctx}
          variant="link"
          labels={labels}
          label={chatLabel}
        />
```

Find:

```tsx
    <EnquiryCTA
      whatsappNumber={whatsappNumber}
      ctx={ctx}
      variant="batch-row"
      label={primaryLabelWhenNoLink}
    />
```

and replace it with:

```tsx
    <EnquiryCTA
      whatsappNumber={whatsappNumber}
      ctx={ctx}
      variant="batch-row"
      labels={labels}
      label={noLinkLabel}
    />
```

- [ ] **Step 6: Adopt it in `QuickEnroll`, `Hero`, `BatchesBrowser` and the two pages**

`src/components/QuickEnroll.tsx` — find:

```tsx
import { label } from '@/lib/labels';
```

and replace it with:

```tsx
import { label } from '@/lib/labels';
import { bookLabel, statusLabel } from '@/lib/book-label';
```

Find:

```tsx
                  const bookLabel = foundation ? 'Book my first class' : 'Book my trial class';
```

and replace it with:

```tsx
                  const book = bookLabel(b.level, content.labels);
```

Find:

```tsx
                        >
                          {b.status}
                        </span>
```

and replace it with:

```tsx
                        >
                          {statusLabel(b.status, content.labels)}
                        </span>
```

Find:

```tsx
                              {bookLabel} · {formatInr(b.reservationInr)}
```

and replace it with:

```tsx
                              {book} · {formatInr(b.reservationInr)}
```

Find:

```tsx
                                labels={content.labels}
                                label="or chat first"
```

and replace it with:

```tsx
                                labels={content.labels}
                                label={label(content.labels, 'ctaChatFirst')}
```

Find:

```tsx
                            labels={content.labels}
                            label={`${bookLabel} on WhatsApp`}
```

and replace it with:

```tsx
                            labels={content.labels}
                            label={`${book} on WhatsApp`}
```

`src/components/Hero.tsx` — find:

```tsx
import { CinematicHeadline } from './CinematicHeadline';
```

and replace it with:

```tsx
import { CinematicHeadline } from './CinematicHeadline';
import { bookLabel } from '@/lib/book-label';
import { label } from '@/lib/labels';
```

Find:

```tsx
            <a href="#start-this-week" className="btn-primary magnetic downbeat">
              Book my first class{trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''}
            </a>
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary' }}
              variant="link"
              label="or chat first on WhatsApp"
            />
```

and replace it with:

```tsx
            <a href="#start-this-week" className="btn-primary magnetic downbeat">
              {bookLabel('Foundation', content.labels)}
              {trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''}
            </a>
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary' }}
              variant="link"
              labels={content.labels}
              label={label(content.labels, 'ctaChatFirstWhatsapp')}
            />
```

`src/components/BatchesBrowser.tsx` — find:

```tsx
import { type Labels } from '@/lib/labels';
```

and replace it with:

```tsx
import { type Labels } from '@/lib/labels';
import { statusLabel } from '@/lib/book-label';
```

Find:

```tsx
    sel[k].forEach((v) => activeChips.push({ k, v, label: labelFor(k, v, styles, studios) })),
```

and replace it with:

```tsx
    sel[k].forEach((v) => activeChips.push({ k, v, label: labelFor(k, v, styles, studios, labels) })),
```

Find:

```tsx
    { key: 'status', label: 'Availability', options: present(['Filling Fast', 'Open'], (e) => e.status).map((v) => ({ v, label: v === 'Filling Fast' ? 'Filling fast' : 'Open' })) },
```

and replace it with:

```tsx
    { key: 'status', label: 'Availability', options: present(['Filling Fast', 'Open'], (e) => e.status).map((v) => ({ v, label: statusLabel(v, labels) })) },
```

Find:

```tsx
    { label: '🔥 Filling fast', p: { status: ['Filling Fast'] } },
```

and replace it with:

```tsx
    { label: `🔥 ${statusLabel('Filling Fast', labels)}`, p: { status: ['Filling Fast'] } },
```

Find:

```tsx
                      <span className="pill bg-gold-500/15 text-gold-400">Filling fast</span>
```

and replace it with:

```tsx
                      <span className="pill bg-gold-500/15 text-gold-400">
                        {statusLabel(b.status, labels)}
                      </span>
```

Find:

```tsx
                      whatsappNumber={whatsappNumber}
                      primaryLabelWhenNoLink="Enquire"
```

and replace it with:

```tsx
                      whatsappNumber={whatsappNumber}
                      labels={labels}
                      primaryLabelWhenNoLink="Enquire"
```

Find:

```tsx
function labelFor(
  k: FacetKey,
  v: string,
  styles: { slug: string; name: string }[],
  studios: { slug: string; name: string }[],
): string {
```

and replace it with:

```tsx
function labelFor(
  k: FacetKey,
  v: string,
  styles: { slug: string; name: string }[],
  studios: { slug: string; name: string }[],
  labels: Labels,
): string {
```

Find:

```tsx
  if (k === 'status') return v === 'Filling Fast' ? 'Filling fast' : v;
```

and replace it with:

```tsx
  if (k === 'status') return statusLabel(v, labels);
```

`src/app/page.tsx` — find:

```tsx
import { label } from '@/lib/labels';
```

and replace it with:

```tsx
import { label } from '@/lib/labels';
import { bookLabel } from '@/lib/book-label';
```

Find:

```tsx
  const trialLabel = `Book my first class${trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''}`;
```

and replace it with:

```tsx
  const trialLabel = `${bookLabel('Foundation', content.labels)}${
    trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''
  }`;
```

Find:

```tsx
                        branch={{ slug: branch.slug, name: branch.name }}
                        whatsappNumber={content.site.whatsappNumber}
                      />
```

and replace it with:

```tsx
                        branch={{ slug: branch.slug, name: branch.name }}
                        whatsappNumber={content.site.whatsappNumber}
                        labels={content.labels}
                      />
```

`src/app/dance-styles/[slug]/page.tsx` — find:

```tsx
import { BatchActions } from '@/components/BatchActions';
```

and replace it with:

```tsx
import { BatchActions } from '@/components/BatchActions';
import { statusLabel } from '@/lib/book-label';
```

Find:

```tsx
                    <p className="text-cream/70 text-sm">{formatInr(b.priceInr)} {b.status === 'Filling Fast' ? <span className="pill ml-2 bg-gold-500/15 text-gold-400">Filling fast</span> : null}</p>
```

and replace it with:

```tsx
                    <p className="text-cream/70 text-sm">{formatInr(b.priceInr)} {b.status === 'Filling Fast' ? <span className="pill ml-2 bg-gold-500/15 text-gold-400">{statusLabel(b.status, content.labels)}</span> : null}</p>
```

Find:

```tsx
                      whatsappNumber={content.site.whatsappNumber}
                      primaryLabelWhenNoLink="Enquire"
```

and replace it with:

```tsx
                      whatsappNumber={content.site.whatsappNumber}
                      labels={content.labels}
                      primaryLabelWhenNoLink="Enquire"
```

- [ ] **Step 7: Typecheck and run the full suite**

Run: `npm run typecheck`
Expected: no output, exit 0.

Run: `npx vitest run`
Expected: PASS — `Test Files 28 passed (28)`, `Tests 308 passed (308)` (299 + 9 new in `book-label.test.ts`).

- [ ] **Step 8: Verify the casing split is gone (no automated cover for the render sites)**

Run:
```bash
! grep -rn "'Filling fast'\|>Filling fast<\|\"Filling fast\"" src --include=*.tsx --include=*.ts | grep -v "\.test\." | grep -v "content-schema.ts" && echo OK
```
Expected: `OK` — the only remaining `Filling fast` literal in the codebase is the `badgeFillingFast` default in `content-schema.ts`, plus the two assertions in `labels.test.ts` / `book-label.test.ts`.

- [ ] **Step 9: Commit**
```bash
git add src/lib/book-label.ts src/lib/book-label.test.ts src/components/BatchActions.tsx src/components/QuickEnroll.tsx src/components/Hero.tsx src/components/BatchesBrowser.tsx src/app/page.tsx "src/app/dance-styles/[slug]/page.tsx"
git commit -m "feat: bookLabel and statusLabel — one booking verb, one Filling fast casing"
```

---

### Task 7: Chokepoint 3 — the id-keyed nav, adopted by Header and Footer

**Files:**
- Create: `src/lib/nav.ts`
- Test: `src/lib/nav.test.ts` (create)
- Modify: `src/components/Header.tsx` (anchors: `const NAV: { label: string; href: string; children?: { label: string; href: string }[] }[] = [`, `  const navWithDropdowns = NAV.map((item) => {`, and each markup literal quoted below)
- Modify: `src/components/Footer.tsx` (anchors: `import { BrandMark } from './BrandMark';`, `<h3 className="display text-sm uppercase tracking-widest text-cream/70">Explore</h3>`, and each markup literal quoted below)

**Interfaces:**
- Consumes: `label`, `type LabelKey`, `type Labels` from `@/lib/labels`.
- Produces:
  ```ts
  export interface NavItem { id: string; href: string; defaultLabel: string }
  export const NAV_ITEMS: readonly NavItem[];
  export function navLabel(item: NavItem, labels: Labels): string;
  ```

This is the load-bearing chokepoint. `Header.tsx` currently branches on `item.label === 'Dance Styles'`, so making the nav label editable without this refactor silently empties the style dropdown the first time someone renames that item. Header keys the dropdown on `item.id === 'dance-styles'` from here on, never on the rendered text.

- [ ] **Step 1: Write the failing test**

Create `src/lib/nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LabelsSchema, type Labels } from './content-schema';
import { NAV_ITEMS, navLabel } from './nav';

const labels = (over: Partial<Labels> = {}): Labels => LabelsSchema.parse(over);

const byId = (id: string) => {
  const item = NAV_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`no nav item ${id}`);
  return item;
};

describe('NAV_ITEMS', () => {
  it('ships the eight primary destinations Header and Footer share', () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      'home',
      'about',
      'dance-styles',
      'instructors',
      'batches',
      'blog',
      'faqs',
      'contact',
    ]);
  });

  it('keeps hrefs structural — they are routes, not copy', () => {
    expect(byId('blog').href).toBe('/stories');
    expect(byId('dance-styles').href).toBe('/dance-styles');
    expect(byId('batches').href).toBe('/batches');
  });

  it('has no duplicate ids, so a React key on id is safe', () => {
    expect(new Set(NAV_ITEMS.map((i) => i.id)).size).toBe(NAV_ITEMS.length);
  });
});

describe('navLabel', () => {
  it('renders the shipped copy by default', () => {
    expect(navLabel(byId('dance-styles'), labels())).toBe('Dance Styles');
    expect(navLabel(byId('batches'), labels())).toBe('Batches & Pricing');
    expect(navLabel(byId('blog'), labels())).toBe('Blog');
  });

  it('renders the edited copy', () => {
    expect(navLabel(byId('dance-styles'), labels({ navDanceStyles: 'What we teach' }))).toBe(
      'What we teach',
    );
  });

  it('falls back to the shipped label when the field is cleared', () => {
    expect(navLabel(byId('faqs'), labels({ navFaqs: '' }))).toBe('FAQs');
  });

  // THE regression this module exists for. Header used to branch on
  // `item.label === 'Dance Styles'`, so the first rename in /admin/labels
  // would have silently emptied the style dropdown with no error anywhere.
  it('keeps the dropdown branch resolvable after a label rename', () => {
    const renamed = labels({ navDanceStyles: 'Our Dances' });
    expect(navLabel(byId('dance-styles'), renamed)).toBe('Our Dances');
    // The branch key is the id, and the id did not move.
    expect(NAV_ITEMS.filter((i) => i.id === 'dance-styles')).toHaveLength(1);
    expect(NAV_ITEMS.filter((i) => navLabel(i, renamed) === 'Dance Styles')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/nav.test.ts`
Expected: FAIL with `Error: Failed to load url ./nav (resolved id: .../src/lib/nav). Does the file exist?`

- [ ] **Step 3: Create `src/lib/nav.ts`**

```ts
import { label, type LabelKey, type Labels } from './labels';

export interface NavItem {
  /** Stable and structural. Every branch in Header keys on THIS, never on the
   *  rendered text — the text is admin-editable and can be renamed at will. */
  id: string;
  /** A route, not copy. Renaming it would break bookmarks and inbound links,
   *  so hrefs are deliberately not exposed in /admin. */
  href: string;
  /** Fallback only, for an id with no mapped label key. */
  defaultLabel: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', href: '/', defaultLabel: 'Home' },
  { id: 'about', href: '/about', defaultLabel: 'About' },
  { id: 'dance-styles', href: '/dance-styles', defaultLabel: 'Dance Styles' },
  { id: 'instructors', href: '/instructors', defaultLabel: 'Instructors' },
  { id: 'batches', href: '/batches', defaultLabel: 'Batches & Pricing' },
  { id: 'blog', href: '/stories', defaultLabel: 'Blog' },
  { id: 'faqs', href: '/faqs', defaultLabel: 'FAQs' },
  { id: 'contact', href: '/contact', defaultLabel: 'Contact' },
];

// Kept off NavItem on purpose: deriving the key from the id by string
// transform ("dance-styles" -> "navDanceStyles") would be a silent break the
// day someone adds an id that does not transform cleanly.
const NAV_LABEL_KEY: Record<string, LabelKey> = {
  home: 'navHome',
  about: 'navAbout',
  'dance-styles': 'navDanceStyles',
  instructors: 'navInstructors',
  batches: 'navBatches',
  blog: 'navBlog',
  faqs: 'navFaqs',
  contact: 'navContact',
};

export function navLabel(item: NavItem, labels: Labels): string {
  const key = NAV_LABEL_KEY[item.id];
  return key ? label(labels, key) : item.defaultLabel;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/nav.test.ts`
Expected: PASS — 7 passed (7)

- [ ] **Step 5: Adopt it in `Header.tsx`**

Find:

```tsx
import { ThemeToggle } from './ThemeToggle';

const NAV: { label: string; href: string; children?: { label: string; href: string }[] }[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Dance Styles', href: '/dance-styles' },
  { label: 'Instructors', href: '/instructors' },
  { label: 'Batches & Pricing', href: '/batches' },
  { label: 'Blog', href: '/stories' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Contact', href: '/contact' },
];
```

and replace it with:

```tsx
import { ThemeToggle } from './ThemeToggle';
import { NAV_ITEMS, navLabel, type NavItem } from '@/lib/nav';
import { label } from '@/lib/labels';

type NavWithChildren = NavItem & { children?: { label: string; href: string }[] };
```

Find:

```tsx
  const navWithDropdowns = NAV.map((item) => {
    if (item.label === 'Dance Styles') {
      return {
        ...item,
        children: content.danceStyles
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((s) => ({ label: s.name, href: `/dance-styles/${s.slug}` })),
      };
    }
    return item;
  });
```

and replace it with:

```tsx
  // The branch keys on the STABLE ID, not the rendered text. `item.label ===
  // 'Dance Styles'` was one rename in /admin/labels away from emptying this
  // dropdown with no error anywhere.
  const navWithDropdowns: NavWithChildren[] = NAV_ITEMS.map((item) => {
    if (item.id === 'dance-styles') {
      return {
        ...item,
        children: content.danceStyles
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((s) => ({ label: s.name, href: `/dance-styles/${s.slug}` })),
      };
    }
    return item;
  });
```

Then, in the markup:

- find `        <Link href="/" aria-label="Furor — Dance Hyderabad home" className="shrink-0">` and replace with `        <Link href="/" aria-label={label(content.labels, 'ariaHome')} className="shrink-0">`
- find:
  ```tsx
          aria-label="Primary"
        >
  ```
  and replace with:
  ```tsx
          aria-label={label(content.labels, 'ariaPrimaryNav')}
        >
  ```
- find:
  ```tsx
            <div key={item.label} className="group relative">
              <Link href={item.href} className="btn-ghost">
                {item.label}
                {item.children ? <Caret /> : null}
  ```
  and replace with:
  ```tsx
            <div key={item.id} className="group relative">
              <Link href={item.href} className="btn-ghost">
                {navLabel(item, content.labels)}
                {item.children ? <Caret /> : null}
  ```
- find:
  ```tsx
            aria-label="Toggle menu"
  ```
  and replace with:
  ```tsx
            aria-label={label(content.labels, 'ariaToggleMenu')}
  ```
- find:
  ```tsx
            <span className="sr-only">Menu</span>
  ```
  and replace with:
  ```tsx
            <span className="sr-only">{label(content.labels, 'ariaMenu')}</span>
  ```
- find:
  ```tsx
              <div key={item.label} className="border-b border-cream/5 last:border-0">
  ```
  and replace with:
  ```tsx
              <div key={item.id} className="border-b border-cream/5 last:border-0">
  ```
- find:
  ```tsx
                  className="block py-3 text-base font-medium text-cream"
                >
                  {item.label}
                </Link>
                {item.children ? (
  ```
  and replace with:
  ```tsx
                  className="block py-3 text-base font-medium text-cream"
                >
                  {navLabel(item, content.labels)}
                </Link>
                {item.children ? (
  ```

> **Note for Plan 2:** the mobile-foundation plan rewrites this header's right-hand cluster and drawer. It must keep `aria-label={label(content.labels, 'ariaToggleMenu')}` and `{label(content.labels, 'ariaMenu')}` intact, and give the new social icon links `aria-label={label(content.labels, 'ariaSocialInstagram')}` / `'ariaSocialFacebook'` / `'ariaSocialYoutube'` / `'ariaSocialWhatsapp'` rather than hardcoding four new strings.

- [ ] **Step 6: Adopt it in `Footer.tsx`**

Find:

```tsx
import { BrandMark } from './BrandMark';
```

and replace it with:

```tsx
import { BrandMark } from './BrandMark';
import { NAV_ITEMS, navLabel } from '@/lib/nav';
import { label } from '@/lib/labels';
```

Find:

```tsx
                    Call
```

and replace it with:

```tsx
                    {label(content.labels, 'ctaCall')}
```

Find:

```tsx
                    WhatsApp
```

and replace it with:

```tsx
                    {label(content.labels, 'ctaWhatsapp')}
```

Find:

```tsx
            <h3 className="display text-sm uppercase tracking-widest text-cream/70">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm text-cream/80">
              <li><Link href="/about" className="inline-block py-1 hover:text-cream transition-colors">About</Link></li>
              <li><Link href="/dance-styles" className="inline-block py-1 hover:text-cream transition-colors">Dance Styles</Link></li>
              <li><Link href="/instructors" className="inline-block py-1 hover:text-cream transition-colors">Instructors</Link></li>
              <li><Link href="/batches" className="inline-block py-1 hover:text-cream transition-colors">Batches &amp; Pricing</Link></li>
              {content.stories.length > 0 ? (
                <li><Link href="/stories" className="inline-block py-1 hover:text-cream transition-colors">Blog</Link></li>
              ) : null}
              <li><Link href="/faqs" className="inline-block py-1 hover:text-cream transition-colors">FAQs</Link></li>
              <li><Link href="/contact" className="inline-block py-1 hover:text-cream transition-colors">Contact</Link></li>
```

and replace it with:

```tsx
            <h3 className="display text-sm uppercase tracking-widest text-cream/70">
              {label(content.labels, 'navExplore')}
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-cream/80">
              {/* Same seven destinations, same order, one source of truth with
                  the header. `home` is deliberately excluded — the brand mark
                  above already links there. */}
              {NAV_ITEMS.filter(
                (i) => i.id !== 'home' && (i.id !== 'blog' || content.stories.length > 0),
              ).map((i) => (
                <li key={i.id}>
                  <Link href={i.href} className="inline-block py-1 hover:text-cream transition-colors">
                    {navLabel(i, content.labels)}
                  </Link>
                </li>
              ))}
```

Find:

```tsx
            <Link href="/privacy" className="inline-block py-1.5 hover:text-cream transition-colors">Privacy</Link>
            <Link href="/terms" className="inline-block py-1.5 hover:text-cream transition-colors">Terms</Link>
```

and replace it with:

```tsx
            <Link href="/privacy" className="inline-block py-1.5 hover:text-cream transition-colors">{label(content.labels, 'navPrivacy')}</Link>
            <Link href="/terms" className="inline-block py-1.5 hover:text-cream transition-colors">{label(content.labels, 'navTerms')}</Link>
```

> **Note for Plan 2:** the footer's social row and the copyright line are untouched here. Plan 2 replaces the three text links with icons and must consume `ariaSocial*`; `site.footerCopyright` is Plan 4's.

- [ ] **Step 7: Typecheck and run the full suite**

Run: `npm run typecheck`
Expected: no output, exit 0.

Run: `npx vitest run`
Expected: PASS — `Test Files 29 passed (29)`, `Tests 315 passed (315)` (308 + 7 new in `nav.test.ts`).

- [ ] **Step 8: Manual verification — the rename must not break the dropdown (no automated cover for this markup)**

Run `npm run dev`. In `/admin/labels`, search `navDanceStyles`, set it to `Our Dances`, save.

Open `http://localhost:3000/` and in the DevTools console run:

```js
[...document.querySelectorAll('nav[aria-label="Primary"] > div > a')].map(a => a.textContent.trim())
```
Expected: exactly `["Home","About","Our Dances","Instructors","Batches & Pricing","Blog","FAQs","Contact"]` — 8 entries, with `Our Dances` in position 3 and no `Dance Styles` anywhere.

Then run:

```js
document.querySelectorAll('nav[aria-label="Primary"] .group .absolute a').length
```
Expected: **3** — Salsa, Bachata and West Coast Swing, proving the dropdown still populates after the rename. (Before this task, the branch keyed on the text and this would have been `0`.)

Then check the footer:

```js
[...document.querySelectorAll('footer ul li a')].map(a => a.textContent.trim())
```
Expected: 8 entries — `["About","Our Dances","Instructors","Batches & Pricing","Blog","FAQs","Contact","furorhyd@dancehyderabad.com"]`.

Finally, in `/admin/labels`, click **Reset to default** on `navDanceStyles` and save. Reload `/` and confirm the nav reads `Dance Styles` again and the dropdown still returns `3`.

- [ ] **Step 9: Commit**
```bash
git add src/lib/nav.ts src/lib/nav.test.ts src/components/Header.tsx src/components/Footer.tsx
git commit -m "feat: id-keyed nav shared by Header and Footer so labels can be renamed safely"
```

---

### Task 8: `hero.posterAlt`, and Hero actually reading it

**Files:**
- Modify: `src/lib/content-schema.ts` (anchor: `  posterImage: z.string().default(''),`)
- Modify: `src/components/Hero.tsx` (anchor: the `alt="Couples dancing Salsa…"` literal)
- Modify: `src/app/admin/hero/HeroEditor.tsx` (anchor: the `ImageUploader` `hint=` line)
- Test: `src/lib/labels.test.ts` (append — this is a shipped-literal assertion, and `labels.test.ts` is already the file that pins shipped literals; `src/lib/content-schema.test.ts` is created by Plan 3 and must not be created here)

**Interfaces:**
- Consumes: nothing.
- Produces: `content.hero.posterAlt: string`.

Image alt belongs with its image, not in the label bag — so this joins `HeroSchema` rather than `labels`. The field is **read by `Hero.tsx` in this task**: a schema field plus a seed value plus an admin input that the page never renders is a field that silently does nothing.

- [ ] **Step 1: Write the failing test**

In `src/lib/labels.test.ts`, replace the second import line:

```ts
import { LabelsSchema, type Labels } from './content-schema';
```

with:

```ts
import { HeroSchema, LabelsSchema, type Labels } from './content-schema';
```

Then append to the end of the file:

```ts
describe('HeroSchema.posterAlt', () => {
  // Not decorative: this is the one photo that shows a visitor what a Furor
  // night actually looks like, so it carries a real description rather than
  // the alt="" an audit flagged. The default is the literal Hero.tsx ships.
  it('defaults to the description shipping today', () => {
    const h = HeroSchema.parse({ headline: 'x', subHeadline: 'y' });
    expect(h.posterAlt).toBe(
      'Couples dancing Salsa together on a busy social floor at a Furor Latin night in Hyderabad',
    );
  });

  it('keeps an edited description', () => {
    const h = HeroSchema.parse({ headline: 'x', subHeadline: 'y', posterAlt: 'Bachata class' });
    expect(h.posterAlt).toBe('Bachata class');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/labels.test.ts`
Expected: FAIL — `AssertionError: expected undefined to be 'Couples dancing Salsa together on a busy social floor at a Furor Latin night in Hyderabad'`

Do **not** run `npm run typecheck` at this point: `posterAlt` does not exist on the inferred type yet, so `tsc` would correctly reject the test. vitest transpiles without type-checking, so the test executes and fails on the assertion, which is the red we want. Typecheck runs in Step 5.

- [ ] **Step 3: Add the field**

In `src/lib/content-schema.ts`, find:

```ts
  posterImage: z.string().default(''),
});
```

and replace it with:

```ts
  posterImage: z.string().default(''),
  // Not decorative: this is the one photo that shows a visitor what a Furor
  // night actually looks like, so it gets a real description rather than the
  // alt="" an audit flagged as missing text.
  posterAlt: z
    .string()
    .default(
      'Couples dancing Salsa together on a busy social floor at a Furor Latin night in Hyderabad',
    ),
});
```

- [ ] **Step 4: Read it in `Hero.tsx` and expose it in the admin**

In `src/components/Hero.tsx`, find:

```tsx
            // Not decorative: this is the one photo that shows a visitor what
            // a Furor night actually looks like, so it gets a real description
            // rather than the alt="" that an audit flagged as missing text.
            alt="Couples dancing Salsa together on a busy social floor at a Furor Latin night in Hyderabad"
```

and replace it with:

```tsx
            // Not decorative: this is the one photo that shows a visitor what
            // a Furor night actually looks like, so it gets a real description
            // rather than the alt="" that an audit flagged as missing text.
            // Editable at /admin/hero; the schema default is the literal that
            // shipped here before.
            alt={content.hero.posterAlt}
```

In `src/app/admin/hero/HeroEditor.tsx`, find:

```tsx
          hint="Used as the fallback image behind the hero video, and on mobile when the video doesn't autoplay."
        />
```

and replace it with:

```tsx
          hint="Used as the fallback image behind the hero video, and on mobile when the video doesn't autoplay."
        />
        <Field
          label="Poster image description"
          hint="Read aloud by screen readers and shown if the photo fails to load. Describe what is happening in it."
        >
          <input
            value={c.hero.posterAlt}
            onChange={(e) => patch({ posterAlt: e.target.value })}
            className="input"
          />
        </Field>
```

> **Note for Plan 2:** the mobile plan replaces this `<Img>` with a hand-written `<picture>` for the LCP element. It must carry `alt={content.hero.posterAlt}` onto the new `<img>` — do **not** hoist the literal into a module-level `POSTER_ALT` constant, which would strand this field permanently.

- [ ] **Step 5: Run the test and typecheck to verify they pass**

Run: `npx vitest run src/lib/labels.test.ts`
Expected: PASS — 21 passed (21)

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 6: Manual verification (no automated cover for the rendered attribute)**

Run `npm run dev`, open `http://localhost:3000/`, and in the DevTools console run:

```js
document.querySelector('section img').getAttribute('alt')
```
Expected: `"Couples dancing Salsa together on a busy social floor at a Furor Latin night in Hyderabad"`

Then in `/admin/hero` set **Poster image description** to `Bachata class in progress`, save, reload `/`, and re-run the same expression.
Expected: `"Bachata class in progress"`. Set it back to blank and save; reload and confirm the attribute is now the empty string — `posterAlt` is a plain schema default with no `label()`-style fallback, because an empty `alt` is a legitimate editorial choice for a decorative image and must stay expressible.

- [ ] **Step 7: Commit**
```bash
git add src/lib/content-schema.ts src/components/Hero.tsx src/app/admin/hero/HeroEditor.tsx src/lib/labels.test.ts
git commit -m "feat: editable hero poster alt text, read by the hero"
```

---

### Task 9: Full-suite verification and a clean tree

**Files:**
- Modify: none.
- Test: the whole suite.

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — `Test Files 29 passed (29)`, `Tests 317 passed (317)`.

The arithmetic, from the 26-file / 279-test baseline:

| file | before | after | delta |
|---|---|---|---|
| `src/lib/labels.test.ts` (new) | — | 21 | +21 |
| `src/lib/book-label.test.ts` (new) | — | 9 | +9 |
| `src/lib/nav.test.ts` (new) | — | 7 | +7 |
| `src/lib/admin-pages-guarded.test.ts` | 32 | 33 | +1 (one more admin `page.tsx` in the `it.each` sweep) |
| everything else | 279 − 32 = 247 | 247 | 0 |
| **total** | **279** | **317** | **+38** |

Files: 26 + 3 = **29**.

**This plan's delta is `+3 files, +38 tests`.** That delta is the checkable number; `29 / 317` is only the delta applied to the 26 / 279 baseline this plan starts from. Plan 2 starts from **29 / 317** and states its own delta on top of it.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 3: Prove the content data and the seed never diverged**

This plan changed no content data — every new field is a schema default (see R2). This is the check that proves it, and it is the same check the later plans rely on before they run `npm run sync-seed`.

Run: `npm run sync-seed -- --check`
Expected: `✓ seed is in sync with data/site-content.json`, exit 0.

- [ ] **Step 4: Prove the public site is unchanged (no automated cover for rendered output)**

Run `npm run dev`, then:

```bash
node -e "(async()=>{for(const p of ['/','/batches','/about','/dance-styles/salsa']){const h=await (await fetch('http://localhost:3000'+p)).text();console.log(p, h.includes('Book my first class'), h.includes('Chat on WhatsApp'), h.includes('Dance Styles'));}})()"
```
Expected: four lines. `/` → `true true true`; `/batches` → `false true true`; `/about` → `false true true`; `/dance-styles/salsa` → `false true true`. Every string still ships; nothing rendered changed.

- [ ] **Step 5: Confirm a clean working tree**

Run: `git status --short`
Expected: no output — every file touched by Tasks 1–8 is committed.

- [ ] **Step 6: Commit**

Nothing to commit. If `git status --short` printed anything, find the task that produced it, add it to that task's `git add` list, and commit with that task's message before proceeding to Plan 2.

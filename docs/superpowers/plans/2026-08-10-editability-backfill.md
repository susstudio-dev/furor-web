# Editability Backfill (SEO, WhatsApp Templates, Per-Screen Copy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish ask B — make the page titles, SERP descriptions, WhatsApp prefill templates and the ~120 section-specific strings editable from `/admin`, without changing a single rendered character except the one metadata decoupling §6.3 asks for.

**Architecture:** Every new field is a `z.string().default('')` (or a defaulted object) hung on the page/section object that already owns it, following the `ctaLabel` / `whatsappLabel` convention in `content-schema.ts` — never on the flat `labels` bag, which Plan 1 closed at 50 keys. Two new pure modules carry the only new logic: `src/lib/page-meta.ts` resolves title/description precedence for all 11 route metadata files, and `firstForbiddenToken` in `content-schema.ts` backs a **write-path** WhatsApp-template check in `src/lib/integrity.ts`. Every shipped literal moves to exactly one home, so the schema default, the route fallback and the admin placeholder can never drift apart.

**Tech Stack:** Next.js 15 App Router (server components), Zod 3.25 single-document CMS, vitest (node environment, no DOM), TypeScript strict, Cloudflare Workers free plan.

**Execution order:** Plan 4 of 4. Runs after `docs/superpowers/plans/2026-08-10-post-payment-batches.md` and is the last plan in the set. It runs last because every task here writes into files the first three plans rewrite — `content-schema.ts`, `page.tsx`, `WelcomeView.tsx`, `BatchesBrowser.tsx`, `QuickEnroll.tsx`, `seo.ts` — and because it consumes label keys (`badgeBookingOpen`, `badgeFoundationStartHere`, `ctaEnquire`, `emptyNo*`) that Plan 1 ships but nothing else reads.

## Global Constraints

- **R1 — Text anchors only, never line numbers.** Three plans have already rewritten `content-schema.ts`, `page.tsx`, `Hero.tsx`, `Header.tsx`, `Footer.tsx`, `WelcomeView.tsx`, `seo.ts`, `BatchesBrowser.tsx`, `QuickEnroll.tsx` and the seed. Every Modify step below quotes a unique surrounding string as its anchor. Line numbers appear only as orientation ("currently around :212") and must never be used to locate an edit.
- **R1a — Anchor-drift protocol.** If an anchor string is not found: `grep -n` for the surrounding structural markup (the enclosing `className`, the enclosing function name), confirm whether an earlier plan already applied this exact change, and if it did, **skip the step and tick it**. Never guess a line number, never re-apply an edit on top of itself.
- **R2 — Never hand-write `src/data/site-content.seed.json`.** `scripts/sync-seed.mjs` regenerates the seed FROM `data/site-content.json`, so a hand-written seed edit is destroyed by the next `npm run sync-seed`. **This plan makes no content-data change at all**: every field it adds is defaulted, so an unedited stored document auto-migrates and renders byte-identically. `data/site-content.json` and `src/data/site-content.seed.json` are therefore untouched by every task. Each task still ends with `npm run sync-seed -- --check` expecting `✓ seed is in sync with data/site-content.json`, which proves this plan did not desynchronise the data edits Plans 1–3 made.
- **R3 — Content validation NEVER goes on the read path.** No `.refine()` / `.superRefine()` that can reject a stored document. `src/lib/content.ts` wraps `SiteContentSchema.parse(mergeWithSeed(...))` in a `try` whose `catch` returns `seedResult()` — one bad field would serve the bundled seed for the **entire public site**. The WhatsApp-template token check therefore lives in `src/lib/integrity.ts` (write path only, beside Plan 3's `welcomeTrackKey` check), and `firstForbiddenToken` is exported from `content-schema.ts` so both sides share one implementation.
- **R4 — Never `Write` a test file another plan already created.** `src/lib/seo.test.ts` and `src/lib/content-schema.test.ts` may already exist when this plan starts (Plan 3 owns the Event JSON-LD and the batch/track schema assertions). Every task that touches them runs this guard first:
  ```bash
  test -f src/lib/seo.test.ts && echo EXISTS || echo NEW
  test -f src/lib/content-schema.test.ts && echo EXISTS || echo NEW
  ```
  `NEW` → create the file exactly as written. `EXISTS` → **append** the new `describe` blocks below the existing content, merging any new imports into the file's existing import statements rather than adding duplicate `import` lines from the same module, and add the file's pre-existing test count to every roll-up below.
- **R5 — Every code step contains real, complete code.** No "following X exactly", no "similar to Task N", no "one Field per key". The 34-field batches editor, the 21-field booking-board panel with its `countIn` add/remove list, the 11-field visit-us extension, the 11-field welcome editor and the 8-field style-finder panel are all written out in full below.
- **R6 — Test-count arithmetic.** The repo baseline is **26 files / 279 tests**, verified green on Node v24.18.0 / vitest 4.1.10 (`npx vitest run` → `Test Files 26 passed (26)`, `Tests 279 passed (279)`). Plans 1–3 land before this one, so this plan's starting point is **`F0` files / `T0` tests**, recorded in Task 1 Step 1. The **assumed** value is `F0 = 38`, `T0 = 403`, read off the three sibling plans as written: Plan 1 ends at 29 files / 317 tests (+3 files, +38); Plan 2 adds 5 files / 35 tests (`image-variants` 8, `image-downscale` 7, `image-dimensions` 8, `public-urls` 6, `social-url` 6) → 34 / 352; Plan 3 adds 4 files / 51 tests (`content-schema.test.ts` 3, `content-helpers.test.ts`, `welcome-resolve.test.ts`, `seo.test.ts` 9, plus 4 appended to `integrity.test.ts`) → 38 / 403. **That assumption must be re-verified at execution time** and the real numbers substituted into every `T0 + n` below — a sibling plan that grew or shrank in review invalidates the constants, not the deltas. This plan's own delta is fixed and does not depend on the constants: it adds **60 tests** (`seo.test.ts` +16, `enquiry.test.ts` +18, `integrity.test.ts` +4, `content-schema.test.ts` +22) and **exactly one new file** (`src/lib/enquiry.test.ts`) — Plan 3 already creates both `seo.test.ts` and `content-schema.test.ts`, so the R4 guard should report `EXISTS` for both and every task appends. Final expectation: `F0 + 1` files, `T0 + 60` tests — `39` / `463` against the assumed starting point.
- **R7 — No `Co-Authored-By` trailer on any commit.** Commit style: lowercase conventional prefix, imperative.
- **R8 — No runtime dependency.** This plan adds no npm package of any kind. `sharp` stays devDependencies-only (Plan 2 owns it).
- **Never expose in admin:** analytics event names, schema.org vocabulary, route paths and `href`s, CSS class hooks, `razorpay_payment_link_status`, and the Zod **enum values** `Foundation` / `Intermediate` / `Advanced` / `Open` / `Filling Fast` / `Closed` / `Weekend` / `Weekday` / `Morning` / `Afternoon` / `Evening` / `This month` / `Next 30 days` / `Later`. Those are live URL state in `BatchesBrowser` (read from the query string, compared, and shared in bookmarked links). Their **display labels** become editable in `pages.batches.browser`; the values do not move.
- **`labels` is closed at 56 keys.** Plan 1 owns it. Nothing in this plan adds a key to `LabelsSchema`, and nothing in this plan gives a string that already has a label key a second home in `pages.*` / `welcome.*` — two admin controls for one rendered string is worse than none, because the one the studio does not find silently loses. The 12 `filter*` keys Plan 1 deliberately left out land in `pages.batches.browser` (Task 8), which is what keeps `LABEL_DEFAULTS` at 56 and matches §4.2's own rationale: the studio edits the batches page copy on the batches screen. The five `welcome*` keys (`welcomeWhereHeading`, `welcomeOpenMap`, `welcomeParking`, `welcomeReachUs`, `welcomeCallPhone`) are Plan 3's render sites and stay there — see Tasks 16 and 17.
- **No new top-level content key.** `roles.test.ts` (`SECTION_PATHS` vs `Object.keys(SiteContentSchema.shape)`) and `admin-pages-guarded.test.ts` are untouched by this plan — every field lands inside `pages.*`, `welcome` or `site`, all of which are already registered.
- **Pill hints.** Plan 1's `PILL_KEYS` in `src/lib/labels.ts` covers the label bag. Fields outside that bag that render into a `.pill` get the same treatment via a section-local pill set counted against Plan 1's exported `PILL_CHAR_LIMIT` (24).
- Tests are vitest: `npx vitest run`, config `vitest.config.mts`, include `src/**/*.test.ts`, `environment: 'node'`. **No test in this repo renders a React component** — do not add React Testing Library or jsdom. All new logic goes in pure functions in `src/lib`.
- `npm run typecheck` = `tsc --noEmit` and must stay clean. `tsconfig.json` does **not** set `noUnusedLocals`, so a stale import will not fail typecheck — remove replaced imports by hand.

---

## File Structure

| File | Created / Modified | The ONE responsibility |
|---|---|---|
| `src/lib/seo.ts` | Modify | Export `SEO_TITLE_CHARS` / `SEO_DESC_CHARS` so the admin counter and the render-time trim cannot drift |
| `src/lib/seo.test.ts` | Create (or append — R4) | Pins the SEO budgets, the blank-by-default page fields, and `resolvePageMeta`'s precedence |
| `src/lib/page-meta.ts` | Create | `PAGE_SEO_DEFAULTS` (every shipped title/description literal, once) + `resolvePageMeta()` |
| `src/lib/content-schema.ts` | Modify | `seoTitle`/`seoDescription` on the page objects, `WhatsappTemplatesSchema` + `firstForbiddenToken`, `BatchesPageSchema`, `pages.home.board` / `.visitUs` / `.nextBatches` / `.styleFinder`, the 11 `welcome.*` copy fields |
| `src/lib/content-schema.test.ts` | Append (or create — R4) | Pins every per-screen default literal against the seed |
| `src/lib/enquiry.ts` | Modify | Fills admin-authored templates; no longer throws at click time |
| `src/lib/enquiry.test.ts` | Create | Token detection, template filling, href encoding, and the no-throw guarantee |
| `src/lib/integrity.ts` | Modify | Write-path WhatsApp-template token check, beside Plan 3's `welcomeTrackKey` check |
| `src/lib/integrity.test.ts` | Append | The four save-time rejection cases |
| `src/components/admin/SeoFields.tsx` | Create | One reusable search-title + search-description pair with live counters |
| `src/app/{page,about,batches,faqs,instructors,contact,dance-styles,stories,privacy,terms}/page.tsx` | Modify | Metadata reads the editable fields through `resolvePageMeta` |
| `src/app/welcome/[track]/page.tsx` | Modify | Title reads `welcome.seoTitle`; description falls back to `PAGE_SEO_DEFAULTS.welcome` |
| `src/app/admin/site/SiteEditor.tsx` | Modify | The seven WhatsApp message templates |
| `src/components/BatchesBrowser.tsx` | Modify | Consumes `pages.batches.browser` |
| `src/app/admin/pages/batches/BatchesPageEditor.tsx` | Create | The /batches screen's 34 browser strings + SEO + intro |
| `src/components/QuickEnroll.tsx` | Modify | Consumes `pages.home.board` |
| `src/app/admin/pages/home/HomePageEditor.tsx` | Modify | Booking board (21 fields + count-in list), visit-us (7), next-batches (3), why-Furor eyebrow, style finder (8), SEO |
| `src/app/page.tsx` | Modify | Consumes `pages.home.visitUs` / `.nextBatches` / `.whyFurorEyebrow` and the label bag |
| `src/components/StyleFinder.tsx` | Modify | Consumes `pages.home.styleFinder` |
| `src/app/welcome/[track]/WelcomeView.tsx` | Modify | Consumes the 11 `welcome.*` copy fields (the contact block stays on Plan 1's label bag) |
| `src/components/admin/WelcomePageEditor.tsx` | Modify | The 11 welcome copy fields |
| `src/components/admin/SimpleIntroEditor.tsx` | Modify | Mounts `SeoFields`; drops `batches` from its page-key union |
| `src/components/admin/LegalPageEditor.tsx` | Modify | Mounts `SeoFields` for privacy and terms |
| `src/app/admin/pages/{about,faqs,contact,instructors}/*PageEditor.tsx` | Modify | Mount `SeoFields` |
| `src/app/admin/pages/batches/page.tsx` | Modify | Renders `BatchesPageEditor` instead of `SimpleIntroEditor` |

---

### Task 1: SEO budgets and the `seoTitle` / `seoDescription` fields

**Files:**
- Modify: `src/lib/seo.ts` (anchor: `const TITLE_CHARS = 57;`)
- Modify: `src/lib/content-schema.ts` (anchors: `const HomePageSchema = z`, `const AboutPageSchema = z`, `const FaqsPageSchema = z`, `const ContactPageSchema = z`, `const InstructorsPageSchema = z`, `const SimpleIntroPageSchema = z`, `export const LegalPageSchema = z`, `    tracks: z`)
- Test: `src/lib/seo.test.ts` (create — R4 guard)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export const SEO_TITLE_CHARS = 57;
  export const SEO_DESC_CHARS = 155;
  ```
  plus `seoTitle: string` and `seoDescription: string` on `pages.home`, `pages.about`, `pages.faqs`, `pages.contact`, `pages.instructorsPage`, `pages.stories`, `pages.danceStyles`, `pages.batches`, `pages.privacy`, `pages.terms`, and `seoTitle: string` on `welcome`.

**Every one of these defaults to `''`.** The shipped literal is *not* duplicated into the schema: it lives once, in `PAGE_SEO_DEFAULTS` (Task 2), which is what the route falls back to and what the admin shows as a placeholder. A non-blank schema default would mean the same string existed in three places and could drift in two of them.

- [ ] **Step 1: Record the real starting point (R6)**

Run: `npx vitest run`
Expected: PASS, zero failures, zero skipped. Write down the two numbers it prints as `F0` (test files) and `T0` (tests) — the assumed values are `F0 = 38`, `T0 = 403` (see R6), and every `T0 + n` in this plan is computed from what you actually record here, not from the assumption.

Also run the R4 guard now, once, for both shared test files:

```bash
test -f src/lib/seo.test.ts && echo "seo.test.ts EXISTS" || echo "seo.test.ts NEW"
test -f src/lib/content-schema.test.ts && echo "content-schema.test.ts EXISTS" || echo "content-schema.test.ts NEW"
```

Record both answers; they decide create-vs-append for every test step below.

- [ ] **Step 2: Write the failing test**

If Step 1 reported `seo.test.ts NEW`, create `src/lib/seo.test.ts` with exactly this. If it reported `EXISTS`, append everything from `const doc = () =>` downward and merge the imports into the existing import block.

The genuinely-new assertions come first on purpose: `fitTitle` and `fitDescription` are unchanged by this task, so the last two tests **already pass** against today's code. Only the missing `SEO_TITLE_CHARS` export makes the file fail to import, which is what produces the red — putting the budget and field assertions at the top is what makes that red mean something once the import resolves.

```ts
import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';
import { fitDescription, fitTitle, SEO_DESC_CHARS, SEO_TITLE_CHARS } from './seo';

const doc = () => SiteContentSchema.parse(seed);

// Every page object that carries its own SERP title and description. Kept as a
// literal list rather than Object.keys(c.pages) so a future page that forgets
// the fields fails here instead of silently opting out.
const PAGE_KEYS = [
  'home',
  'about',
  'faqs',
  'contact',
  'instructorsPage',
  'stories',
  'danceStyles',
  'batches',
  'privacy',
  'terms',
] as const;

describe('SEO budgets', () => {
  // Exported so /admin's counter and the render-time trim cannot drift apart:
  // an editor who sees "57/57" must be seeing the number fitTitle enforces.
  it('exports the title budget fitTitle already enforces', () => {
    expect(SEO_TITLE_CHARS).toBe(57);
  });

  // Advisory only. The render-time description limit is pixels (DESC_PX),
  // because that is Google's real limit — but pixels are not something an
  // editor can count while typing, and 155 is the figure every SEO tool shows.
  it('exports an advisory description budget for the admin counter', () => {
    expect(SEO_DESC_CHARS).toBe(155);
  });
});

describe('page SEO fields', () => {
  it('gives every page object a seoTitle and a seoDescription', () => {
    const c = doc();
    for (const k of PAGE_KEYS) {
      expect(typeof c.pages[k].seoTitle).toBe('string');
      expect(typeof c.pages[k].seoDescription).toBe('string');
    }
  });

  // Blank is the whole migration story: an unedited document keeps rendering
  // the literal each route already shipped, so this task changes nothing a
  // visitor or a crawler can see.
  it('ships them blank, so today’s literals still decide what renders', () => {
    const c = doc();
    for (const k of PAGE_KEYS) {
      expect(c.pages[k].seoTitle).toBe('');
      expect(c.pages[k].seoDescription).toBe('');
    }
  });

  it('gives the confirmation page its own blank seoTitle', () => {
    expect(doc().welcome.seoTitle).toBe('');
  });

  it('keeps an admin-written value over the blank default', () => {
    const c = doc();
    c.pages.about.seoTitle = 'Our story';
    c.pages.about.seoDescription = 'Nine years of Latin dance in Hyderabad.';
    const again = SiteContentSchema.parse(c);
    expect(again.pages.about.seoTitle).toBe('Our story');
    expect(again.pages.about.seoDescription).toBe('Nine years of Latin dance in Hyderabad.');
  });
});

describe('fitTitle and fitDescription still govern admin-written copy', () => {
  // The point of routing the new fields through the existing helpers rather
  // than around them: an over-long admin title is trimmed, never shipped broken.
  it('trims an over-long admin title rather than shipping it broken', () => {
    const long = 'A Very Long Admin Written Page Title That Nobody Would Sensibly Ship';
    expect(fitTitle(long, 'Furor — Dance Hyderabad').absolute.length).toBeLessThanOrEqual(61);
  });

  it('lets a substantial admin description stand on its own', () => {
    const written =
      'Salsa, Bachata and West Coast Swing classes in Jubilee Hills, Hyderabad, for people who have never danced a single step before.';
    expect(fitDescription(written, 'fallback support copy')).toBe(written);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/seo.test.ts`
Expected: FAIL with `SyntaxError: [vite] The requested module './seo' does not provide an export named 'SEO_TITLE_CHARS'` — the whole file fails to import, so all 8 cases are reported as failed.

- [ ] **Step 4: Export the budgets from `src/lib/seo.ts`**

In `src/lib/seo.ts`, replace the line `const TITLE_CHARS = 57;` with:

```ts
/**
 * The character ceiling fitTitle enforces. Exported so the /admin counter and
 * the render-time trim can never drift apart — an editor who is told "57" must
 * be told the number this file actually applies.
 */
export const SEO_TITLE_CHARS = 57;
/**
 * Advisory ceiling for the admin description counter. The render-time limit is
 * DESC_PX below, because Google's real limit is pixels, not characters — but
 * pixels are not a number anyone can count while typing, and 155 is the figure
 * every SERP tool shows an editor.
 */
export const SEO_DESC_CHARS = 155;

const TITLE_CHARS = SEO_TITLE_CHARS;
```

- [ ] **Step 5: Add the fields to the seven page schemas**

All seven edits are the same two lines inserted immediately after the schema's opening `.object({`. Each anchor below is the exact two-line opening of that schema and is unique in the file.

In `src/lib/content-schema.ts`, anchor on:

```ts
const HomePageSchema = z
  .object({
```

and insert directly beneath the `.object({` line:

```ts
    // The SERP title and description for this page. Blank means "use the
    // literal this route already shipped" — that literal lives once, in
    // PAGE_SEO_DEFAULTS (src/lib/page-meta.ts), so the schema, the route and
    // the admin placeholder cannot drift apart. Both still run through
    // fitTitle / fitDescription at render time, so an over-long value is
    // trimmed rather than shipped broken.
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
```

Repeat the identical insertion (the comment only once, on `HomePageSchema`; the two field lines on every one) for these anchors:

```ts
const AboutPageSchema = z
  .object({
```
```ts
const FaqsPageSchema = z
  .object({
```
```ts
const ContactPageSchema = z
  .object({
```
```ts
const InstructorsPageSchema = z
  .object({
```
```ts
export const LegalPageSchema = z
  .object({
```

`SimpleIntroPageSchema` is a one-liner today. Replace it whole (anchor: `const SimpleIntroPageSchema = z`):

```ts
// Backs /stories and /dance-styles — two pages with two different shipped
// titles, which is exactly why seoTitle defaults to '' here and each route
// supplies its own fallback from PAGE_SEO_DEFAULTS. (/batches gets its own
// BatchesPageSchema in this plan, because it also owns 34 browser strings.)
const SimpleIntroPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
  })
  .default({});
```

- [ ] **Step 6: Add `welcome.seoTitle`**

Still in `src/lib/content-schema.ts`, inside `WelcomeSchema`, anchor on the line `    tracks: z` and insert immediately **above** it:

```ts
    // The <title> of the confirmation page. It is noindex, so this is not an
    // SERP budget question — it is the browser tab and the WhatsApp link
    // preview, both of which the studio should own. Blank falls back to
    // PAGE_SEO_DEFAULTS.welcome.title.
    seoTitle: z.string().default(''),
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/lib/seo.test.ts`
Expected: PASS — `Tests 8 passed (8)` (or `8 + <the count Step 1 recorded for a pre-existing seo.test.ts>`).

- [ ] **Step 8: Confirm nothing else moved**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent, exit 0; `Tests T0 + 8 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 9: Commit**
```bash
git add src/lib/seo.ts src/lib/content-schema.ts src/lib/seo.test.ts
git commit -m "feat: seoTitle and seoDescription on every page object, with exported SERP budgets"
```

---

### Task 2: `src/lib/page-meta.ts` — one home for every shipped title and description

**Files:**
- Create: `src/lib/page-meta.ts`
- Test: `src/lib/seo.test.ts` (append — R4)

**Interfaces:**
- Consumes: `fitTitle`, `fitDescription` from `./seo`.
- Produces:
  ```ts
  export type PageMetaKey =
    | 'home' | 'about' | 'batches' | 'faqs' | 'contact' | 'instructorsPage'
    | 'danceStyles' | 'stories' | 'privacy' | 'terms' | 'welcome';
  export const PAGE_SEO_DEFAULTS: Record<PageMetaKey, { title: string; description: string }>;
  export interface PageMetaInput { seoTitle: string; seoDescription: string; brand: string; derivedTitle?: string; derivedDescription?: string; supportDescription?: string }
  export function resolvePageMeta(key: PageMetaKey, input: PageMetaInput): { title: { absolute: string }; description: string };
  ```

This is the P10 fix. Eleven route files previously had "manual verification" as their whole test strategy; the decision they each duplicated — which of three candidate strings wins, and what the brand suffix costs — now lives in one pure function with real assertions behind it. In particular the test below pins that an unedited `/about` still renders `About · Furor — Dance Hyderabad`, which is exactly the string Next's `title.template` produces today. That assertion *is* the byte-identical proof; the `curl` diff in Task 3 is a confirmation, not the gate.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/seo.test.ts` (merge the two new imports into the existing block at the top of the file rather than adding a second `import … from './seo'`):

```ts
import { PAGE_SEO_DEFAULTS, resolvePageMeta, type PageMetaKey } from './page-meta';

const BRAND = 'Furor — Dance Hyderabad';
const blank = { seoTitle: '', seoDescription: '', brand: BRAND };

describe('PAGE_SEO_DEFAULTS', () => {
  it('covers every route that owns its own metadata', () => {
    expect(Object.keys(PAGE_SEO_DEFAULTS).sort()).toEqual(
      [
        'about',
        'batches',
        'contact',
        'danceStyles',
        'faqs',
        'home',
        'instructorsPage',
        'privacy',
        'stories',
        'terms',
        'welcome',
      ].sort(),
    );
  });

  // fitDescription trims to a PIXEL budget, so a support sentence that is
  // comfortably under 155 characters can still come back with an ellipsis.
  // Every shipped one must survive untouched, or this plan silently rewrites
  // a snippet it promised not to change.
  it('ships support descriptions that fitDescription leaves alone', () => {
    for (const [key, v] of Object.entries(PAGE_SEO_DEFAULTS)) {
      expect([key, fitDescription('', v.description)]).toEqual([key, v.description]);
    }
  });
});

describe('resolvePageMeta', () => {
  // THE regression this module exists to prevent. Today /about emits
  // `title: 'About'` and Next's layout template appends " · <brand>". Routing
  // it through fitTitle bypasses the template, so it must produce the same
  // 31-character string — byte for byte — or every SERP title on the site
  // silently changes.
  it('reproduces the title the layout template renders today', () => {
    const cases: [PageMetaKey, string][] = [
      ['about', 'About · Furor — Dance Hyderabad'],
      ['batches', 'Batches & Pricing · Furor — Dance Hyderabad'],
      ['faqs', 'FAQs · Furor — Dance Hyderabad'],
      ['contact', 'Contact · Furor — Dance Hyderabad'],
      ['instructorsPage', 'Instructors · Furor — Dance Hyderabad'],
      ['danceStyles', 'Dance Styles · Furor — Dance Hyderabad'],
      ['stories', 'Stories · Furor — Dance Hyderabad'],
    ];
    for (const [key, expected] of cases) {
      expect([key, resolvePageMeta(key, blank).title.absolute]).toEqual([key, expected]);
    }
  });

  it('lets an admin-written title win over everything else', () => {
    const meta = resolvePageMeta('about', {
      ...blank,
      seoTitle: 'Our story',
      derivedTitle: 'Derived',
    });
    expect(meta.title.absolute).toBe('Our story · Furor — Dance Hyderabad');
  });

  // Home builds "<two lead styles> Classes in Hyderabad" from live records;
  // privacy and terms prefer their own intro headline. A derived title beats
  // the shipped fallback and loses to an admin one.
  it('prefers a derived title over the shipped fallback', () => {
    expect(
      resolvePageMeta('home', { ...blank, derivedTitle: 'Salsa & Bachata Classes in Hyderabad' })
        .title.absolute,
    ).toBe('Salsa & Bachata Classes in Hyderabad · Furor — Dance Hyderabad');
    expect(resolvePageMeta('home', blank).title.absolute).toBe(
      'Dance Classes in Hyderabad · Furor — Dance Hyderabad',
    );
  });

  it('resolves the description admin-first, then derived, then support alone', () => {
    const written =
      'Salsa, Bachata and West Coast Swing classes in Jubilee Hills, Hyderabad, for people who have never danced a step.';
    expect(
      resolvePageMeta('about', { ...blank, seoDescription: written, derivedDescription: 'ignored' })
        .description,
    ).toBe(written);
    expect(resolvePageMeta('about', { ...blank, derivedDescription: written }).description).toBe(
      written,
    );
    expect(resolvePageMeta('about', blank).description).toBe(PAGE_SEO_DEFAULTS.about.description);
  });

  it('lets a route override the shipped support sentence', () => {
    const meta = resolvePageMeta('home', {
      ...blank,
      supportDescription: 'Salsa, Bachata & West Coast Swing classes in Jubilee Hills, Hyderabad.',
    });
    expect(meta.description).toBe(
      'Salsa, Bachata & West Coast Swing classes in Jubilee Hills, Hyderabad.',
    );
  });

  // Clearing a field in /admin leaves an empty string; a fat-fingered space
  // must behave the same way, not ship a one-space title.
  it('treats a whitespace-only value as unset', () => {
    expect(resolvePageMeta('faqs', { ...blank, seoTitle: '   ' }).title.absolute).toBe(
      'FAQs · Furor — Dance Hyderabad',
    );
    expect(resolvePageMeta('faqs', { ...blank, seoDescription: ' \n ' }).description).toBe(
      PAGE_SEO_DEFAULTS.faqs.description,
    );
  });

  it('still trims an over-long admin title instead of shipping it broken', () => {
    const meta = resolvePageMeta('about', {
      ...blank,
      seoTitle: 'A Very Long Admin Written Page Title That Nobody Would Sensibly Ship Anywhere',
    });
    expect(meta.title.absolute.length).toBeLessThanOrEqual(61);
    expect(meta.title.absolute.endsWith('…')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/seo.test.ts`
Expected: FAIL with `Error: Failed to load url ./page-meta (resolved id: .../src/lib/page-meta) ... Does the file exist?`

- [ ] **Step 3: Create `src/lib/page-meta.ts`**

```ts
import { fitDescription, fitTitle } from './seo';

// The eleven routes that own their own <title> and meta description. Every
// other route derives both from a record it already renders (a dance style, a
// story, a custom page), so there is nothing here to make editable.
export type PageMetaKey =
  | 'home'
  | 'about'
  | 'batches'
  | 'faqs'
  | 'contact'
  | 'instructorsPage'
  | 'danceStyles'
  | 'stories'
  | 'privacy'
  | 'terms'
  | 'welcome';

/**
 * The literals each route shipped before seoTitle / seoDescription existed.
 *
 * One home, on purpose. The same string used to appear in the route (as
 * fitDescription's second argument), and would otherwise also appear as the
 * schema default and as the admin placeholder — three copies, two of which
 * drift the first time anyone edits the wrong one. The schema defaults are
 * blank and both the route and /admin read from here instead.
 *
 * `home`'s title and description are the DEGENERATE case: the route always
 * passes derivedTitle / supportDescription built from the live dance styles,
 * and these values are only what a document with no styles at all would show.
 */
export const PAGE_SEO_DEFAULTS: Record<PageMetaKey, { title: string; description: string }> = {
  home: {
    title: 'Dance Classes in Hyderabad',
    description: 'Dance classes in Jubilee Hills, Hyderabad.',
  },
  about: {
    title: 'About',
    description:
      'The story of Furor — Hyderabad’s home for Salsa, Bachata and West Coast Swing.',
  },
  batches: {
    title: 'Batches & Pricing',
    description:
      'Upcoming Salsa, Bachata and West Coast Swing batches in Hyderabad with transparent pricing.',
  },
  faqs: {
    title: 'FAQs',
    description:
      'Answers on classes, batches, pricing and getting started at Furor Dance Hyderabad.',
  },
  contact: {
    title: 'Contact',
    description:
      'Get in touch with Furor Dance Hyderabad — WhatsApp, Instagram, email or visit the Jubilee Hills studio.',
  },
  instructorsPage: {
    title: 'Instructors',
    description:
      'Meet the instructors behind Furor’s Salsa, Bachata and West Coast Swing classes in Hyderabad.',
  },
  danceStyles: {
    title: 'Dance Styles',
    description:
      'Salsa, Bachata and West Coast Swing classes in Jubilee Hills, Hyderabad — find the style that fits you.',
  },
  stories: {
    title: 'Stories',
    description: 'Read what a night on the Furor floor actually looks like.',
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How Furor Dance Hyderabad collects, uses and protects your information.',
  },
  terms: {
    title: 'Terms & Services',
    description:
      'Terms of service for Furor Dance Hyderabad — classes, payments, conduct and refunds.',
  },
  welcome: {
    title: 'You’re in — Furor Hyderabad',
    description: 'Your intake details and next steps.',
  },
};

export interface PageMetaInput {
  /** The admin-written SERP title. Blank or whitespace-only means "not set". */
  seoTitle: string;
  /** The admin-written SERP description. Blank means "not set". */
  seoDescription: string;
  /** content.site.title — fitTitle spends whatever budget is left on it. */
  brand: string;
  /** A title this route builds from live records (home's lead styles, the
   *  legal pages' own intro headline). Beaten by seoTitle, beats the shipped
   *  fallback. */
  derivedTitle?: string;
  /** The page copy this route fed fitDescription before seoDescription existed
   *  — an intro lead, a first paragraph. Beaten by seoDescription. */
  derivedDescription?: string;
  /** Overrides the shipped support sentence. Only the home route needs it: its
   *  support line names the live dance styles. */
  supportDescription?: string;
}

function firstNonBlank(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c.trim();
  }
  return '';
}

/**
 * Resolve one route's title and description.
 *
 * Precedence, for both: what the studio typed in /admin, then what the route
 * derives from live records, then the literal it shipped. The result still goes
 * through fitTitle / fitDescription, so an over-long admin title is trimmed at
 * a word boundary rather than cut mid-word by the SERP — and a thin admin
 * description keeps the editor's words and gains the support sentence behind
 * them instead of being replaced by it.
 */
export function resolvePageMeta(
  key: PageMetaKey,
  input: PageMetaInput,
): { title: { absolute: string }; description: string } {
  const shipped = PAGE_SEO_DEFAULTS[key];
  return {
    title: fitTitle(
      firstNonBlank(input.seoTitle, input.derivedTitle, shipped.title),
      input.brand,
    ),
    description: fitDescription(
      firstNonBlank(input.seoDescription, input.derivedDescription),
      firstNonBlank(input.supportDescription, shipped.description),
    ),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/seo.test.ts`
Expected: PASS — `Tests 16 passed (16)` (8 from Task 1 + 8 here).

- [ ] **Step 5: Typecheck, full suite, seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent; `Tests T0 + 16 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 6: Commit**
```bash
git add src/lib/page-meta.ts src/lib/seo.test.ts
git commit -m "feat: resolvePageMeta and one home for every shipped title and description"
```


---

### Task 3: the eleven route metadata files read the editable fields

**Files:**
- Modify: `src/app/page.tsx` (anchor: ``    title: fitTitle(`${lead} Classes in Hyderabad`, c.site.title),``)
- Modify: `src/app/about/page.tsx` (anchor: `    title: 'About',`)
- Modify: `src/app/batches/page.tsx` (anchor: `    title: 'Batches & Pricing',`)
- Modify: `src/app/faqs/page.tsx` (anchor: `    title: 'FAQs',`)
- Modify: `src/app/instructors/page.tsx` (anchor: `    title: 'Instructors',`)
- Modify: `src/app/contact/page.tsx` (anchor: `export const metadata = {`)
- Modify: `src/app/dance-styles/page.tsx` (anchor: `    title: 'Dance Styles',`)
- Modify: `src/app/stories/page.tsx` (anchor: `    title: 'Stories',`)
- Modify: `src/app/privacy/page.tsx` (anchor: `    title: fitTitle(c.pages.privacy.intro.headline || 'Privacy Policy', c.site.title),`)
- Modify: `src/app/terms/page.tsx` (anchor: `    title: fitTitle(c.pages.terms.intro.headline || 'Terms & Services', c.site.title),`)
- Modify: `src/app/welcome/[track]/page.tsx` (anchor: `    title: 'You’re in — Furor Hyderabad',`)
- Test: `src/lib/seo.test.ts` (already written — Task 2's "reproduces the title the layout template renders today" is the gate for ten of these eleven)

**Interfaces:**
- Consumes: `resolvePageMeta`, `PAGE_SEO_DEFAULTS` from `@/lib/page-meta`.
- Produces: no new exports.

**This task ships one intended change and ten unchanged routes.** The change is `/`: its description stops borrowing `hero.subHeadline` and reads `site.tagline` instead, which is the second half of spec §6.3 (Plan 2 owns the first half, the sub-headline trim). Everything else must come out byte-identical.

- [ ] **Step 1: Capture today's metadata as the thing that must not change**

Run `npm run dev` in a second terminal, then:

```bash
node -e "(async()=>{for(const p of ['/','/about','/batches','/faqs','/instructors','/contact','/dance-styles','/stories','/privacy','/terms']){const h=await (await fetch('http://localhost:3000'+p)).text();const t=/<title>([^<]*)<\/title>/.exec(h)?.[1];const d=/<meta name=\"description\" content=\"([^\"]*)\"/.exec(h)?.[1];console.log(p+' || '+t+' || '+d);}})()" > meta-before.txt
cat meta-before.txt
```

Expected: 10 lines. `/about` reads `/about || About · Furor — Dance Hyderabad || Furor began in 2009 in Bangalore with a single Salsa class…`. Keep the file next to the repo root — Step 4 diffs against it, and Step 6 deletes it so the tree stays clean.

- [ ] **Step 2: Wire the ten indexable routes**

`src/app/page.tsx` — **Plan 3 Task 13 Step 5 has already rewritten this import line** to add `tonightEventLd`, and `const eventLd = tonightEventLd(content);` in `HomePage` depends on it. Anchor on the post-Plan-3 form and keep that export:

replace the import line

```ts
import { fitDescription, fitTitle, tonightEventLd } from '@/lib/seo';
```

with

```ts
import { tonightEventLd } from '@/lib/seo';
import { resolvePageMeta } from '@/lib/page-meta';
```

(`fitDescription` / `fitTitle` become unused in this file once the block below lands, and `tsconfig.json` does not set `noUnusedLocals` — R1a. If the anchor above is not found and the line still reads `import { fitDescription, fitTitle } from '@/lib/seo';`, Plan 3's Task 13 did not ship; in that case replace it with `import { resolvePageMeta } from '@/lib/page-meta';` alone and add no `tonightEventLd` import.)

Then replace the whole returned object (from `  return {` through the `  };` that closes `generateMetadata` — the block containing the `title:` anchor above) with:

```tsx
  const meta = resolvePageMeta('home', {
    seoTitle: c.pages.home.seoTitle,
    seoDescription: c.pages.home.seoDescription,
    brand: c.site.title,
    derivedTitle: `${lead} Classes in Hyderabad`,
    // Decoupled from hero.subHeadline (spec §6.3). SEO copy should stop
    // dictating what a first-time visitor reads, and the sub-headline is being
    // trimmed to ~130 characters — a meta description is not what it is for.
    derivedDescription: c.site.tagline,
    supportDescription: `${classes} classes in Jubilee Hills, Hyderabad.`,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/' },
  };
```

`src/app/about/page.tsx` — replace `import { fitDescription } from '@/lib/seo';` with `import { resolvePageMeta } from '@/lib/page-meta';`, then replace the returned object with:

```tsx
  const meta = resolvePageMeta('about', {
    seoTitle: c.pages.about.seoTitle,
    seoDescription: c.pages.about.seoDescription,
    brand: c.site.title,
    // introParagraphs[0] is a 322-character paragraph — more than double what a
    // SERP renders. fitDescription trims it on a word boundary.
    derivedDescription: c.pages.about.introParagraphs[0] ?? '',
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/about' },
  };
```

`src/app/batches/page.tsx` — same import swap, then:

```tsx
  const meta = resolvePageMeta('batches', {
    seoTitle: c.pages.batches.seoTitle,
    seoDescription: c.pages.batches.seoDescription,
    brand: c.site.title,
    derivedDescription: c.pages.batches.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/batches' },
  };
```

`src/app/faqs/page.tsx` — same import swap, then:

```tsx
  const meta = resolvePageMeta('faqs', {
    seoTitle: c.pages.faqs.seoTitle,
    seoDescription: c.pages.faqs.seoDescription,
    brand: c.site.title,
    derivedDescription: c.pages.faqs.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/faqs' },
  };
```

`src/app/instructors/page.tsx` — same import swap, then:

```tsx
  const meta = resolvePageMeta('instructorsPage', {
    seoTitle: c.pages.instructorsPage.seoTitle,
    seoDescription: c.pages.instructorsPage.seoDescription,
    brand: c.site.title,
    derivedDescription: c.pages.instructorsPage.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/instructors' },
  };
```

`src/app/dance-styles/page.tsx` — same import swap, then:

```tsx
  const meta = resolvePageMeta('danceStyles', {
    seoTitle: c.pages.danceStyles.seoTitle,
    seoDescription: c.pages.danceStyles.seoDescription,
    brand: c.site.title,
    // The admin lead here is a 45-character line — true, but on its own it left
    // two thirds of the snippet empty. fitDescription keeps it and adds the
    // support sentence behind it instead of choosing between them.
    derivedDescription: c.pages.danceStyles.intro.lead || c.pages.danceStyles.intro.headline,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/dance-styles' },
  };
```

`src/app/stories/page.tsx` — same import swap, then:

```tsx
  const meta = resolvePageMeta('stories', {
    seoTitle: c.pages.stories.seoTitle,
    seoDescription: c.pages.stories.seoDescription,
    brand: c.site.title,
    derivedDescription: c.pages.stories.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/stories' },
  };
```

`src/app/privacy/page.tsx` — replace `import { fitDescription, fitTitle } from '@/lib/seo';` with `import { resolvePageMeta } from '@/lib/page-meta';`, then:

```tsx
  const meta = resolvePageMeta('privacy', {
    seoTitle: c.pages.privacy.seoTitle,
    seoDescription: c.pages.privacy.seoDescription,
    brand: c.site.title,
    derivedTitle: c.pages.privacy.intro.headline,
    derivedDescription: c.pages.privacy.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/privacy' },
  };
```

`src/app/terms/page.tsx` — same import swap, then:

```tsx
  const meta = resolvePageMeta('terms', {
    seoTitle: c.pages.terms.seoTitle,
    seoDescription: c.pages.terms.seoDescription,
    brand: c.site.title,
    derivedTitle: c.pages.terms.intro.headline,
    derivedDescription: c.pages.terms.intro.lead,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/terms' },
  };
```

`src/app/contact/page.tsx` is the only static one. Replace the whole `export const metadata = { … };` block with a `generateMetadata`, and add the import beneath the existing `import { getPublicContent } from '@/lib/content';`:

```tsx
import { resolvePageMeta } from '@/lib/page-meta';

export async function generateMetadata() {
  const c = await getPublicContent();
  // No derivedDescription on purpose: this route has never used
  // pages.contact.intro.lead for its snippet, and borrowing it now would
  // silently replace the shipped one. The studio can still type its own.
  const meta = resolvePageMeta('contact', {
    seoTitle: c.pages.contact.seoTitle,
    seoDescription: c.pages.contact.seoDescription,
    brand: c.site.title,
  });
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: '/contact' },
  };
}
```

- [ ] **Step 3: Wire the confirmation page**

`src/app/welcome/[track]/page.tsx` keeps a plain-string title on purpose: the page is `noindex`, so the SERP budget is irrelevant, and a plain string leaves Next's layout `title.template` in charge — which is exactly today's behaviour. Add `import { PAGE_SEO_DEFAULTS } from '@/lib/page-meta';` under the existing `import { getPublicContent } from '@/lib/content';`, then replace the two metadata lines inside `generateMetadata`:

```tsx
    title: content.welcome.seoTitle.trim() || PAGE_SEO_DEFAULTS.welcome.title,
    description: cfg?.metaDesc || PAGE_SEO_DEFAULTS.welcome.description,
```

- [ ] **Step 4: Verify the rendered metadata is unchanged**

With `npm run dev` still running, re-run the exact command from Step 1 into a second file and diff:

```bash
node -e "(async()=>{for(const p of ['/','/about','/batches','/faqs','/instructors','/contact','/dance-styles','/stories','/privacy','/terms']){const h=await (await fetch('http://localhost:3000'+p)).text();const t=/<title>([^<]*)<\/title>/.exec(h)?.[1];const d=/<meta name=\"description\" content=\"([^\"]*)\"/.exec(h)?.[1];console.log(p+' || '+t+' || '+d);}})()" > meta-after.txt
diff meta-before.txt meta-after.txt
```

Expected: **exactly one changed line, and it is `/`.** Its title is unchanged; its description now begins with `India's largest Latin dance school.` (the tagline) instead of `Learn Salsa, Bachata and West Coast Swing…` (the hero sub-headline). Nine routes must be byte-identical. Any second differing line is a regression — fix it before committing.

This task ships with the automated cover in `seo.test.ts` (Task 2's template-title case) plus this diff. There is no route-level automated test, because nothing in this repo renders a route — that is exactly why the title arithmetic was moved into `resolvePageMeta` in the first place.

- [ ] **Step 5: Typecheck, full suite, seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent, exit 0; `Tests T0 + 16 passed` (unchanged — this task adds no test); `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 6: Commit**
```bash
rm -f meta-before.txt meta-after.txt
git add src/app/page.tsx src/app/about/page.tsx src/app/batches/page.tsx src/app/faqs/page.tsx src/app/instructors/page.tsx src/app/contact/page.tsx src/app/dance-styles/page.tsx src/app/stories/page.tsx src/app/privacy/page.tsx src/app/terms/page.tsx "src/app/welcome/[track]/page.tsx"
git commit -m "feat: route metadata reads the editable SEO fields and decouples home from the hero"
```

---

### Task 4: `SeoFields` — the admin pair, with live character counters

**Files:**
- Create: `src/components/admin/SeoFields.tsx`
- Modify: `src/app/admin/pages/about/AboutPageEditor.tsx` (anchor: `      <div className="mt-8 grid gap-5">`)
- Modify: `src/app/admin/pages/faqs/FaqsPageEditor.tsx` (anchor: `      <div className="mt-8 grid gap-5">`)
- Modify: `src/app/admin/pages/contact/ContactPageEditor.tsx` (anchor: `      <div className="mt-8 grid gap-5">`)
- Modify: `src/app/admin/pages/instructors/InstructorsPageEditor.tsx` (anchor: `      <div className="mt-8 grid gap-5">`)
- Modify: `src/app/admin/pages/home/HomePageEditor.tsx` (anchor: `      <div className="mt-8 grid gap-5">`)
- Modify: `src/components/admin/SimpleIntroEditor.tsx` (anchor: `type SimplePageKey = 'stories' | 'danceStyles' | 'batches';`)
- Modify: `src/components/admin/LegalPageEditor.tsx` (anchor: `        <Section title="Header">`)
- Test: none. This is markup over `charBudget` (pinned by Plan 1) and `SEO_TITLE_CHARS` / `SEO_DESC_CHARS` (pinned by Task 1). **This task ships with no automated regression cover**; Step 4 is the concrete manual check.

**Interfaces:**
- Consumes: `CharCount` from `@/components/admin/CharCount` (Plan 1), `Field` from `@/components/admin/fields`, `PAGE_SEO_DEFAULTS` / `PageMetaKey` from `@/lib/page-meta`, `SEO_TITLE_CHARS` / `SEO_DESC_CHARS` from `@/lib/seo`.
- Produces:
  ```ts
  export interface SeoValue { seoTitle: string; seoDescription: string }
  export function SeoFields(props: {
    pageKey: PageMetaKey;
    value: SeoValue;
    onChange: (next: SeoValue) => void;
    titleHint?: string;
  }): JSX.Element;
  ```

The placeholder is `PAGE_SEO_DEFAULTS[pageKey]`, so what the editor sees greyed out is literally what the page renders when the box is left empty — one string, one source, no third copy to drift.

- [ ] **Step 1: Create `src/components/admin/SeoFields.tsx`**

```tsx
'use client';

import { CharCount } from '@/components/admin/CharCount';
import { Field } from '@/components/admin/fields';
import { PAGE_SEO_DEFAULTS, type PageMetaKey } from '@/lib/page-meta';
import { SEO_DESC_CHARS, SEO_TITLE_CHARS } from '@/lib/seo';

export interface SeoValue {
  seoTitle: string;
  seoDescription: string;
}

/**
 * The search-result title and description for one page.
 *
 * Both still pass through fitTitle / fitDescription at render time, so an
 * over-long value is trimmed rather than shipped broken. The counters exist so
 * the editor finds that out here rather than from Google. The greyed-out
 * placeholder is the exact string the page renders when the box is empty.
 */
export function SeoFields({
  pageKey,
  value,
  onChange,
  titleHint = 'The site name is added after this automatically.',
}: {
  pageKey: PageMetaKey;
  value: SeoValue;
  onChange: (next: SeoValue) => void;
  titleHint?: string;
}) {
  const shipped = PAGE_SEO_DEFAULTS[pageKey];
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Search results</p>
      <p className="text-xs text-cream/50">
        What Google shows for this page. Leave a box empty to keep the wording we ship — the grey
        text inside it is that wording.
      </p>
      <Field label="Search title" hint={titleHint}>
        <input
          value={value.seoTitle}
          onChange={(e) => onChange({ ...value, seoTitle: e.target.value })}
          placeholder={shipped.title}
          className="input"
        />
        <CharCount
          text={value.seoTitle || shipped.title}
          max={SEO_TITLE_CHARS}
          note="the site name is added after this"
        />
      </Field>
      <Field
        label="Search description"
        hint="One or two sentences. Google shows about 155 characters."
      >
        <textarea
          rows={3}
          value={value.seoDescription}
          onChange={(e) => onChange({ ...value, seoDescription: e.target.value })}
          placeholder={shipped.description}
          className="input"
        />
        <CharCount text={value.seoDescription || shipped.description} max={SEO_DESC_CHARS} />
      </Field>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the five per-page editors**

Each of these already has a `patch…` function and a page slice in scope. Add the import beneath the existing `import { saveSiteContent } from '@/lib/admin-save';` line:

```tsx
import { SeoFields } from '@/components/admin/SeoFields';
```

then insert the component as the **first** child of that file's `<div className="mt-8 grid gap-5">`.

`src/app/admin/pages/about/AboutPageEditor.tsx` — slice `a`, patcher `patchAbout`:
```tsx
        <SeoFields
          pageKey="about"
          value={{ seoTitle: a.seoTitle, seoDescription: a.seoDescription }}
          onChange={(next) => patchAbout(next)}
        />
```

`src/app/admin/pages/faqs/FaqsPageEditor.tsx` — slice `f`, patcher `patch`:
```tsx
        <SeoFields
          pageKey="faqs"
          value={{ seoTitle: f.seoTitle, seoDescription: f.seoDescription }}
          onChange={(next) => patch(next)}
        />
```

`src/app/admin/pages/contact/ContactPageEditor.tsx` — slice `p`, patcher `patch`:
```tsx
        <SeoFields
          pageKey="contact"
          value={{ seoTitle: p.seoTitle, seoDescription: p.seoDescription }}
          onChange={(next) => patch(next)}
        />
```

`src/app/admin/pages/instructors/InstructorsPageEditor.tsx` — slice `p`, patcher `patch`:
```tsx
        <SeoFields
          pageKey="instructorsPage"
          value={{ seoTitle: p.seoTitle, seoDescription: p.seoDescription }}
          onChange={(next) => patch(next)}
        />
```

`src/app/admin/pages/home/HomePageEditor.tsx` — slice `h`, patcher `patchHome`:
```tsx
        <SeoFields
          pageKey="home"
          value={{ seoTitle: h.seoTitle, seoDescription: h.seoDescription }}
          onChange={(next) => patchHome(next)}
          titleHint="Leave empty and we build it from your two lead dance styles. The site name is added after either way."
        />
```

- [ ] **Step 3: Mount it in the two shared editors**

`src/components/admin/SimpleIntroEditor.tsx` also loses `batches` from its page-key union, because Task 8 gives that page its own schema and Task 10 its own editor.

Add beneath `import { saveSiteContent } from '@/lib/admin-save';`:
```tsx
import { SeoFields } from '@/components/admin/SeoFields';
```

Replace `type SimplePageKey = 'stories' | 'danceStyles' | 'batches';` with:
```tsx
// /batches moved to its own BatchesPageEditor when pages.batches gained the 34
// browser strings — this editor now backs the two pages that really are just an
// intro plus a search snippet.
type SimplePageKey = 'stories' | 'danceStyles';
```

Replace the block from `      <div className="mt-8 grid gap-3">` through its closing `      </div>` with:
```tsx
      <div className="mt-8 grid gap-3">
        <SeoFields
          pageKey={pageKey}
          value={{
            seoTitle: c.pages[pageKey].seoTitle,
            seoDescription: c.pages[pageKey].seoDescription,
          }}
          onChange={(next) => {
            setC((prev) => ({
              ...prev,
              pages: { ...prev.pages, [pageKey]: { ...prev.pages[pageKey], ...next } },
            }));
            setDirty(true);
          }}
        />
        <PageIntroFields value={intro} onChange={setIntro} />
      </div>
```

`src/components/admin/LegalPageEditor.tsx` — add the same import, then insert immediately **above** the anchor line `        <Section title="Header">`:
```tsx
        <SeoFields
          pageKey={pageKey}
          value={{ seoTitle: page.seoTitle, seoDescription: page.seoDescription }}
          onChange={(next) => patch(next)}
        />
```
`pageKey` there is already `'privacy' | 'terms'`, both of which are `PageMetaKey`s, so no cast is needed.

- [ ] **Step 4: Verify the counter in the browser**

This task has no automated cover, so the check is concrete and numeric. Run `npm run dev`, open `http://localhost:3000/admin/pages/about`.

1. With "Search title" empty, the hint below it must read `5/57 characters · the site name is added after this` — 5 because the placeholder `About` is what is being counted.
2. Type exactly `A Very Long Admin Written Page Title That Nobody Would Ship` (58 characters). The hint must read `58/57 characters — too long, it will be cut off`. Confirm the colour actually changed rather than the text alone:
   ```js
   getComputedStyle([...document.querySelectorAll('p')].find((p) => p.textContent.includes('58/57'))).color
   ```
   Expected: the `text-gold-400` token, not the muted `cream/40` the under-budget state uses.
3. Clear the box and confirm the hint returns to `5/57 characters · the site name is added after this`.
4. Repeat check 1 on `http://localhost:3000/admin/pages/privacy`: the placeholder must read `Privacy Policy` and the hint `14/57 characters · the site name is added after this`.

- [ ] **Step 5: Typecheck, full suite, seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent, exit 0; `Tests T0 + 16 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 6: Commit**
```bash
git add src/components/admin/SeoFields.tsx src/components/admin/SimpleIntroEditor.tsx src/components/admin/LegalPageEditor.tsx src/app/admin/pages/about/AboutPageEditor.tsx src/app/admin/pages/faqs/FaqsPageEditor.tsx src/app/admin/pages/contact/ContactPageEditor.tsx src/app/admin/pages/instructors/InstructorsPageEditor.tsx src/app/admin/pages/home/HomePageEditor.tsx
git commit -m "feat: editable search title and description with live character counters"
```

---

### Task 5: WhatsApp prefill templates become content

**Files:**
- Modify: `src/lib/content-schema.ts` (anchor: `export const SiteSettingsSchema = z.object({` — the new schema goes immediately **above** it; the `whatsappTemplates` field goes inside it, anchored on `  stats: z`)
- Modify: `src/lib/enquiry.ts` (anchor: `const FORBIDDEN = ['<', '>', '{{', '}}', 'undefined'];`)
- Modify: `src/components/EnquiryCTA.tsx` (anchors: `  className?: string;`, `  className,`, `            await navigator.clipboard.writeText(buildPrefilledMessage(ctx));`, `      ? buildWhatsAppHref(whatsappNumber, ctx)`, `    [channel, ctx, instagramHandle],`)
- Modify: `src/components/Footer.tsx` (anchor: `    buildWhatsAppHref(content.site.whatsappNumber, {`)
- Modify: every `<EnquiryCTA …>` call site (29 of them across 15 files — the exhaustive list is in Step 5)
- Test: `src/lib/enquiry.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  // src/lib/content-schema.ts
  export const FORBIDDEN_MESSAGE_TOKENS: readonly ['<', '>', '{{', '}}', 'undefined'];
  export function firstForbiddenToken(msg: string): string | null;
  export const WhatsappTemplatesSchema: z.ZodDefault<z.ZodObject<…>>;
  export type WhatsappTemplates = z.infer<typeof WhatsappTemplatesSchema>;
  // src/lib/enquiry.ts
  export function buildPrefilledMessage(ctx: EnquiryContext, t: WhatsappTemplates): string;
  export function buildWhatsAppHref(whatsappNumber: string, ctx: EnquiryContext, t: WhatsappTemplates): string;
  ```

Today `assertCleanMessage` **throws** inside `buildPrefilledMessage` — at click time, on the visitor's device — if a message contains `<`, `>`, `{{`, `}}` or `undefined`. Making the templates admin-editable would turn that into a live crash path. The check moves to the **write path** (Task 6), and the render path stops throwing entirely. Nothing here goes near `SiteContentSchema` as a refine: `src/lib/content.ts` catches a parse failure and serves the bundled seed for the whole public site, so a single `<` typed into `/admin/json` would take the site down (R3).

- [ ] **Step 1: Write the failing test**

Create `src/lib/enquiry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { FORBIDDEN_MESSAGE_TOKENS, firstForbiddenToken, SiteContentSchema } from './content-schema';
import { buildPrefilledMessage, buildWhatsAppHref } from './enquiry';

const doc = () => SiteContentSchema.parse(seed);
const templates = () => doc().site.whatsappTemplates;

const style = { slug: 'salsa', name: 'Salsa' };
const branch = { slug: 'jubilee-hills', name: 'Jubilee Hills' };
const batch = {
  id: 'batch-001',
  styleSlugs: ['salsa'],
  level: 'Foundation' as const,
  branchSlug: 'jubilee-hills',
  daysOfWeek: ['Sat', 'Sun'] as const,
  time: '9:30 AM – 10:30 AM',
  startDate: '2026-09-05',
  priceInr: 6000,
  reservationInr: 500,
  status: 'Open' as const,
};

describe('firstForbiddenToken', () => {
  it('names the token that makes a message unsafe', () => {
    expect(firstForbiddenToken('Hi <script>')).toBe('<');
    expect(firstForbiddenToken('Hi {{name}}')).toBe('{{');
    expect(firstForbiddenToken('Hi undefined')).toBe('undefined');
  });

  it('passes an ordinary message', () => {
    expect(firstForbiddenToken('Hi Furor, please share details.')).toBe(null);
  });

  // Single braces ARE the placeholder syntax — rejecting them would reject
  // every shipped template.
  it('allows the single-brace placeholders the templates actually use', () => {
    expect(firstForbiddenToken('Hi Furor, I want the {style} {level} batch.')).toBe(null);
  });

  it('pins the exact token list', () => {
    expect([...FORBIDDEN_MESSAGE_TOKENS]).toEqual(['<', '>', '{{', '}}', 'undefined']);
  });
});

describe('WhatsappTemplatesSchema', () => {
  it('ships the six messages and the optional studio fragment', () => {
    const t = templates();
    expect(t.batch).toBe(
      "Hi Furor, I'm interested in the {style} {level} batch at {branch} ({days}, {time}, starting {date}). Please share details.",
    );
    expect(t.styleFinder).toBe(
      'Hi Furor, the style finder suggested {style} {level}{where} for me. Please tell me about the next batch.',
    );
    expect(t.styleFinderWhere).toBe(' at {branch}');
    expect(t.style).toBe("Hi Furor, I'm interested in {style} classes — please share details.");
    expect(t.branch).toBe("Hi Furor, I'd like to know about classes at your {branch} studio.");
    expect(t.custom).toBe("Hi Furor, I'd like to come to {note}.");
    expect(t.generic).toBe("Hi Furor, I'd like to know more about your dance classes.");
  });

  it('keeps an edited template', () => {
    const d = doc();
    d.site.whatsappTemplates.generic = 'Hey Furor! Tell me about your classes please.';
    expect(SiteContentSchema.parse(d).site.whatsappTemplates.generic).toBe(
      'Hey Furor! Tell me about your classes please.',
    );
  });

  // THE outage guard. content.ts wraps SiteContentSchema.parse in a try whose
  // catch serves the bundled seed for the ENTIRE public site. If a forbidden
  // token could fail the parse, one '<' pasted into /admin/json — or arriving
  // from a restored version — would blank the whole site's content. The token
  // check belongs on the write path (integrity.ts) and nowhere else.
  it('does NOT reject a forbidden token on the read path', () => {
    const d = doc();
    d.site.whatsappTemplates.generic = 'Hi Furor <b>hello</b>';
    const r = SiteContentSchema.safeParse(d);
    expect(r.success).toBe(true);
  });
});

describe('buildPrefilledMessage', () => {
  it('fills the generic template', () => {
    expect(buildPrefilledMessage({ source: 'floating' }, templates())).toBe(
      "Hi Furor, I'd like to know more about your dance classes.",
    );
  });

  it('fills the style template', () => {
    expect(buildPrefilledMessage({ source: 'primary', style }, templates())).toBe(
      "Hi Furor, I'm interested in Salsa classes — please share details.",
    );
  });

  it('fills the branch template', () => {
    expect(buildPrefilledMessage({ source: 'footer', branch }, templates())).toBe(
      "Hi Furor, I'd like to know about classes at your Jubilee Hills studio.",
    );
  });

  it('fills the batch template, which is the most specific', () => {
    expect(buildPrefilledMessage({ source: 'batch_row', style, branch, batch }, templates())).toBe(
      "Hi Furor, I'm interested in the Salsa Foundation batch at Jubilee Hills (Sat–Sun, 9:30 AM – 10:30 AM, starting 5 September 2026). Please share details.",
    );
  });

  it('fills the style-finder template with the studio fragment', () => {
    expect(
      buildPrefilledMessage(
        {
          source: 'style_finder',
          styleFinderRecommendation: {
            styleName: 'Salsa',
            level: 'Foundation',
            branchName: 'Jubilee Hills',
          },
        },
        templates(),
      ),
    ).toBe(
      'Hi Furor, the style finder suggested Salsa Foundation at Jubilee Hills for me. Please tell me about the next batch.',
    );
  });

  it('drops the studio fragment entirely when no studio is known', () => {
    expect(
      buildPrefilledMessage(
        {
          source: 'style_finder',
          styleFinderRecommendation: { styleName: 'Salsa', level: 'Foundation' },
        },
        templates(),
      ),
    ).toBe(
      'Hi Furor, the style finder suggested Salsa Foundation for me. Please tell me about the next batch.',
    );
  });

  it('fills the custom-note template', () => {
    expect(
      buildPrefilledMessage({ source: 'primary', customNote: 'La Rumba on Saturday' }, templates()),
    ).toBe("Hi Furor, I'd like to come to La Rumba on Saturday.");
  });

  // With validation moved to save time, the render path must NOT throw. A
  // message reaching a visitor's device is already past the point where
  // crashing helps anyone — the worst case is a slightly odd prefill.
  it('does not throw on a message it would once have rejected', () => {
    const t = { ...templates(), generic: 'Hi Furor <unsafe>' };
    expect(() => buildPrefilledMessage({ source: 'floating' }, t)).not.toThrow();
    expect(buildPrefilledMessage({ source: 'floating' }, t)).toBe('Hi Furor <unsafe>');
  });

  // A placeholder the fill step has no value for stays as typed. Substituting
  // an empty string would silently delete words; substituting String(undefined)
  // is the exact failure the old FORBIDDEN list existed to catch.
  it('leaves an unknown placeholder as written rather than printing undefined', () => {
    const t = { ...templates(), generic: 'Hi Furor, about {mystery} classes.' };
    expect(buildPrefilledMessage({ source: 'floating' }, t)).toBe(
      'Hi Furor, about {mystery} classes.',
    );
  });
});

describe('buildWhatsAppHref', () => {
  it('percent-encodes the filled message onto wa.me', () => {
    expect(buildWhatsAppHref('918886072572', { source: 'floating' }, templates())).toBe(
      'https://wa.me/918886072572?text=' +
        encodeURIComponent("Hi Furor, I'd like to know more about your dance classes."),
    );
  });

  it('carries an edited template all the way into the href', () => {
    const t = { ...templates(), generic: 'Hey Furor!' };
    expect(buildWhatsAppHref('918886072572', { source: 'floating' }, t)).toBe(
      'https://wa.me/918886072572?text=' + encodeURIComponent('Hey Furor!'),
    );
  });
});
```

**Note on the batch case:** `formatBatchDate` in `src/lib/format.ts` is `toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })`, so `formatBatchDate('2026-09-05')` renders **`5 September 2026`** — a long month and a year, not `5 Sep`. Re-confirm on the machine you are running on before relying on it:

```bash
node -e "console.log(new Date('2026-09-05T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}))"
```

If the ICU data on that machine prints something else, correct the expected string to whatever it returns — the assertion exists to pin template *filling*, not date formatting, which `format.ts` already owns.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/enquiry.test.ts`
Expected: FAIL with `SyntaxError: [vite] The requested module './content-schema' does not provide an export named 'FORBIDDEN_MESSAGE_TOKENS'` — the file fails to import, so all 18 cases are reported as failed.

- [ ] **Step 3: Add the templates schema and the token helper**

In `src/lib/content-schema.ts`, insert immediately **above** the anchor line `export const SiteSettingsSchema = z.object({`:

```ts
// The tokens that make a prefilled WhatsApp message unsafe or obviously broken.
//
// `<` and `>` because the message is interpolated into an href and read back by
// a client that renders it; `{{` and `}}` because they are a template syntax
// nothing here implements, so they would ship to a visitor verbatim; and the
// literal word `undefined`, which is what a missing value used to produce.
//
// Checked at SAVE time (src/lib/integrity.ts), never on the read path. A Zod
// refine here would be evaluated by getContent() on every request, and
// content.ts serves the bundled seed for the ENTIRE public site when the parse
// throws — so one bad character would be a site-wide outage rather than a form
// error.
export const FORBIDDEN_MESSAGE_TOKENS = ['<', '>', '{{', '}}', 'undefined'] as const;

export function firstForbiddenToken(msg: string): string | null {
  for (const token of FORBIDDEN_MESSAGE_TOKENS) {
    if (msg.includes(token)) return token;
  }
  return null;
}

// The six prefilled WhatsApp messages, plus the optional studio fragment that
// is substituted into {where}. Single-brace {placeholders} are filled at render
// time from live records — the studio can rewrite the prose, it cannot make the
// batch details wrong.
export const WhatsappTemplatesSchema = z
  .object({
    batch: z
      .string()
      .default(
        "Hi Furor, I'm interested in the {style} {level} batch at {branch} ({days}, {time}, starting {date}). Please share details.",
      ),
    styleFinder: z
      .string()
      .default(
        'Hi Furor, the style finder suggested {style} {level}{where} for me. Please tell me about the next batch.',
      ),
    /** Substituted into {where} when a studio is known; dropped entirely when not. */
    styleFinderWhere: z.string().default(' at {branch}'),
    style: z
      .string()
      .default("Hi Furor, I'm interested in {style} classes — please share details."),
    branch: z.string().default("Hi Furor, I'd like to know about classes at your {branch} studio."),
    custom: z.string().default("Hi Furor, I'd like to come to {note}."),
    generic: z.string().default("Hi Furor, I'd like to know more about your dance classes."),
  })
  .default({});
```

Then add the field to `SiteSettingsSchema`, immediately **above** its `  stats: z` line:

```ts
  whatsappTemplates: WhatsappTemplatesSchema,
```

And add the type export at the bottom of the file, beneath `export type WelcomeTrack = z.infer<typeof WelcomeTrackSchema>;`:

```ts
export type WhatsappTemplates = z.infer<typeof WhatsappTemplatesSchema>;
```

- [ ] **Step 4: Rewrite `src/lib/enquiry.ts` to fill the templates**

Replace everything from the anchor line `const FORBIDDEN = ['<', '>', '{{', '}}', 'undefined'];` through the closing `}` of `buildWhatsAppHref` (i.e. up to but not including `export function buildInstagramAppHref`) with:

```ts
export { FORBIDDEN_MESSAGE_TOKENS, firstForbiddenToken } from './content-schema';
export type { WhatsappTemplates } from './content-schema';

/**
 * Substitute {placeholders}.
 *
 * A placeholder with no value is left EXACTLY as typed rather than replaced
 * with an empty string or String(undefined): deleting words silently is worse
 * than showing the editor their own token back, and "undefined" appearing in a
 * customer's WhatsApp draft is the precise failure the forbidden-token list
 * exists to prevent.
 */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole,
  );
}

/**
 * The prefilled WhatsApp body.
 *
 * The forbidden-token check that used to THROW here now runs on the write path
 * (src/lib/integrity.ts), so a bad template is a form error at save time rather
 * than a crash on a visitor's phone at click time. Nothing in this function
 * throws.
 */
export function buildPrefilledMessage(ctx: EnquiryContext, t: WhatsappTemplates): string {
  // Per-batch: most specific
  if (ctx.batch && ctx.style && ctx.branch) {
    return fill(t.batch, {
      style: ctx.style.name,
      level: ctx.batch.level,
      branch: ctx.branch.name,
      days: ctx.batch.daysOfWeek.join('–'),
      time: ctx.batch.time,
      date: formatBatchDate(ctx.batch.startDate),
    });
  }

  // Style finder result
  if (ctx.source === 'style_finder' && ctx.styleFinderRecommendation) {
    const r = ctx.styleFinderRecommendation;
    const where = r.branchName ? fill(t.styleFinderWhere, { branch: r.branchName }) : '';
    return fill(t.styleFinder, { style: r.styleName, level: r.level, where });
  }

  // Style page
  if (ctx.style && !ctx.branch) {
    return fill(t.style, { style: ctx.style.name });
  }

  // Branch page
  if (ctx.branch && !ctx.style) {
    return fill(t.branch, { branch: ctx.branch.name });
  }

  // Custom note (the Tonight tile, the trial ribbon)
  if (ctx.customNote) {
    return fill(t.custom, { note: ctx.customNote });
  }

  // Generic / floating from home
  return t.generic;
}

export function buildWhatsAppHref(
  whatsappNumber: string,
  ctx: EnquiryContext,
  t: WhatsappTemplates,
): string {
  const msg = buildPrefilledMessage(ctx, t);
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
}
```

Then add the value import at the top of the file, beneath `import type { Batch, DanceStyle, Studio } from './content-schema';`:

```ts
import type { WhatsappTemplates } from './content-schema';
```

- [ ] **Step 5: Thread the templates through every caller**

`buildWhatsAppHref` goes from two arguments to three, and `buildPrefilledMessage` from one to two. There are exactly **two direct callers** and **29 `<EnquiryCTA>` render sites across 15 files**. All of them are listed here; none is left to be found by accident.

`src/components/EnquiryCTA.tsx` — four edits.

Add to the imports (the module already imports from `@/lib/enquiry`):
```tsx
import type { WhatsappTemplates } from '@/lib/content-schema';
```

In `interface Props`, insert immediately above the anchor line `  className?: string;`:
```tsx
  /** The document's WhatsApp message templates. Required, not optional: every
   *  render site is reachable from the content document, and an optional prop
   *  here would mean silently falling back to a second copy of the same six
   *  strings living in code. */
  templates: WhatsappTemplates;
```

In the destructured parameter list, insert immediately above the anchor line `  className,`:
```tsx
  templates,
```

Replace the anchor line `            await navigator.clipboard.writeText(buildPrefilledMessage(ctx));` with:
```tsx
            await navigator.clipboard.writeText(buildPrefilledMessage(ctx, templates));
```

Replace the anchor line `    [channel, ctx, instagramHandle],` with:
```tsx
    [channel, ctx, instagramHandle, templates],
```

Replace the anchor line `      ? buildWhatsAppHref(whatsappNumber, ctx)` with:
```tsx
      ? buildWhatsAppHref(whatsappNumber, ctx, templates)
```

`src/components/Footer.tsx` — the local `wa` helper, and the footer WhatsApp icon Plan 2 added. Anchor on `    buildWhatsAppHref(content.site.whatsappNumber, {` and add the third argument to that call:
```tsx
    buildWhatsAppHref(
      content.site.whatsappNumber,
      { source: 'footer', branch: { slug: branchSlug, name: branchName } },
      content.site.whatsappTemplates,
    );
```
Then `grep -n "buildWhatsAppHref" src/components/Footer.tsx` and give **every** remaining occurrence its third argument `content.site.whatsappTemplates` — Plan 2's social row adds a second call in this file (`buildWhatsAppHref(content.site.whatsappNumber, { source: 'footer' })`), and it is a compile error, not a silent one, if it is missed.

Now add `templates={…}` beside the `labels={…}` prop Plan 1 already threaded, at all 29 `<EnquiryCTA>` sites. In every route file the **component** function binds `content` (`const content = await getPublicContent()`); the short `c` exists only inside `generateMetadata`, which renders no JSX — so `c` is out of scope at every render site, including `dance-styles/[slug]/page.tsx` (`c` at `:12`, `content` at `:34`). Use `content` throughout:

| File | sites | prop to add |
|---|---|---|
| `src/app/page.tsx` | 3 | `templates={content.site.whatsappTemplates}` |
| `src/app/about/page.tsx` | 2 | `templates={content.site.whatsappTemplates}` |
| `src/app/contact/page.tsx` | 2 | `templates={content.site.whatsappTemplates}` |
| `src/app/faqs/page.tsx` | 2 | `templates={content.site.whatsappTemplates}` |
| `src/app/instructors/page.tsx` | 2 | `templates={content.site.whatsappTemplates}` |
| `src/app/dance-styles/[slug]/page.tsx` | 3 | `templates={content.site.whatsappTemplates}` |
| `src/components/BatchActions.tsx` | 2 | a new `templates: WhatsappTemplates;` prop, passed down |
| `src/components/BatchesBrowser.tsx` | 1 | a new `templates: WhatsappTemplates;` prop, passed down |
| `src/components/QuickEnroll.tsx` | 3 | `templates={content.site.whatsappTemplates}` |
| `src/components/StyleFinder.tsx` | 2 | `templates={content.site.whatsappTemplates}` |
| `src/components/TonightTile.tsx` | 1 | `templates={content.site.whatsappTemplates}` |
| `src/components/TrialBanner.tsx` | 2 | `templates={content.site.whatsappTemplates}` |
| `src/components/Hero.tsx` | 1 | `templates={content.site.whatsappTemplates}` |
| `src/components/FloatingTalkToUs.tsx` | 2 | a new `templates: WhatsappTemplates;` prop |
| `src/components/StickyTrialBar.tsx` | 1 | a new `templates: WhatsappTemplates;` prop |

The four components that take only primitives need one new prop each. In each, add `import type { WhatsappTemplates } from '@/lib/content-schema';`, add `templates: WhatsappTemplates;` to the props type, add `templates` to the destructure, and pass `templates={templates}` to every `<EnquiryCTA>` inside. Their parents then pass it down:

- `src/app/layout.tsx` — the `<FloatingTalkToUs …/>` call gains `templates={content.site.whatsappTemplates}`.
- `src/app/page.tsx` — the `<StickyTrialBar …/>` call gains `templates={content.site.whatsappTemplates}`; the two `<BatchActions …/>` calls gain it too.
- `src/app/batches/page.tsx` — the `<BatchesBrowser …/>` call gains `templates={content.site.whatsappTemplates}`; `BatchesBrowser` passes it to its own `<BatchActions …/>`.

- [ ] **Step 6: Let the compiler find anything missed**

Run: `npm run typecheck`
Expected: exit 0, no output. While iterating, every miss reports as `Expected 3 arguments, but got 2.` (a direct `buildWhatsAppHref` call) or `Property 'templates' is missing in type … but required in type 'Props'.` (an `<EnquiryCTA>` site). Fix each and re-run until silent. This compiler pass is the guarantee that the 29-site list above is exhaustive.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/lib/enquiry.test.ts`
Expected: PASS — `Tests 18 passed (18)`.

- [ ] **Step 8: Full suite and seed check**

Run: `npx vitest run && npm run sync-seed -- --check`
Expected: `Tests T0 + 34 passed` (16 from Tasks 1–2 + 18 here); `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 9: Commit**
```bash
git add src/lib/content-schema.ts src/lib/enquiry.ts src/lib/enquiry.test.ts src/components src/app
git commit -m "feat: WhatsApp prefill templates become editable content"
```

---

### Task 6: the token check moves to the write path

**Files:**
- Modify: `src/lib/integrity.ts` (anchors: `function references(doc: Doc, issues: IntegrityIssue[]): void {` — the new function goes above it; `  return issues;` — the new call goes immediately above that line)
- Test: `src/lib/integrity.test.ts` (append)

**Interfaces:**
- Consumes: `firstForbiddenToken` from `./content-schema`.
- Produces: no new exports. `integrityIssues(doc)` gains issues at path `['site', 'whatsappTemplates', '<key>']`.

This is the V3 fix. `save-pipeline.ts` calls `integrityIssues(merged)` on the parsed document and only rejects issues the patch **introduced**, so a template that was already bad does not make every screen unsavable for the person trying to fix it — while a newly typed `<` is refused with a message naming the offending field. Plan 3 put its `welcomeTrackKey` check in this same file for the same reason; this one sits beside it.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/integrity.test.ts`. The file's `check` helper is a module-level `const`, so the new `describe` can use it. The existing `doc()` factory has no `site` key, which is deliberate — the last case below proves a document without one produces no issues rather than a crash.

```ts
import { SiteContentSchema } from './content-schema';
import seed from '@/data/site-content.seed.json';

const full = () => SiteContentSchema.parse(seed);

// A PRE-EXISTING, UNRELATED ISSUE LIVES IN THE SEED. Plan 2 Task 14 added a
// write-path socials check, and `site.socials.youtube` is stored as
// `https://youtube.com/furorhyd` — a bare path, not a channel — so from Plan 2
// onward integrityIssues(full()) ALWAYS returns one issue at
// ['site','socials','youtube']. Correcting that URL is the owner's action in
// /admin (Plan 2's own follow-up), not a code change, so it must not be
// "fixed" in data/site-content.json here. Every assertion below therefore
// narrows to the templates first: an unrelated issue must not fail this test,
// and this test must not start passing for the wrong reason if the owner does
// fix the URL.
const templateIssues = (d: unknown) =>
  integrityIssues(d).filter((i) => i.path[1] === 'whatsappTemplates');

describe('integrityIssues — WhatsApp templates', () => {
  // Save-time, never read-time. content.ts serves the bundled seed for the
  // whole public site when SiteContentSchema.parse throws, so this check must
  // refuse the SAVE, not the document.
  it('flags a template containing an angle bracket, naming the field', () => {
    const d = full();
    d.site.whatsappTemplates.generic = 'Hi Furor <b>hello</b>';
    expect(templateIssues(d)).toEqual([
      {
        path: ['site', 'whatsappTemplates', 'generic'],
        message: 'Message cannot contain "<" — it would break the WhatsApp link.',
      },
    ]);
  });

  it('flags a double brace and the literal word undefined', () => {
    const d = full();
    d.site.whatsappTemplates.style = 'Hi Furor, about {{style}} classes.';
    d.site.whatsappTemplates.branch = 'Hi Furor, classes at undefined studio.';
    const issues = templateIssues(d);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.path)).toEqual([
      ['site', 'whatsappTemplates', 'style'],
      ['site', 'whatsappTemplates', 'branch'],
    ]);
    expect(issues[1].message).toContain('undefined');
  });

  it('passes the shipped templates and an ordinary rewrite', () => {
    const d = full();
    expect(templateIssues(d)).toEqual([]);
    d.site.whatsappTemplates.generic = 'Hey Furor! Tell me about your classes please.';
    expect(templateIssues(d)).toEqual([]);
  });

  // integrityIssues runs on raw objects too (save-pipeline hands it the
  // pre-patch document), so a doc with no site key must be a no-op, not a throw.
  it('is a no-op on a document with no site key at all', () => {
    expect(check(doc())).toEqual([]);
    expect(integrityIssues({ site: {} })).toEqual([]);
    expect(integrityIssues({ site: { whatsappTemplates: null } })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/integrity.test.ts`
Expected: FAIL — `AssertionError: expected [] to deeply equal [ { path: [ 'site', 'whatsappTemplates', 'generic' ], message: 'Message cannot contain "<" …' } ]` on the first new case, with the other three either passing vacuously or failing on length.

- [ ] **Step 3: Add the check**

In `src/lib/integrity.ts`, add the import at the top of the file, above `export interface IntegrityIssue {`:

```ts
import { firstForbiddenToken } from './content-schema';
```

Insert this function immediately **above** the anchor `function references(doc: Doc, issues: IntegrityIssue[]): void {`:

```ts
// Admin-authored WhatsApp prefill templates.
//
// buildPrefilledMessage used to THROW on these tokens — at click time, on the
// visitor's device — which meant an admin could author a template that crashed
// a CTA in production. Checking here turns that into a form error at save time.
// It deliberately does NOT live in SiteContentSchema: a read-path refine would
// make one bad character serve the bundled seed for the entire public site.
function messageTemplates(doc: Doc, issues: IntegrityIssue[]): void {
  const site = doc.site;
  if (site == null || typeof site !== 'object') return;
  const templates = (site as Row).whatsappTemplates;
  if (templates == null || typeof templates !== 'object') return;
  for (const [key, value] of Object.entries(templates as Row)) {
    if (typeof value !== 'string') continue;
    const bad = firstForbiddenToken(value);
    if (bad) {
      issues.push({
        path: ['site', 'whatsappTemplates', key],
        message: `Message cannot contain "${bad}" — it would break the WhatsApp link.`,
      });
    }
  }
}
```

Then insert the call immediately **above** the anchor line `  return issues;` inside `integrityIssues`:

```ts
  messageTemplates(doc as Doc, issues);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/integrity.test.ts`
Expected: PASS — `Tests 12 passed (12)` if this file still holds its original 8 cases; `Tests 16 passed (16)` if Plan 3 already appended its 4 `welcomeTrackKey` cases. **Record which**, because the final gate's roll-up depends on it. Either way this task adds exactly 4.

- [ ] **Step 5: Prove the save path actually refuses it**

Run `npm run dev`, sign in to `/admin/site`, put a `<` into the "Everything else" WhatsApp message, and press **Save changes**.
Expected: the save bar shows an error rather than "Saved ✓", and the message names the field — `Message cannot contain "<" — it would break the WhatsApp link.` Remove the `<`, save again, and confirm it succeeds. (This step needs Task 7's panel; if you are running tasks strictly in order, tick it after Task 7 Step 3 and note it here.)

- [ ] **Step 6: Full suite and seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent; `Tests T0 + 38 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 7: Commit**
```bash
git add src/lib/integrity.ts src/lib/integrity.test.ts
git commit -m "fix: validate WhatsApp templates at save time instead of on the visitor's device"
```

---

### Task 7: the WhatsApp templates panel in `/admin/site`

**Files:**
- Modify: `src/app/admin/site/SiteEditor.tsx` (anchors: `  function patchWhy(patch: Partial<SiteContent['whyFuror']>) {` — the new patcher goes above it; `      <SaveBar dirty={dirty} onSave={save} />` — the new panel goes above it)
- Test: none. This is markup; the resolution logic is pinned by `enquiry.test.ts` and the refusal by `integrity.test.ts`. **This task ships with no automated regression cover**; Step 3 is the concrete manual check.

**Interfaces:**
- Consumes: `c.site.whatsappTemplates`.
- Produces: nothing.

`SiteEditor.tsx` defines its **own** local `Field` at the bottom of the file and its own `.input` CSS in a `<style jsx global>` block — it does **not** import from `@/components/admin/fields`. Do not add such an import: it would shadow the local component and change every field's markup in the file.

- [ ] **Step 1: Add the patcher**

In `src/app/admin/site/SiteEditor.tsx`, insert immediately **above** the anchor `  function patchWhy(patch: Partial<SiteContent['whyFuror']>) {`:

```tsx
  function patchTemplates(patch: Partial<SiteContent['site']['whatsappTemplates']>) {
    setC((p) => ({
      ...p,
      site: { ...p.site, whatsappTemplates: { ...p.site.whatsappTemplates, ...patch } },
    }));
    setDirty(true);
  }
```

- [ ] **Step 2: Add the panel**

Insert immediately **above** the anchor `      <SaveBar dirty={dirty} onSave={save} />` (and therefore below the closing `</div>` of the "Why Furor" panel):

```tsx
        <div className="mt-4 rounded-2xl border border-cream/10 bg-ink-900/40 p-5">
          <p className="display text-sm uppercase tracking-widest text-ember-400">
            WhatsApp messages
          </p>
          <p className="mt-1 text-xs text-cream/50">
            What we type into WhatsApp for a visitor when they tap a chat button. Words in{' '}
            <code>{'{braces}'}</code> are filled in from the real batch, style or studio — leave
            them in. Angle brackets, double braces and the word “undefined” are not allowed: the
            save is refused with an error rather than breaking a link on someone’s phone.
          </p>
          <div className="mt-4 grid gap-3">
            <Field
              label="A specific batch"
              hint="Placeholders: {style} {level} {branch} {days} {time} {date}"
            >
              <textarea
                rows={3}
                value={c.site.whatsappTemplates.batch}
                onChange={(e) => patchTemplates({ batch: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Style finder result" hint="Placeholders: {style} {level} {where}">
              <textarea
                rows={3}
                value={c.site.whatsappTemplates.styleFinder}
                onChange={(e) => patchTemplates({ styleFinder: e.target.value })}
                className="input"
              />
            </Field>
            <Field
              label="…and the studio bit inside {where}"
              hint="Placeholder: {branch}. Dropped entirely when no studio is known, so keep the leading space."
            >
              <input
                value={c.site.whatsappTemplates.styleFinderWhere}
                onChange={(e) => patchTemplates({ styleFinderWhere: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="A dance style page" hint="Placeholder: {style}">
              <textarea
                rows={2}
                value={c.site.whatsappTemplates.style}
                onChange={(e) => patchTemplates({ style: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="A studio page" hint="Placeholder: {branch}">
              <textarea
                rows={2}
                value={c.site.whatsappTemplates.branch}
                onChange={(e) => patchTemplates({ branch: e.target.value })}
                className="input"
              />
            </Field>
            <Field
              label="An event or offer"
              hint="Placeholder: {note} — filled from the tile or ribbon’s message context above."
            >
              <textarea
                rows={2}
                value={c.site.whatsappTemplates.custom}
                onChange={(e) => patchTemplates({ custom: e.target.value })}
                className="input"
              />
            </Field>
            <Field
              label="Everything else"
              hint="The floating button and the general “chat with us” buttons. No placeholders."
            >
              <textarea
                rows={2}
                value={c.site.whatsappTemplates.generic}
                onChange={(e) => patchTemplates({ generic: e.target.value })}
                className="input"
              />
            </Field>
          </div>
        </div>
```

- [ ] **Step 3: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000/admin/site` and scroll to "WhatsApp messages".

1. All seven boxes are present and pre-filled with the shipped copy.
2. Change "Everything else" to `Hey Furor! Tell me about your classes.` and save. Expected: `Saved ✓`.
3. Open `/` and tap the floating "Talk to us" WhatsApp button. Expected: the `wa.me` URL's `text=` parameter decodes to exactly `Hey Furor! Tell me about your classes.` Read it without leaving the page:
   ```js
   decodeURIComponent(new URL(document.querySelector('a[href^="https://wa.me/"]').href).searchParams.get('text'))
   ```
4. Back in `/admin/site`, put a `<` in that same box and save. Expected: the save is refused and the message reads `Message cannot contain "<" — it would break the WhatsApp link.`
5. Restore the original text (`Hi Furor, I'd like to know more about your dance classes.`) and save, so the working tree and the stored document both end clean.

- [ ] **Step 4: Typecheck, full suite, seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent; `Tests T0 + 38 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 5: Commit**
```bash
git add src/app/admin/site/SiteEditor.tsx
git commit -m "feat: edit the seven WhatsApp prefill messages in /admin/site"
```

---

### Task 8: `pages.batches.browser` — the /batches screen's 34 strings

**Files:**
- Modify: `src/lib/content-schema.ts` (anchors: `const SimpleIntroPageSchema = z` — the new schema goes immediately **below** its closing `.default({});`; and `    batches: SimpleIntroPageSchema,` inside `PagesSchema`)
- Test: `src/lib/content-schema.test.ts` (append — R4 guard from Task 1 Step 1)

**Interfaces:**
- Consumes: `PageIntroSchema` (already in the file).
- Produces: `content.pages.batches` typed as `BatchesPage` with `seoTitle`, `seoDescription`, `intro` and a `browser` object of 34 defaulted strings.

Facet **headings**, quick-pick **preset labels**, time-of-day / starting **option labels**, the filter-bar chrome and the row templates all belong to this one screen, so they live with it rather than in the global `labels` bag. This is also where the 12 `filter*` keys land that Plan 1 deliberately left out of `LABEL_DEFAULTS` — which is what keeps that bag at 50 keys and matches §4.2's own rationale.

The stored facet **values** (`Foundation`, `Filling Fast`, `Weekend`, `This month`, `Morning`, …) do not move: they are read from the query string, compared, and shared in bookmarked links. Only what a visitor reads becomes editable.

- [ ] **Step 1: Write the failing test**

If Task 1 Step 1 reported `content-schema.test.ts NEW`, create `src/lib/content-schema.test.ts` with the imports plus the `describe` below. If it reported `EXISTS`, append only the `describe` and merge the imports into the file's existing block.

```ts
import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema } from './content-schema';

const doc = () => SiteContentSchema.parse(seed);

describe('pages.batches.browser', () => {
  const b = () => doc().pages.batches.browser;

  it('ships the five quick-pick presets exactly as they render today', () => {
    expect(b().presetBeginner).toBe('🔰 Never danced? Start here');
    expect(b().presetWeekend).toBe('🗓️ Weekend classes');
    expect(b().presetEvening).toBe('🌙 Evening classes');
    expect(b().presetStartingSoon).toBe('⚡ Starting soon');
    expect(b().presetFillingFast).toBe('🔥 Filling fast');
  });

  it('ships the eight facet headings', () => {
    expect(b().facetStyle).toBe('Dance');
    expect(b().facetLevel).toBe('Level');
    expect(b().facetBranch).toBe('Studio');
    expect(b().facetTod).toBe('Time of day');
    expect(b().facetDays).toBe('Days');
    expect(b().facetStarting).toBe('Starting');
    expect(b().facetPrice).toBe('Price');
    expect(b().facetStatus).toBe('Availability');
  });

  it('ships the twelve filter-bar strings Plan 1 kept out of the label bag', () => {
    expect(b().filterQuickPicks).toBe('Quick picks');
    expect(b().filterShowAll).toBe('All filters');
    expect(b().filterHide).toBe('Hide filters');
    expect(b().filterClearAll).toBe('Clear all');
    expect(b().filterClearAction).toBe('Clear filters');
    expect(b().filterRemoveTitle).toBe('Remove filter');
    expect(b().filterSortLabel).toBe('Sort');
    expect(b().filterSortLevel).toBe('Beginner → advanced');
    expect(b().filterSortSoon).toBe('Soonest first');
    expect(b().filterSortLate).toBe('Latest first');
    expect(b().filterWeekends).toBe('Weekends');
    expect(b().filterWeekdays).toBe('Weekdays');
  });

  // The VALUES behind these are live URL state (?tod=Morning, ?starting=Later)
  // and never move. Only the display labels do.
  it('ships the six derived option labels whose values stay structural', () => {
    expect(b().todMorning).toBe('Morning');
    expect(b().todAfternoon).toBe('Afternoon');
    expect(b().todEvening).toBe('Evening');
    expect(b().startingThisMonth).toBe('This month');
    expect(b().startingNext30).toBe('Next 30 days');
    expect(b().startingLater).toBe('Later');
  });

  it('ships the three row templates with their placeholders intact', () => {
    expect(b().resultCount).toBe('{n} of {total} batches');
    expect(b().seatsTemplate).toBe('{n} seats');
    expect(b().startsPrefix).toBe('starts');
  });

  it('keeps the batches page its own intro and SEO fields', () => {
    const c = doc();
    expect(typeof c.pages.batches.seoTitle).toBe('string');
    expect(typeof c.pages.batches.seoDescription).toBe('string');
    expect(c.pages.batches.intro.headline).toBe(
      "What's open. What it costs. Real seats, real dates.",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'presetBeginner')` on the first case, and the same on each of the next four.

- [ ] **Step 3: Add `BatchesPageSchema`**

In `src/lib/content-schema.ts`, insert immediately **below** `SimpleIntroPageSchema`'s closing `  .default({});` (the anchor for locating it is the line `const SimpleIntroPageSchema = z`):

```ts
// The /batches screen's own copy. Facet headings, quick picks, the filter-bar
// chrome and the derived option labels belong to this one page, so they live
// with it rather than in the global `labels` bag — the studio edits batches-page
// wording on the batches screen, and keeping 34 strings out of a document key
// that is parsed on every request keeps that key's node count flat.
//
// The stored facet VALUES (Foundation / Filling Fast / Weekend / This month /
// Morning …) are live URL state in BatchesBrowser — read from the query string,
// compared, and shared in bookmarked links. They never change; only what a
// visitor reads does.
const BatchesPageSchema = z
  .object({
    seoTitle: z.string().default(''),
    seoDescription: z.string().default(''),
    intro: PageIntroSchema.default({ eyebrow: '', headline: '', lead: '' }),
    browser: z
      .object({
        // — Quick picks. All five render inside a .pill —
        presetBeginner: z.string().default('🔰 Never danced? Start here'),
        presetWeekend: z.string().default('🗓️ Weekend classes'),
        presetEvening: z.string().default('🌙 Evening classes'),
        presetStartingSoon: z.string().default('⚡ Starting soon'),
        presetFillingFast: z.string().default('🔥 Filling fast'),

        // — Facet group headings —
        facetStyle: z.string().default('Dance'),
        facetLevel: z.string().default('Level'),
        facetBranch: z.string().default('Studio'),
        facetTod: z.string().default('Time of day'),
        facetDays: z.string().default('Days'),
        facetStarting: z.string().default('Starting'),
        facetPrice: z.string().default('Price'),
        facetStatus: z.string().default('Availability'),

        // — Filter bar chrome —
        filterQuickPicks: z.string().default('Quick picks'),
        filterShowAll: z.string().default('All filters'),
        filterHide: z.string().default('Hide filters'),
        filterClearAll: z.string().default('Clear all'),
        filterClearAction: z.string().default('Clear filters'),
        filterRemoveTitle: z.string().default('Remove filter'),
        filterSortLabel: z.string().default('Sort'),
        filterSortLevel: z.string().default('Beginner → advanced'),
        filterSortSoon: z.string().default('Soonest first'),
        filterSortLate: z.string().default('Latest first'),
        filterWeekends: z.string().default('Weekends'),
        filterWeekdays: z.string().default('Weekdays'),

        // — Display labels for derived option values. All eight render inside
        //   a .pill; the values themselves are URL state and do not move. —
        todMorning: z.string().default('Morning'),
        todAfternoon: z.string().default('Afternoon'),
        todEvening: z.string().default('Evening'),
        startingThisMonth: z.string().default('This month'),
        startingNext30: z.string().default('Next 30 days'),
        startingLater: z.string().default('Later'),

        // — Row templates. {n} and {total} are filled from live counts. —
        resultCount: z.string().default('{n} of {total} batches'),
        seatsTemplate: z.string().default('{n} seats'),
        startsPrefix: z.string().default('starts'),
      })
      .default({}),
  })
  .default({});
```

Then, inside `PagesSchema`, replace the line `    batches: SimpleIntroPageSchema,` with:

```ts
    batches: BatchesPageSchema,
```

And add the type export at the bottom of the file, beneath `export type WhatsappTemplates = z.infer<typeof WhatsappTemplatesSchema>;`:

```ts
export type BatchesPage = z.infer<typeof BatchesPageSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: PASS — 6 more cases than before this task. If the file was `NEW`, `Tests 6 passed (6)`; if `EXISTS`, its previous count + 6.

- [ ] **Step 5: Typecheck, full suite, seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent; `Tests T0 + 44 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 6: Commit**
```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts
git commit -m "feat: pages.batches.browser carries the batches screen's 34 strings"
```

---

### Task 9: `BatchesBrowser` renders the editable copy

**Files:**
- Modify: `src/components/BatchesBrowser.tsx` (anchors listed per edit below)
- Modify: `src/app/batches/page.tsx` (anchor: `      <BatchesBrowser`)
- Test: none new — Task 8 pins every literal. **This task ships with no automated regression cover**; Step 4 is the concrete manual check.

**Interfaces:**
- Consumes: `content.pages.batches.browser`; `label` and `statusLabel` (Plan 1); `SiteContent` type.
- Produces: `BatchesBrowser` gains a `copy: BatchesPage['browser']` prop.

Plan 1 already gave this component a `labels: Labels` prop and adopted `statusLabel`. Every anchor below is quoted as the text **before this task**; where Plan 1 has already replaced it, follow R1a — confirm and skip.

- [ ] **Step 1: Add the prop**

Add to the imports at the top of `src/components/BatchesBrowser.tsx` (beside the existing `import type { Batch } from '@/lib/content-schema';`):

```tsx
import type { BatchesPage } from '@/lib/content-schema';
```

In `interface Props`, insert immediately below the anchor line `  instagramHandle: string;`:

```tsx
  /** pages.batches.browser — this screen's own copy. Separate from `labels`,
   *  which carries only the strings that recur across many screens. */
  copy: BatchesPage['browser'];
```

Add `copy` to the destructured parameter list on the anchor line `export function BatchesBrowser({ rows, styles, studios, whatsappNumber, instagramHandle }: Props) {` so it reads:

```tsx
export function BatchesBrowser({
  rows,
  styles,
  studios,
  whatsappNumber,
  instagramHandle,
  labels,
  templates,
  copy,
}: Props) {
```

(`labels` and `templates` are already there from Plan 1 and Task 5 — keep whatever the file has and add `copy`.)

- [ ] **Step 2: Wire the facet definitions and the presets**

Replace the whole `const groups: …` array (anchor: `  const groups: { key: FacetKey; label: string; options: { v: string; label: string }[] }[] = [`) with:

```tsx
  const groups: { key: FacetKey; label: string; options: { v: string; label: string }[] }[] = [
    { key: 'style', label: copy.facetStyle, options: styles.filter((s) => enriched.some((e) => e.styleSlugs.includes(s.slug))).map((s) => ({ v: s.slug, label: s.name })) },
    { key: 'level', label: copy.facetLevel, options: present(LEVEL_ORDER, (e) => e.level).map((v) => ({ v, label: v })) },
    ...(multiBranch ? [{ key: 'branch' as FacetKey, label: copy.facetBranch, options: studios.filter((s) => enriched.some((e) => e.branch === s.slug)).map((s) => ({ v: s.slug, label: s.name })) }] : []),
    { key: 'tod', label: copy.facetTod, options: present(TOD_ORDER, (e) => e.tod).map((v) => ({ v, label: todLabel(v, copy) })) },
    { key: 'days', label: copy.facetDays, options: present(['Weekend', 'Weekday'], (e) => e.days).map((v) => ({ v, label: dayKindLabel(v, copy) })) },
    { key: 'starting', label: copy.facetStarting, options: present(STARTING_ORDER, (e) => e.starting).map((v) => ({ v, label: startingLabel(v, copy) })) },
    { key: 'price', label: copy.facetPrice, options: priceVals.map((v) => ({ v, label: formatInr(Number(v)) })) },
    { key: 'status', label: copy.facetStatus, options: present(['Filling Fast', 'Open'], (e) => e.status).map((v) => ({ v, label: statusLabel(v, labels) })) },
  ];

  const presets: { label: string; p: Partial<Record<FacetKey, string[]>> }[] = [
    { label: copy.presetBeginner, p: { level: ['Foundation'] } },
    { label: copy.presetWeekend, p: { days: ['Weekend'] } },
    { label: copy.presetEvening, p: { tod: ['Evening'] } },
    { label: copy.presetStartingSoon, p: { starting: ['This month', 'Next 30 days'] } },
    { label: copy.presetFillingFast, p: { status: ['Filling Fast'] } },
  ];
```

The `presets` map keys on `pre.label` today (`key={pre.label}`), which breaks the moment two presets are renamed to the same string. Replace the anchor line `                key={pre.label}` with `                key={pre.p.level ? 'level' : pre.p.days ? 'days' : pre.p.tod ? 'tod' : pre.p.starting ? 'starting' : 'status'}` — or, more simply, add an `id` to each preset entry:

```tsx
  const presets: { id: string; label: string; p: Partial<Record<FacetKey, string[]>> }[] = [
    { id: 'beginner', label: copy.presetBeginner, p: { level: ['Foundation'] } },
    { id: 'weekend', label: copy.presetWeekend, p: { days: ['Weekend'] } },
    { id: 'evening', label: copy.presetEvening, p: { tod: ['Evening'] } },
    { id: 'soon', label: copy.presetStartingSoon, p: { starting: ['This month', 'Next 30 days'] } },
    { id: 'filling', label: copy.presetFillingFast, p: { status: ['Filling Fast'] } },
  ];
```
and change `key={pre.label}` to `key={pre.id}`. Use this second form — it is the one written out here and the one the rest of this step assumes.

- [ ] **Step 3: Wire the three option-label helpers and the remaining literals**

`labelFor` gains a `Labels` parameter below, so confirm the type is imported: `grep -n "type Labels" src/components/BatchesBrowser.tsx`. Plan 1 added `import { label, type Labels } from '@/lib/labels';` when it threaded the bag through this component; if only the value import is present, widen it to include `type Labels`.

Add these three pure helpers at the **bottom** of `src/components/BatchesBrowser.tsx`, beside the existing `labelFor` function:

```tsx
// Display labels for derived facet VALUES. The values are URL state and never
// move; these three functions are the only place the two are mapped, so the
// filter pill, the active chip and the option list can never disagree.
function todLabel(v: string, copy: BatchesPage['browser']): string {
  if (v === 'Morning') return copy.todMorning;
  if (v === 'Afternoon') return copy.todAfternoon;
  return copy.todEvening;
}

function dayKindLabel(v: string, copy: BatchesPage['browser']): string {
  return v === 'Weekend' ? copy.filterWeekends : copy.filterWeekdays;
}

function startingLabel(v: string, copy: BatchesPage['browser']): string {
  if (v === 'This month') return copy.startingThisMonth;
  if (v === 'Next 30 days') return copy.startingNext30;
  return copy.startingLater;
}
```

Give `labelFor` the two extra parameters it now needs. Replace its whole signature and body (anchor: `function labelFor(`) with:

```tsx
function labelFor(
  k: FacetKey,
  v: string,
  styles: { slug: string; name: string }[],
  studios: { slug: string; name: string }[],
  labels: Labels,
  copy: BatchesPage['browser'],
): string {
  if (k === 'style') return styles.find((s) => s.slug === v)?.name ?? v;
  if (k === 'branch') return studios.find((s) => s.slug === v)?.name ?? v;
  if (k === 'price') return formatInr(Number(v));
  if (k === 'days') return dayKindLabel(v, copy);
  if (k === 'tod') return todLabel(v, copy);
  if (k === 'starting') return startingLabel(v, copy);
  if (k === 'status') return statusLabel(v, labels);
  return v;
}
```

and update its call site — replace `sel[k].forEach((v) => activeChips.push({ k, v, label: labelFor(k, v, styles, studios) })),` with:

```tsx
    sel[k].forEach((v) =>
      activeChips.push({ k, v, label: labelFor(k, v, styles, studios, labels, copy) }),
    ),
```

Then the remaining literals, each anchored on its own text:

| anchor (text before this task) | replacement |
|---|---|
| `              Quick picks` | `              {copy.filterQuickPicks}` |
| `              {showFilters ? 'Hide filters' : 'All filters'}` | `              {showFilters ? copy.filterHide : copy.filterShowAll}` |
| `                  title="Remove filter"` | `                  title={copy.filterRemoveTitle}` |
| `                Clear all` | `                {copy.filterClearAll}` |
| `            Sort` | `            {copy.filterSortLabel}` |
| `              <option value="level">Beginner → advanced</option>` | `              <option value="level">{copy.filterSortLevel}</option>` |
| `              <option value="soon">Soonest first</option>` | `              <option value="soon">{copy.filterSortSoon}</option>` |
| `              <option value="late">Latest first</option>` | `              <option value="late">{copy.filterSortLate}</option>` |
| `              No batches match these filters yet. Chat with us — we&apos;ll tell you when one opens.` | `              {label(labels, 'emptyNoBatches')}` |
| `              <button onClick={clearAll} className="btn-secondary">Clear filters</button>` | `              <button onClick={clearAll} className="btn-secondary">{copy.filterClearAction}</button>` |
| `                          first-timers welcome` | `                          {label(labels, 'badgeFirstTimersWelcome')}` |
| `                      primaryLabelWhenNoLink="Enquire"` | `                      primaryLabelWhenNoLink={label(labels, 'ctaEnquire')}` |
| `                    <p className="text-cream/60 text-sm">starts {formatBatchDate(b.startDate)}</p>` | `                    <p className="text-cream/60 text-sm">{copy.startsPrefix} {formatBatchDate(b.startDate)}</p>` |
| `                      <p className="text-cream/60 text-xs">{b.seatsLeft} seats</p>` | `                      <p className="text-cream/60 text-xs">{copy.seatsTemplate.replace('{n}', String(b.seatsLeft))}</p>` |

The result bar is the one non-mechanical replacement, because the count is bold and the template is not. Compute the two halves once, immediately above the component's `return (`:

```tsx
  // Split rather than interpolate: the count is bold and the rest is not, so
  // the template has to be cut at {n}. A template without {n} degrades to
  // "<count><whole template with {total} filled>", which is ugly but never
  // blank and never throws.
  const [resultBefore, resultAfter = ''] = copy.resultCount.split('{n}');
```

then replace the whole result-bar paragraph (anchor: `            <span className="font-semibold text-cream">{filtered.length}</span> of {enriched.length} batches`) with:

```tsx
            {resultBefore}
            <span className="font-semibold text-cream">{filtered.length}</span>
            {resultAfter.replace('{total}', String(enriched.length))}
```

- [ ] **Step 4: Pass the prop and check the render**

In `src/app/batches/page.tsx`, add to the `<BatchesBrowser …/>` call (anchor: `        instagramHandle={content.site.instagramHandle}`), immediately below it:

```tsx
        copy={content.pages.batches.browser}
```

Run `npm run typecheck` — expected silent, exit 0.

Then run `npm run dev`, open `http://localhost:3000/batches` at a **375px** viewport, and check all four:

1. Nothing changed. Every quick pick, facet heading, sort option and chip reads exactly as it did before. Spot-check the result bar: it must still read `<n> of <total> batches` with the first number bold.
2. No pill clips:
   ```js
   [...document.querySelectorAll('.pill')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim())
   ```
   Expected: `[]`.
3. No control lost its accessible name:
   ```js
   [...document.querySelectorAll('a,button')].filter((e) => !e.textContent.trim() && !e.getAttribute('aria-label')).length
   ```
   Expected: `0`.
4. The URL state still round-trips. Click "🗓️ Weekend classes", confirm the address bar shows `?days=Weekend`, reload, and confirm the filter is still applied and the active chip reads `Weekends`. This is the assertion that the display labels moved and the **values** did not.

- [ ] **Step 5: Full suite and seed check**

Run: `npx vitest run && npm run sync-seed -- --check`
Expected: `Tests T0 + 44 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 6: Commit**
```bash
git add src/components/BatchesBrowser.tsx src/app/batches/page.tsx
git commit -m "feat: batches browser renders pages.batches.browser instead of hardcoded copy"
```

---

### Task 10: `BatchesPageEditor` — all 34 fields

**Files:**
- Create: `src/app/admin/pages/batches/BatchesPageEditor.tsx`
- Modify: `src/app/admin/pages/batches/page.tsx` (anchor: `      <SimpleIntroEditor initial={c} pageKey="batches" />`)
- Test: none. **This task ships with no automated regression cover**; Step 3 is the concrete manual check.

**Interfaces:**
- Consumes: `SeoFields` (Task 4), `PageIntroFields`, `Field`, `EditorStyles`, `SaveBar`, `saveSiteContent`, `CharCount` and `PILL_CHAR_LIMIT` (Plan 1).
- Produces: `export function BatchesPageEditor({ initial }: { initial: SiteContent }): JSX.Element`.

Thirteen of the 34 fields render inside a `.pill`, which is `whitespace-nowrap` inside `overflow-clip` wrappers — an over-long value cuts itself off with no warning to whoever typed it (§6.4). Those thirteen carry a `CharCount` against Plan 1's `PILL_CHAR_LIMIT`. Plan 1's `PILL_KEYS` covers the label bag only; this is the same mechanism for the fields that live outside it.

- [ ] **Step 1: Create the editor**

```tsx
'use client';

import { useState } from 'react';
import type { BatchesPage, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { SeoFields } from '@/components/admin/SeoFields';
import { CharCount } from '@/components/admin/CharCount';
import { PILL_CHAR_LIMIT } from '@/lib/labels';
import { saveSiteContent } from '@/lib/admin-save';

type Browser = BatchesPage['browser'];
type BrowserKey = keyof Browser;

// The thirteen values that render inside a .pill on /batches — the five quick
// picks and the eight derived option labels. `.pill` is whitespace-nowrap
// inside overflow-clip wrappers, so a long value razor-cuts itself with no
// warning. Same budget as Plan 1's PILL_KEYS, which covers the label bag.
const PILL_FIELDS = new Set<BrowserKey>([
  'presetBeginner',
  'presetWeekend',
  'presetEvening',
  'presetStartingSoon',
  'presetFillingFast',
  'todMorning',
  'todAfternoon',
  'todEvening',
  'startingThisMonth',
  'startingNext30',
  'startingLater',
  'filterWeekends',
  'filterWeekdays',
]);

const GROUPS: { title: string; blurb: string; fields: { key: BrowserKey; label: string; hint?: string }[] }[] = [
  {
    title: 'Quick picks',
    blurb: 'The one-tap filter chips along the top of the page.',
    fields: [
      { key: 'presetBeginner', label: 'Beginner preset' },
      { key: 'presetWeekend', label: 'Weekend preset' },
      { key: 'presetEvening', label: 'Evening preset' },
      { key: 'presetStartingSoon', label: 'Starting-soon preset' },
      { key: 'presetFillingFast', label: 'Filling-fast preset' },
    ],
  },
  {
    title: 'Filter bar',
    blurb: 'The controls around the filters — headings, buttons and the sort menu.',
    fields: [
      { key: 'filterQuickPicks', label: '“Quick picks” heading' },
      { key: 'filterShowAll', label: 'Show-filters button (mobile)' },
      { key: 'filterHide', label: 'Hide-filters button (mobile)' },
      { key: 'filterClearAll', label: 'Clear-all link' },
      { key: 'filterClearAction', label: 'Clear-filters button (empty state)' },
      { key: 'filterRemoveTitle', label: 'Remove-filter tooltip', hint: 'Shown on hover over an active filter chip.' },
      { key: 'filterSortLabel', label: 'Sort label' },
      { key: 'filterSortLevel', label: 'Sort option — beginner first' },
      { key: 'filterSortSoon', label: 'Sort option — soonest first' },
      { key: 'filterSortLate', label: 'Sort option — latest first' },
    ],
  },
  {
    title: 'Filter group headings',
    blurb: 'The small uppercase heading above each set of filter chips.',
    fields: [
      { key: 'facetStyle', label: 'Dance style group' },
      { key: 'facetLevel', label: 'Level group' },
      { key: 'facetBranch', label: 'Studio group', hint: 'Only shown when you have more than one studio.' },
      { key: 'facetTod', label: 'Time-of-day group' },
      { key: 'facetDays', label: 'Days group' },
      { key: 'facetStarting', label: 'Start-date group' },
      { key: 'facetPrice', label: 'Price group' },
      { key: 'facetStatus', label: 'Availability group' },
    ],
  },
  {
    title: 'Filter chip wording',
    blurb:
      'What each chip says. These are labels only — the values behind them are part of the page address, so a shared or bookmarked filter link keeps working however you word these.',
    fields: [
      { key: 'filterWeekends', label: 'Weekend chip' },
      { key: 'filterWeekdays', label: 'Weekday chip' },
      { key: 'todMorning', label: 'Morning chip' },
      { key: 'todAfternoon', label: 'Afternoon chip' },
      { key: 'todEvening', label: 'Evening chip' },
      { key: 'startingThisMonth', label: 'Starting this month chip' },
      { key: 'startingNext30', label: 'Starting in 30 days chip' },
      { key: 'startingLater', label: 'Starting later chip' },
    ],
  },
  {
    title: 'Batch rows',
    blurb: 'The three bits of wording on the result list itself.',
    fields: [
      { key: 'resultCount', label: 'Result count', hint: 'Use {n} for how many are showing and {total} for how many there are.' },
      { key: 'seatsTemplate', label: 'Seats left', hint: 'Use {n} for the number of seats.' },
      { key: 'startsPrefix', label: 'Start-date prefix', hint: 'The word before the date, e.g. “starts 5 Sep”.' },
    ],
  },
];

export function BatchesPageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  const p = c.pages.batches;

  function patchPage(patch: Partial<BatchesPage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, batches: { ...prev.pages.batches, ...patch } },
    }));
    setDirty(true);
  }

  function patchBrowser(key: BrowserKey, value: string) {
    setC((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        batches: {
          ...prev.pages.batches,
          browser: { ...prev.pages.batches.browser, [key]: value },
        },
      },
    }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <SeoFields
          pageKey="batches"
          value={{ seoTitle: p.seoTitle, seoDescription: p.seoDescription }}
          onChange={(next) => patchPage(next)}
        />

        <Section title="Header">
          <PageIntroFields value={p.intro} onChange={(v) => patchPage({ intro: v })} />
        </Section>

        {GROUPS.map((g) => (
          <Section key={g.title} title={g.title} blurb={g.blurb}>
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input
                  value={p.browser[f.key]}
                  onChange={(e) => patchBrowser(f.key, e.target.value)}
                  className="input"
                />
                {PILL_FIELDS.has(f.key) ? (
                  <CharCount
                    text={p.browser[f.key]}
                    max={PILL_CHAR_LIMIT}
                    note="shown in a small rounded chip — longer text gets cut off on phones"
                  />
                ) : null}
              </Field>
            ))}
          </Section>
        ))}
      </div>

      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
      <p className="display text-sm uppercase tracking-widest text-ember-400">{title}</p>
      {blurb ? <p className="-mt-1 text-xs text-cream/50">{blurb}</p> : null}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Point the route at it**

In `src/app/admin/pages/batches/page.tsx`, replace the import line `import { SimpleIntroEditor } from '@/components/admin/SimpleIntroEditor';` with:

```tsx
import { BatchesPageEditor } from './BatchesPageEditor';
```

and replace the anchor line `      <SimpleIntroEditor initial={c} pageKey="batches" />` with:

```tsx
      <BatchesPageEditor initial={c} />
```

Widen the shell so 34 fields are not crammed into a 3-column page: replace `    <div className="p-6 sm:p-10 max-w-3xl">` with `    <div className="p-6 sm:p-10 max-w-5xl">`.

The page already calls `await requireWriteAccess('pages');`, so `admin-pages-guarded.test.ts` stays green — do not remove it.

- [ ] **Step 3: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000/admin/pages/batches`.

1. Count the inputs in the five browser groups — there must be exactly **34**, plus 2 SEO boxes and 3 intro boxes:
   ```js
   document.querySelectorAll('input.input, textarea.input').length
   ```
   Expected: `39`.
2. Thirteen of them show a character hint. Confirm:
   ```js
   [...document.querySelectorAll('p')].filter((e) => /\/24 characters/.test(e.textContent)).length
   ```
   Expected: `13`.
3. Set "Beginner preset" to `🔰 Never danced before at all? Start right here` and confirm the hint turns gold and reads over budget.
4. Restore it to `🔰 Never danced? Start here`, then change "Sort label" to `Order` and save. Open `/batches` and confirm the sort control now reads `Order`. Change it back and save again so the stored document ends unmodified.

- [ ] **Step 4: Typecheck, full suite, seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent; `Tests T0 + 44 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 5: Commit**
```bash
git add src/app/admin/pages/batches
git commit -m "feat: /admin/pages/batches edits all 34 batches-screen strings"
```

---

### Task 11: `pages.home.board` — the booking board's 21 fields

**Files:**
- Modify: `src/lib/content-schema.ts` (anchor: `    whatWeTeach: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),`)
- Test: `src/lib/content-schema.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `content.pages.home.board` — 20 defaulted strings plus a `countIn` array of `{ count, title, body }`.

The board is the conversion surface, so its copy gets its own object rather than being sprinkled through the label bag. Two rules are load-bearing in the defaults:

1. **No rupee figure in prose.** `{price}` is filled from live batch data (`Hero.tsx` records the same rule). A hardcoded amount means the copy lies the day the deposit changes.
2. **No money-back promise.** The owner corrected this on 2026-08-08: the paid trial is **non-refundable**, so the risk reversal is the *size of the commitment* (one class, no package), never a refund. The test below pins that.

`countIn` is an array of plain objects with no `id` field, exactly like `pages.home.howItWorks.steps`. It therefore needs **no** entry in `src/lib/collections.ts` (that registry is for arrays addressed by id) and trips no `DENY_IDS` rule.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/content-schema.test.ts`:

```ts
describe('pages.home.board', () => {
  const b = () => doc().pages.home.board;

  it('ships the board header exactly as it renders today', () => {
    expect(b().speed).toBe('Book in ~30 seconds');
    expect(b().headline).toBe('Start dancing');
    expect(b().headlineAccent).toBe('this week.');
  });

  // The codebase rule at Hero.tsx: the trial price comes from live batch data,
  // never from a hardcoded string, so the copy cannot go stale on its own.
  it('keeps the price out of prose except as a placeholder', () => {
    expect(b().leadWithPrice).toContain('{price}');
    expect(b().leadWithPrice).not.toMatch(/₹\s?\d/);
    expect(b().leadNoPrice).toBe('Come once, meet the room, then decide on the full program.');
    expect(b().trialPrice).toBe('Trial class {price}');
    expect(b().fullProgram).toBe('Full program {price} — decide after class one.');
  });

  it('ships the two per-card notes and the start-date template', () => {
    expect(b().spotlitNote).toBe('No partner, no experience needed.');
    expect(b().higherLevelNote).toBe('For dancers with the basics down.');
    expect(b().startsTemplate).toBe('Starts {date}');
  });

  // "1 seats left" is the bug this pair exists to prevent.
  it('ships both seats-left forms so the singular is not “1 seats”', () => {
    expect(b().seatsLeftOne).toBe('● {n} seat left');
    expect(b().seatsLeftMany).toBe('● {n} seats left');
  });

  it('ships the four count-in cards', () => {
    const cards = b().countIn;
    expect(cards).toHaveLength(4);
    expect(cards.map((x) => x.count)).toEqual(['5', '6', '7', '8']);
    expect(cards[0].title).toBe('Come alone.');
    expect(cards[3].title).toBe('One class, not a course.');
    expect(cards[3].body).toContain('{price}');
  });

  // The owner corrected this on 2026-08-08: the paid trial is NON-REFUNDABLE,
  // so no default here may promise money back.
  it('never promises a refund', () => {
    expect(JSON.stringify(b())).not.toMatch(/refund|money back/i);
  });

  it('ships the closing links and the resolve line', () => {
    expect(b().resolveLine).toBe("…and on the 1, you're dancing.");
    expect(b().proofSuffix).toBe(', {style} student');
    expect(b().styleFinderLink).toBe('Not sure which? Take the 30-second style finder →');
    expect(b().advancedLink).toBe('Danced before? Intermediate & Advanced →');
    expect(b().allBatchesLink).toBe('See all batches & prices');
    expect(b().emptyNote).toBe(
      'Hi! I want to join a dance batch — please let me know the next start dates.',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'speed')` on the first new case, and the same shape on the other six.

- [ ] **Step 3: Add the schema**

In `src/lib/content-schema.ts`, inside `HomePageSchema`, insert immediately **above** the anchor line `    whatWeTeach: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),`:

```ts
    // The booking board — the conversion surface. Its own object because every
    // string here belongs to that one block, not to the site at large.
    board: z
      .object({
        speed: z.string().default('Book in ~30 seconds'),
        headline: z.string().default('Start dancing'),
        /** Rendered inside <span class="accent"> — the highlighted tail. */
        headlineAccent: z.string().default('this week.'),
        // {price} is filled from live batch data. Never hardcode a rupee figure
        // in prose: the copy would lie the day the deposit changes.
        leadWithPrice: z
          .string()
          .default(
            'Every batch opens with a {price} trial class — come once, meet the room, then decide on the full program.',
          ),
        leadNoPrice: z
          .string()
          .default('Come once, meet the room, then decide on the full program.'),
        spotlitNote: z.string().default('No partner, no experience needed.'),
        higherLevelNote: z.string().default('For dancers with the basics down.'),
        startsTemplate: z.string().default('Starts {date}'),
        trialPrice: z.string().default('Trial class {price}'),
        fullProgram: z.string().default('Full program {price} — decide after class one.'),
        // Two forms, because "1 seats left" is what one template produces.
        seatsLeftOne: z.string().default('● {n} seat left'),
        seatsLeftMany: z.string().default('● {n} seats left'),
        // The count-in strip: the four documented first-class fears, answered at
        // the point of decision. Items 5-7 are backed by live site copy (FAQ,
        // hero) — none of these lines ships unverified. Item 8 used to promise
        // the trial fee back; the owner corrected that on 2026-08-08 — the paid
        // trial is NON-REFUNDABLE, so the risk reversal is the size of the
        // commitment, never money back.
        countIn: z
          .array(
            z.object({
              count: z.string().default(''),
              title: z.string().default(''),
              body: z.string().default(''),
            }),
          )
          .default([
            {
              count: '5',
              title: 'Come alone.',
              body: 'No partner needed — partners rotate all class, so you’ll dance with everyone.',
            },
            {
              count: '6',
              title: 'Never danced?',
              body: 'Foundation assumes zero experience. Most of the room started exactly there.',
            },
            {
              count: '7',
              title: 'Wear anything.',
              body: 'Anything comfortable you can move in — fresh socks or smooth soles beat fancy shoes.',
            },
            {
              count: '8',
              title: 'One class, not a course.',
              body: '{price} books a single class — no package, no sign-up. You decide on the full program after.',
            },
          ]),
        /** Substituted for a {price} card body when no trial price is known. */
        countInFallbackBody: z
          .string()
          .default(
            'The token books a single class — no package, no sign-up. You decide on the full program after.',
          ),
        resolveLine: z.string().default("…and on the 1, you're dancing."),
        proofSuffix: z.string().default(', {style} student'),
        styleFinderLink: z.string().default('Not sure which? Take the 30-second style finder →'),
        advancedLink: z.string().default('Danced before? Intermediate & Advanced →'),
        allBatchesLink: z.string().default('See all batches & prices'),
        emptyNote: z
          .string()
          .default('Hi! I want to join a dance batch — please let me know the next start dates.'),
      })
      .default({}),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: PASS — 7 more cases than after Task 8 (13 new in this file so far).

- [ ] **Step 5: Typecheck, full suite, seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent; `Tests T0 + 51 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 6: Commit**
```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts
git commit -m "feat: pages.home.board carries the booking board's copy"
```

---

### Task 12: `QuickEnroll` renders the editable board copy

**Files:**
- Modify: `src/components/QuickEnroll.tsx` (anchors listed per edit)
- Test: none new — Task 11 pins every literal. **This task ships with no automated regression cover**; Step 4 is the concrete manual check.

**Interfaces:**
- Consumes: `content.pages.home.board`, `label` from `@/lib/labels` (Plan 1).
- Produces: nothing.

The board object is bound to a local named `board`, **not** `b` — the batch map callback already uses `b`, and renaming it would touch twenty lines for no reason. Plan 1 has already replaced the `bookLabel` / `statusLabel` literals in this file; every anchor below is quoted as the text before *this* task, so follow R1a where Plan 1 got there first.

- [ ] **Step 1: Rewrite the `countIn` helper**

In `src/components/QuickEnroll.tsx`, replace the whole `function countIn(trialPrice: string | null)` declaration and body (anchor: `function countIn(trialPrice: string | null): { count: string; title: string; body: string }[] {`) with:

```tsx
function countIn(
  board: SiteContent['pages']['home']['board'],
  trialPrice: string | null,
): { count: string; title: string; body: string }[] {
  return board.countIn.map((item) =>
    item.body.includes('{price}')
      ? {
          ...item,
          body: trialPrice ? item.body.replace('{price}', trialPrice) : board.countInFallbackBody,
        }
      : item,
  );
}
```

The comment block above it stays as written — it is the provenance note for these four cards and the record of the 2026-08-08 refund correction.

- [ ] **Step 2: Bind the board and the labels**

Insert immediately **below** the anchor line `  const batches = pickBoard(content);`:

```tsx
  const board = content.pages.home.board;
```

Confirm the file imports `label`: `grep -n "from '@/lib/labels'" src/components/QuickEnroll.tsx`. Plan 1 added it; if it is missing, add `import { label } from '@/lib/labels';` beside the other `@/lib` imports.

- [ ] **Step 3: Replace the literals**

Each row is anchored on its own text. Where Plan 1 already applied a replacement, follow R1a and skip.

| anchor (text before this task) | replacement |
|---|---|
| `                Booking open` | `                {label(content.labels, 'badgeBookingOpen')}` |
| `            <p className="text-sm text-cream/70">Book in ~30 seconds</p>` | `            <p className="text-sm text-cream/70">{board.speed}</p>` |
| `            Start dancing <span className="accent">this week.</span>` | `            {board.headline} <span className="accent">{board.headlineAccent}</span>` |
| `                              Foundation · start here` | `                              {label(content.labels, 'badgeFoundationStartHere')}` |
| `                          No partner, no experience needed.` | `                          {board.spotlitNote}` |
| `                          For dancers with the basics down.` | `                          {board.higherLevelNote}` |
| `                        <p className="text-cream/60">Starts {formatBatchDate(b.startDate)}</p>` | `                        <p className="text-cream/60">{board.startsTemplate.replace('{date}', formatBatchDate(b.startDate))}</p>` |
| `                          …and on the 1, you&apos;re dancing.` | `                          {board.resolveLine}` |
| `                  Not sure which? Take the 30-second style finder →` | `                  {board.styleFinderLink}` |
| `                    Danced before? Intermediate &amp; Advanced →` | `                    {board.advancedLink}` |
| `                    See all batches &amp; prices` | `                    {board.allBatchesLink}` |
| `                <p className="display text-lg font-bold">New batches drop every week.</p>` | `                <p className="display text-lg font-bold">{label(content.labels, 'emptyNewBatchesTitle')}</p>` |

Six replacements span more than one line and are written out in full.

The lead paragraph (anchor: `            {trialFrom != null`):

```tsx
          <p className="mt-1 text-cream/65 max-w-2xl">
            {trialFrom != null
              ? board.leadWithPrice.replace('{price}', formatInr(trialFrom))
              : board.leadNoPrice}
          </p>
```

The two price lines (anchor: `                          Trial class {formatInr(b.reservationInr)}`):

```tsx
                      <div className="relative mt-3">
                        <p className="text-cream font-semibold">
                          {board.trialPrice.replace('{price}', formatInr(b.reservationInr))}
                        </p>
                        <p className="text-xs text-cream/60">
                          {board.fullProgram.replace('{price}', formatInr(b.priceInr))}
                        </p>
                      </div>
```

The seats-left line (anchor: `                          ● {b.seatsLeft} seat{b.seatsLeft === 1 ? '' : 's'} left`):

```tsx
                        <p className="relative mt-3 text-xs font-semibold text-ember-400">
                          {(b.seatsLeft === 1 ? board.seatsLeftOne : board.seatsLeftMany).replace(
                            '{n}',
                            String(b.seatsLeft),
                          )}
                        </p>
```

The count-in call (anchor: `                  {countIn(trialFrom != null ? formatInr(trialFrom) : null).map((item) => (`):

```tsx
                  {countIn(board, trialFrom != null ? formatInr(trialFrom) : null).map((item) => (
```

The testimonial caption (anchor: `                    {proofStyle ? `, ${proofStyle} student` : ''}`):

```tsx
                    {proofStyle ? board.proofSuffix.replace('{style}', proofStyle) : ''}
```

The empty-state body and its WhatsApp note (anchor: `                  Tell us your style — we&apos;ll hold you a seat in the next one.`):

```tsx
                <p className="mt-1 text-sm text-cream/65">
                  {label(content.labels, 'emptyNewBatchesBody')}
                </p>
```

and (anchor: `                    'Hi! I want to join a dance batch — please let me know the next start dates.',`):

```tsx
                  customNote: board.emptyNote,
```
— replacing the two-line `customNote:` entry, so the `ctx` object reads `{ source: 'primary', customNote: board.emptyNote }`.

- [ ] **Step 4: Verify the board is unchanged**

Run `npm run typecheck` — expected silent, exit 0.

Run `npm run dev`, open `http://localhost:3000/` at a **375px** viewport:

1. The board reads exactly as before: the badge, `Book in ~30 seconds`, `Start dancing this week.` with `this week.` in the accent colour, the lead with the live trial price, four cards, the count-in strip 5-6-7-8, and `…and on the 1, you're dancing.` right-aligned.
2. Card 8's body contains the live trial price, not the literal `{price}`:
   ```js
   [...document.querySelectorAll('#start-this-week p')].some((p) => p.textContent.includes('{price}'))
   ```
   Expected: `false`.
3. No pill clips and no empty control:
   ```js
   ({ clipped: [...document.querySelectorAll('#start-this-week .pill')].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      empty: [...document.querySelectorAll('#start-this-week a, #start-this-week button')].filter((e) => !e.textContent.trim() && !e.getAttribute('aria-label')).length })
   ```
   Expected: `{ clipped: 0, empty: 0 }`.
4. Temporarily set a batch's `seatsLeft` to `1` in `/admin/batches`, save, reload `/`, and confirm the card reads `● 1 seat left` — singular. Set it back afterwards.

- [ ] **Step 5: Full suite and seed check**

Run: `npx vitest run && npm run sync-seed -- --check`
Expected: `Tests T0 + 51 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 6: Commit**
```bash
git add src/components/QuickEnroll.tsx
git commit -m "feat: booking board renders pages.home.board instead of hardcoded copy"
```

---

### Task 13: the booking-board panel in `/admin/pages/home`

**Files:**
- Modify: `src/app/admin/pages/home/HomePageEditor.tsx` (anchors: `  const h = c.pages.home;` — the new patchers go above it; `        <Section title="What we teach (dance-styles section header)">` — the new panel goes above it)
- Test: none. **This task ships with no automated regression cover**; Step 3 is the concrete manual check.

**Interfaces:**
- Consumes: `Field` from `@/components/admin/fields`, the file's local `Section`, `CharCount` and `PILL_CHAR_LIMIT` (Plan 1).
- Produces: nothing.

The `countIn` list is a real add / remove / edit list, written out below — not "follow the `howItWorks.steps` pattern". It differs from that pattern in one way that matters: a count-in card carries a `count` glyph as well as a title and body, and a new card is seeded with the next number in the sequence so the strip keeps reading 5-6-7-8.

- [ ] **Step 1: Add the patchers**

In `src/app/admin/pages/home/HomePageEditor.tsx`, insert immediately **above** the anchor line `  const h = c.pages.home;`:

```tsx
  type Board = HomePage['board'];
  type BoardKey = keyof Board;

  function patchBoard(patch: Partial<Board>) {
    setC((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        home: { ...prev.pages.home, board: { ...prev.pages.home.board, ...patch } },
      },
    }));
    setDirty(true);
  }

  function patchCountIn(i: number, patch: { count?: string; title?: string; body?: string }) {
    patchBoard({
      countIn: c.pages.home.board.countIn.map((item, j) => (j === i ? { ...item, ...patch } : item)),
    });
  }
```

Add the two imports beneath the existing `import { saveSiteContent } from '@/lib/admin-save';`:

```tsx
import { CharCount } from '@/components/admin/CharCount';
import { PILL_CHAR_LIMIT } from '@/lib/labels';
```

- [ ] **Step 2: Add the panel**

Insert immediately **above** the anchor line `        <Section title="What we teach (dance-styles section header)">` — the board is the first thing on the page, so it should be the first panel in the editor too:

```tsx
        <Section title="Booking board (the card over the hero)">
          <p className="-mt-1 text-xs text-cream/50">
            The first thing a visitor sees. Words in <code>{'{braces}'}</code> are filled in from
            live batch data — <code>{'{price}'}</code> is the trial fee, <code>{'{date}'}</code> the
            start date, <code>{'{n}'}</code> a count. Never type a rupee amount by hand: it would
            be wrong the day you change a deposit.
          </p>
          <Field label="Speed line" hint="The small grey line to the right of the “Booking open” badge.">
            <input
              value={h.board.speed}
              onChange={(e) => patchBoard({ speed: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Headline">
              <input
                value={h.board.headline}
                onChange={(e) => patchBoard({ headline: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Headline — highlighted tail" hint="Shown in the accent colour.">
              <input
                value={h.board.headlineAccent}
                onChange={(e) => patchBoard({ headlineAccent: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Lead — when a trial price is known" hint="Use {price}.">
            <textarea
              rows={2}
              value={h.board.leadWithPrice}
              onChange={(e) => patchBoard({ leadWithPrice: e.target.value })}
              className="input"
            />
          </Field>
          <Field
            label="Lead — when no batch has a price yet"
            hint="Shown instead of the line above when there is nothing bookable."
          >
            <textarea
              rows={2}
              value={h.board.leadNoPrice}
              onChange={(e) => patchBoard({ leadNoPrice: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Note on the spotlit beginner card">
              <input
                value={h.board.spotlitNote}
                onChange={(e) => patchBoard({ spotlitNote: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Note on a higher-level card">
              <input
                value={h.board.higherLevelNote}
                onChange={(e) => patchBoard({ higherLevelNote: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Start date line" hint="Use {date}.">
              <input
                value={h.board.startsTemplate}
                onChange={(e) => patchBoard({ startsTemplate: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Trial price line" hint="Use {price}.">
              <input
                value={h.board.trialPrice}
                onChange={(e) => patchBoard({ trialPrice: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Full-program line" hint="Use {price}.">
              <input
                value={h.board.fullProgram}
                onChange={(e) => patchBoard({ fullProgram: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Seats left — exactly one" hint="Use {n}. Kept separate so it never reads “1 seats”.">
              <input
                value={h.board.seatsLeftOne}
                onChange={(e) => patchBoard({ seatsLeftOne: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Seats left — more than one" hint="Use {n}.">
              <input
                value={h.board.seatsLeftMany}
                onChange={(e) => patchBoard({ seatsLeftMany: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-cream/10 bg-ink-950/40 p-4 grid gap-3">
            <p className="text-xs uppercase tracking-widest text-cream/60">
              The count-in strip under the cards
            </p>
            <p className="-mt-1 text-xs text-cream/50">
              The questions a first-timer is actually asking, answered where they decide. One card
              may use <code>{'{price}'}</code>. Do not promise money back — the paid trial is
              non-refundable.
            </p>
            {h.board.countIn.map((item, i) => (
              <div key={i} className="rounded-lg border border-cream/10 bg-ink-900/40 p-3 grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-widest text-cream/50">Card {i + 1}</p>
                  <button
                    type="button"
                    onClick={() =>
                      patchBoard({ countIn: h.board.countIn.filter((_, j) => j !== i) })
                    }
                    className="text-xs text-cream/40 hover:text-ember-400"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
                  <Field label="Count" hint="The big faint number.">
                    <input
                      value={item.count}
                      onChange={(e) => patchCountIn(i, { count: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Title">
                    <input
                      value={item.title}
                      onChange={(e) => patchCountIn(i, { title: e.target.value })}
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="Body">
                  <textarea
                    rows={2}
                    value={item.body}
                    onChange={(e) => patchCountIn(i, { body: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
            ))}
            <div>
              <button
                type="button"
                onClick={() =>
                  patchBoard({
                    countIn: [
                      ...h.board.countIn,
                      {
                        // Keep the strip counting: the next card takes the next
                        // number, so 5-6-7-8 stays 5-6-7-8-9 rather than
                        // restarting at a blank.
                        count: String(
                          (Number(h.board.countIn[h.board.countIn.length - 1]?.count) || 4) + 1,
                        ),
                        title: '',
                        body: '',
                      },
                    ],
                  })
                }
                className="text-sm text-ember-400 hover:text-ember-300"
              >
                + Add card
              </button>
            </div>
            <Field
              label="Fallback body when no trial price is known"
              hint="Replaces whichever card uses {price} if there is no bookable batch."
            >
              <textarea
                rows={2}
                value={h.board.countInFallbackBody}
                onChange={(e) => patchBoard({ countInFallbackBody: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <Field label="Resolve line" hint="The right-aligned line that closes the strip.">
            <input
              value={h.board.resolveLine}
              onChange={(e) => patchBoard({ resolveLine: e.target.value })}
              className="input"
            />
          </Field>
          <Field
            label="Testimonial suffix"
            hint="Appended after the student's name. Use {style} for their dance style."
          >
            <input
              value={h.board.proofSuffix}
              onChange={(e) => patchBoard({ proofSuffix: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Style-finder link">
              <input
                value={h.board.styleFinderLink}
                onChange={(e) => patchBoard({ styleFinderLink: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Experienced-dancer link">
              <input
                value={h.board.advancedLink}
                onChange={(e) => patchBoard({ advancedLink: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="All-batches button">
              <input
                value={h.board.allBatchesLink}
                onChange={(e) => patchBoard({ allBatchesLink: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field
            label="WhatsApp message when nothing is bookable"
            hint="What we type into WhatsApp for a visitor when the board is empty."
          >
            <textarea
              rows={2}
              value={h.board.emptyNote}
              onChange={(e) => patchBoard({ emptyNote: e.target.value })}
              className="input"
            />
          </Field>
        </Section>
```

`CharCount` and `PILL_CHAR_LIMIT` are imported but unused in this panel on purpose: **no board field renders into a `.pill`.** The two pill-bound strings on this surface — `badgeBookingOpen` and `badgeFoundationStartHere` — live in the label bag and already carry their hint on `/admin/labels`. Task 14 uses both imports for `nextBatches.seatsLeft`, which does render into a pill; if you are landing Task 13 alone, add the imports there instead of here so nothing is left dangling.

- [ ] **Step 3: Verify in the browser**

Run `npm run dev`, open `http://localhost:3000/admin/pages/home`.

1. "Booking board (the card over the hero)" is the first panel, above "What we teach".
2. It has 20 top-level boxes plus 3 per count-in card (4 cards) = **32 inputs in that panel**:
   ```js
   document.querySelectorAll('.grid > div')[0] && [...document.querySelectorAll('input.input, textarea.input')].length
   ```
   Count the panel's own inputs by eye against the list above; the whole-page total also grows by 32.
3. Press **+ Add card**. A fifth card appears with Count pre-filled as `9`. Press **Remove** on it and confirm the list returns to four.
4. Change "Speed line" to `Book in under a minute` and save. Open `/` and confirm the line above the headline changed. Change it back and save.
5. Change count-in card 4's body to remove `{price}` entirely, save, reload `/`, and confirm the card renders your literal text with no `{price}` left over. Restore the original body and save.

- [ ] **Step 4: Typecheck, full suite, seed check**

Run: `npm run typecheck && npx vitest run && npm run sync-seed -- --check`
Expected: typecheck silent; `Tests T0 + 51 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 5: Commit**
```bash
git add src/app/admin/pages/home/HomePageEditor.tsx
git commit -m "feat: edit the booking board's copy and count-in cards in /admin/pages/home"
```

---

### Task 14: the home page's studio cards, next-batch strip and Why-Furor eyebrow

**Files:**
- Modify: `src/lib/content-schema.ts` (anchors: `    nextBatches: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),` and `    visitUs: z`)
- Modify: `src/app/page.tsx` (anchors listed per edit)
- Modify: `src/app/admin/pages/home/HomePageEditor.tsx` (anchors: `        <Section title="Next batches section header">` and `        <Section title="Visit us section">`)
- Test: `src/lib/content-schema.test.ts` (append)

**Interfaces:**
- Consumes: `label` from `@/lib/labels` (Plan 1).
- Produces: `pages.home.visitUs.{addressLabel,hoursLabel,parkingLabel,teachHereLabel,callTemplate,mapTitle,photoAlt}`, `pages.home.nextBatches.{starts,seatsLeft,combinedSuffix}`, `pages.home.whyFurorEyebrow`.

Eleven new fields plus six label-bag consumptions finish `page.tsx`'s thirteen strings. `Address` / `Hours` / `Parking` each appear at two render sites and `Get directions` at two more — the latter is already `ctaGetDirections` in Plan 1's bag, so only the four heading words need a home of their own.

Plan 2 rewrote the hero above this markup and Plan 3 restructured the next-batch strip below it, so every edit here is text-anchored (R1) and any already-applied one is skipped per R1a.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/content-schema.test.ts`:

```ts
describe('pages.home visit-us, next-batches and Why Furor', () => {
  const h = () => doc().pages.home;

  it('ships the four studio-card headings', () => {
    expect(h().visitUs.addressLabel).toBe('Address');
    expect(h().visitUs.hoursLabel).toBe('Hours');
    expect(h().visitUs.parkingLabel).toBe('Parking');
    expect(h().visitUs.teachHereLabel).toBe('What we teach here');
  });

  // Derived from records, never hand-typed: a studio's phone number, name and
  // photo caption all come from the studio record, so the editable part is the
  // sentence around them and nothing else.
  it('ships the derived strings as templates, never as prose', () => {
    expect(h().visitUs.callTemplate).toBe('Call {phone}');
    expect(h().visitUs.mapTitle).toBe('Map to {studio}');
    expect(h().visitUs.photoAlt).toBe('Inside {studio}');
    expect(h().nextBatches.starts).toBe('Starts {date} · {price}');
    expect(h().nextBatches.seatsLeft).toBe('{n} seats left');
    expect(h().nextBatches.combinedSuffix).toBe(' · taught together');
  });

  it('keeps the next-batches header fields and adds the Why Furor eyebrow', () => {
    expect(h().nextBatches.eyebrow).toBe('Next batches');
    expect(h().nextBatches.headline).toBe('Doors open. Pick a date.');
    expect(h().whyFurorEyebrow).toBe('Why Furor');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — `AssertionError: expected undefined to be 'Address'` on the first new case.

- [ ] **Step 3: Extend the schema**

In `src/lib/content-schema.ts`, inside `HomePageSchema`, replace the anchor line `    nextBatches: SectionHeaderSchema.default({ eyebrow: '', headline: '' }),` with:

```ts
    // Was a bare SectionHeaderSchema; the eyebrow and headline keep their exact
    // shape and their stored values, and the three card templates join them.
    nextBatches: z
      .object({
        eyebrow: z.string().default(''),
        headline: z.string().default(''),
        starts: z.string().default('Starts {date} · {price}'),
        /** Renders inside a .pill — keep it short. */
        seatsLeft: z.string().default('{n} seats left'),
        /** Appended after the studio name when one batch teaches two styles. */
        combinedSuffix: z.string().default(' · taught together'),
      })
      .default({}),
```

Then replace the whole `visitUs` block (anchor: `    visitUs: z`) with:

```ts
    visitUs: z
      .object({
        eyebrow: z.string().default(''),
        headlineTemplate: z.string().default('Find us in {neighborhood}, Hyderabad.'),
        // The four card headings. Address / Hours / Parking each render at two
        // sites on this page, which is why they get one field rather than two.
        addressLabel: z.string().default('Address'),
        hoursLabel: z.string().default('Hours'),
        parkingLabel: z.string().default('Parking'),
        teachHereLabel: z.string().default('What we teach here'),
        // Templates, not prose: the phone number, the studio name and the photo
        // caption are all filled from the studio record, so hand-typed copy can
        // never disagree with it. This is the same rule the confirmation page's
        // contact block follows, and for the same reason.
        callTemplate: z.string().default('Call {phone}'),
        mapTitle: z.string().default('Map to {studio}'),
        photoAlt: z.string().default('Inside {studio}'),
      })
      .default({}),
    /** The eyebrow above the Why Furor block. Its headline and points already
     *  live in whyFuror, which /admin/site owns; only this word was stranded. */
    whyFurorEyebrow: z.string().default('Why Furor'),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: PASS — 3 more cases than after Task 11 (16 new in this file so far).

- [ ] **Step 5: Wire `src/app/page.tsx`**

Confirm the file imports `label`: `grep -n "from '@/lib/labels'" src/app/page.tsx`. Plan 1 added it for the closing-CTA chat link; if it is missing, add `import { label } from '@/lib/labels';`.

Each row is anchored on its own text. Where Plan 1 already applied a label-bag replacement, follow R1a and skip.

| anchor (text before this task) | replacement |
|---|---|
| `              All styles` | `              {label(content.labels, 'ctaAllStyles')}` |
| `                  Explore →` | `                  {label(content.labels, 'ctaExplore')}` |
| `              See all batches` | `              {label(content.labels, 'ctaSeeAllBatches')}` |
| `                      {combined ? ' · taught together' : ''}` | `                      {combined ? h.nextBatches.combinedSuffix : ''}` |
| `                      Next {s.name} batch coming soon.` | `                      {label(content.labels, 'emptyNextBatchSoon').replace('{style}', s.name)}` |
| `                        label="Notify me on WhatsApp"` | `                        label={label(content.labels, 'ctaNotifyWhatsapp')}` |
| `              <p className="display text-sm uppercase tracking-widest text-ember-400">Why Furor</p>` | `              <p className="display text-sm uppercase tracking-widest text-ember-400">{h.whyFurorEyebrow}</p>` |
| `                          <p className="text-xs uppercase tracking-widest text-cream/70">Address</p>` | `                          <p className="text-xs uppercase tracking-widest text-cream/70">{h.visitUs.addressLabel}</p>` |
| `                          <p className="text-xs uppercase tracking-widest text-cream/70">Hours</p>` | `                          <p className="text-xs uppercase tracking-widest text-cream/70">{h.visitUs.hoursLabel}</p>` |
| `                            <p className="text-xs uppercase tracking-widest text-cream/70">Parking</p>` | `                            <p className="text-xs uppercase tracking-widest text-cream/70">{h.visitUs.parkingLabel}</p>` |
| `                            <p className="text-xs uppercase tracking-widest text-cream/70">What we teach here</p>` | `                            <p className="text-xs uppercase tracking-widest text-cream/70">{h.visitUs.teachHereLabel}</p>` |
| `                          Get directions` | `                          {label(content.labels, 'ctaGetDirections')}` |
| `                        <a href={\`tel:${tel}\`} className="btn-secondary">Call {s.telephone}</a>` | `                        <a href={\`tel:${tel}\`} className="btn-secondary">{h.visitUs.callTemplate.replace('{phone}', s.telephone)}</a>` |
| `                        title={\`Map to ${s.name}\`}` | `                        title={h.visitUs.mapTitle.replace('{studio}', s.name)}` |
| `                            alt={\`Inside ${s.name}\`}` | `                            alt={h.visitUs.photoAlt.replace('{studio}', s.name)}` |

Two replacements span more than one line and are written out in full.

The start-date line (anchor: `                      Starts {formatBatchDate(b.startDate)} · {formatInr(b.priceInr)}`):

```tsx
                    <p className="text-sm text-cream/60 mt-1">
                      {h.nextBatches.starts
                        .replace('{date}', formatBatchDate(b.startDate))
                        .replace('{price}', formatInr(b.priceInr))}
                    </p>
```

The seats pill (anchor: `                        {b.seatsLeft} seats left`):

```tsx
                      <p className="pill mt-3 bg-gold-500/15 text-gold-400">
                        {h.nextBatches.seatsLeft.replace('{n}', String(b.seatsLeft))}
                      </p>
```

- [ ] **Step 6: Add the admin fields**

In `src/app/admin/pages/home/HomePageEditor.tsx`, add the two imports if Task 13 did not already (they are used here):

```tsx
import { CharCount } from '@/components/admin/CharCount';
import { PILL_CHAR_LIMIT } from '@/lib/labels';
```

Replace the whole `<Section title="Next batches section header">…</Section>` block (anchor: `        <Section title="Next batches section header">`) with:

```tsx
        <Section title="Next batches strip">
          <Field label="Eyebrow">
            <input
              value={h.nextBatches.eyebrow}
              onChange={(e) =>
                patchHome({ nextBatches: { ...h.nextBatches, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={h.nextBatches.headline}
              onChange={(e) =>
                patchHome({ nextBatches: { ...h.nextBatches, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Start date + price line" hint="Use {date} and {price}.">
            <input
              value={h.nextBatches.starts}
              onChange={(e) =>
                patchHome({ nextBatches: { ...h.nextBatches, starts: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Seats-left chip" hint="Use {n} for the number of seats.">
            <input
              value={h.nextBatches.seatsLeft}
              onChange={(e) =>
                patchHome({ nextBatches: { ...h.nextBatches, seatsLeft: e.target.value } })
              }
              className="input"
            />
            <CharCount
              text={h.nextBatches.seatsLeft}
              max={PILL_CHAR_LIMIT}
              note="shown in a small rounded chip — longer text gets cut off on phones"
            />
          </Field>
          <Field
            label="Combined-styles suffix"
            hint="Added after the studio name when one batch teaches two dances. Keep the leading separator."
          >
            <input
              value={h.nextBatches.combinedSuffix}
              onChange={(e) =>
                patchHome({ nextBatches: { ...h.nextBatches, combinedSuffix: e.target.value } })
              }
              className="input"
            />
          </Field>
        </Section>
```

Replace the whole `<Section title="Visit us section">…</Section>` block (anchor: `        <Section title="Visit us section">`) with:

```tsx
        <Section title="Visit us section">
          <p className="-mt-1 text-xs text-cream/50">
            The studio cards near the bottom of the home page. The address, hours, parking note,
            phone number and photos all come from each studio's own record under Studios — these
            are the words around them.
          </p>
          <Field label="Eyebrow">
            <input
              value={h.visitUs.eyebrow}
              onChange={(e) => patchHome({ visitUs: { ...h.visitUs, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field
            label="Headline template"
            hint='Use {neighborhood} — replaced with the studio neighbourhood, e.g. "Find us in {neighborhood}, Hyderabad."'
          >
            <input
              value={h.visitUs.headlineTemplate}
              onChange={(e) =>
                patchHome({ visitUs: { ...h.visitUs, headlineTemplate: e.target.value } })
              }
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="“Address” heading">
              <input
                value={h.visitUs.addressLabel}
                onChange={(e) =>
                  patchHome({ visitUs: { ...h.visitUs, addressLabel: e.target.value } })
                }
                className="input"
              />
            </Field>
            <Field label="“Hours” heading">
              <input
                value={h.visitUs.hoursLabel}
                onChange={(e) =>
                  patchHome({ visitUs: { ...h.visitUs, hoursLabel: e.target.value } })
                }
                className="input"
              />
            </Field>
            <Field label="“Parking” heading">
              <input
                value={h.visitUs.parkingLabel}
                onChange={(e) =>
                  patchHome({ visitUs: { ...h.visitUs, parkingLabel: e.target.value } })
                }
                className="input"
              />
            </Field>
            <Field label="“What we teach here” heading">
              <input
                value={h.visitUs.teachHereLabel}
                onChange={(e) =>
                  patchHome({ visitUs: { ...h.visitUs, teachHereLabel: e.target.value } })
                }
                className="input"
              />
            </Field>
          </div>
          <Field label="Call button" hint="Use {phone} — filled from the studio's own number.">
            <input
              value={h.visitUs.callTemplate}
              onChange={(e) =>
                patchHome({ visitUs: { ...h.visitUs, callTemplate: e.target.value } })
              }
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Map frame title" hint="Read aloud by screen readers. Use {studio}.">
              <input
                value={h.visitUs.mapTitle}
                onChange={(e) => patchHome({ visitUs: { ...h.visitUs, mapTitle: e.target.value } })}
                className="input"
              />
            </Field>
            <Field label="Studio photo description" hint="Image alt text. Use {studio}.">
              <input
                value={h.visitUs.photoAlt}
                onChange={(e) => patchHome({ visitUs: { ...h.visitUs, photoAlt: e.target.value } })}
                className="input"
              />
            </Field>
          </div>
          <Field label="“Why Furor” eyebrow" hint="The small label above the three-point block.">
            <input
              value={h.whyFurorEyebrow}
              onChange={(e) => patchHome({ whyFurorEyebrow: e.target.value })}
              className="input"
            />
          </Field>
        </Section>
```

- [ ] **Step 7: Verify the home page is unchanged**

Run `npm run typecheck` — expected silent, exit 0.

Run `npm run dev`, open `http://localhost:3000/` at a **375px** viewport:

1. The studio card still reads `Address` / `Hours` / `Parking` / `What we teach here`, and the call button still reads `Call +91 …` with the studio's real number.
2. The map iframe still carries its title:
   ```js
   [...document.querySelectorAll('iframe')].map((f) => f.title)
   ```
   Expected: one entry per studio, each `Map to <studio name>`.
3. The studio photos still carry alt text:
   ```js
   [...document.querySelectorAll('#visit img')].map((i) => i.alt).filter(Boolean).length
   ```
   Expected: equal to the number of studio photos rendered (3 per studio, capped at 3).
4. No pill clips in the next-batch strip:
   ```js
   [...document.querySelectorAll('.pill')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim())
   ```
   Expected: `[]`.

- [ ] **Step 8: Full suite and seed check**

Run: `npx vitest run && npm run sync-seed -- --check`
Expected: `Tests T0 + 54 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 9: Commit**
```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts src/app/page.tsx src/app/admin/pages/home/HomePageEditor.tsx
git commit -m "feat: home studio cards and next-batch strip become editable"
```

---

### Task 15: `pages.home.styleFinder` — the finder's eight strings

**Files:**
- Modify: `src/lib/content-schema.ts` (anchor: `    /** The eyebrow above the Why Furor block.` — the new object goes immediately above it)
- Modify: `src/components/StyleFinder.tsx` (anchors listed per edit)
- Modify: `src/app/admin/pages/home/HomePageEditor.tsx` (anchor: `        <Section title="How it works">`)
- Test: `src/lib/content-schema.test.ts` (append)

**Interfaces:**
- Consumes: `label` from `@/lib/labels` (Plan 1).
- Produces: `pages.home.styleFinder.{eyebrow,headline,lead,resetLabel,question,recommendEyebrow,nextBatchLabel,startsTemplate}`.

**What deliberately stays in code:** the two `TRACKS` entries' `id`, `styleSlugs`, `ctaSlug` and `tod` are structural — `findFoundationBatch` keys on them and `DENY_IDS` (`roles.ts`) denies `*.id` and `*.*.id` for every role including owner, so the array cannot move into content as-is. Their `when` / `name` / `tagline` copy is therefore left in code too, rather than splitting one record across two homes. That is six strings this plan does not reach; they are tracked as follow-up, not silently dropped.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/content-schema.test.ts`:

```ts
describe('pages.home.styleFinder', () => {
  const f = () => doc().pages.home.styleFinder;

  it('ships the finder chrome', () => {
    expect(f().eyebrow).toBe('Style Finder');
    expect(f().headline).toBe('Two beginner tracks. Find yours.');
    expect(f().resetLabel).toBe('Reset');
    expect(f().question).toBe('When can you make it?');
    expect(f().recommendEyebrow).toBe('We recommend');
    expect(f().nextBatchLabel).toBe('Next beginner batch');
    expect(f().startsTemplate).toBe('Starts {date} · {price}');
  });

  it('ships the lead exactly as it renders', () => {
    expect(f().lead).toBe(
      'Both are built for first-timers — no experience, no partner needed. Pick the time that suits you and we’ll point you to the next beginner batch.',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'eyebrow')`.

- [ ] **Step 3: Add the schema**

In `src/lib/content-schema.ts`, inside `HomePageSchema`, insert immediately **above** the anchor `    /** The eyebrow above the Why Furor block.`:

```ts
    // The style finder. Its two TRACKS stay in code: their ids key the batch
    // lookup and DENY_IDS blocks *.id / *.*.id for every role including owner,
    // so the array cannot move into content without splitting one record across
    // two homes. The chrome around it is all editable.
    styleFinder: z
      .object({
        eyebrow: z.string().default('Style Finder'),
        headline: z.string().default('Two beginner tracks. Find yours.'),
        lead: z
          .string()
          .default(
            'Both are built for first-timers — no experience, no partner needed. Pick the time that suits you and we’ll point you to the next beginner batch.',
          ),
        resetLabel: z.string().default('Reset'),
        question: z.string().default('When can you make it?'),
        recommendEyebrow: z.string().default('We recommend'),
        nextBatchLabel: z.string().default('Next beginner batch'),
        startsTemplate: z.string().default('Starts {date} · {price}'),
      })
      .default({}),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: PASS — 2 more cases than after Task 14 (18 new in this file so far).

- [ ] **Step 5: Wire `src/components/StyleFinder.tsx`**

Add `import { label } from '@/lib/labels';` beside the existing `@/lib` imports, and bind the object immediately **below** the anchor line `  const reset = () => setTrack(null);`:

```tsx
  const f = content.pages.home.styleFinder;
```

| anchor (text before this task) | replacement |
|---|---|
| `          <p className="display text-sm uppercase tracking-widest text-ember-400">Style Finder</p>` | `          <p className="display text-sm uppercase tracking-widest text-ember-400">{f.eyebrow}</p>` |
| `              Reset` | `              {f.resetLabel}` |
| `        <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">Two beginner tracks. Find yours.</h2>` | `        <h2 className="mt-2 display text-3xl font-bold sm:text-4xl">{f.headline}</h2>` |
| `            <p className="display text-xl">When can you make it?</p>` | `            <p className="display text-xl">{f.question}</p>` |
| `            <p className="display text-sm uppercase tracking-widest text-ember-400">We recommend</p>` | `            <p className="display text-sm uppercase tracking-widest text-ember-400">{f.recommendEyebrow}</p>` |
| `                <p className="text-cream/60 text-xs uppercase tracking-widest">Next beginner batch</p>` | `                <p className="text-cream/60 text-xs uppercase tracking-widest">{f.nextBatchLabel}</p>` |

Three replacements span more than one line and are written out in full.

The lead (anchor: `          Both are built for first-timers — no experience, no partner needed. Pick the time that`):

```tsx
        <p className="mt-2 text-cream/70 max-w-xl">{f.lead}</p>
```

The start-date line (anchor: `                  Starts {formatBatchDate(recommendedBatch.startDate)} ·{' '}`):

```tsx
                <p className="text-cream/70 text-sm">
                  {f.startsTemplate
                    .replace('{date}', formatBatchDate(recommendedBatch.startDate))
                    .replace('{price}', formatInr(recommendedBatch.priceInr))}
                </p>
```

The no-batch fallback (anchor: `                No upcoming {track.name} beginner batch listed yet — chat with us and we’ll tell you`):

```tsx
              <p className="mt-4 text-cream/70">
                {label(content.labels, 'emptyNoFinderBatch').replace('{track}', track.name)}
              </p>
```

- [ ] **Step 6: Add the admin panel**

In `src/app/admin/pages/home/HomePageEditor.tsx`, add a `patchFinder` helper immediately below the `patchCountIn` function added in Task 13:

```tsx
  function patchFinder(patch: Partial<HomePage['styleFinder']>) {
    setC((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        home: {
          ...prev.pages.home,
          styleFinder: { ...prev.pages.home.styleFinder, ...patch },
        },
      },
    }));
    setDirty(true);
  }
```

Then insert this panel immediately **above** the anchor `        <Section title="How it works">`:

```tsx
        <Section title="Style finder">
          <p className="-mt-1 text-xs text-cream/50">
            The two-question picker in the middle of the home page. The two track names and their
            descriptions are fixed in code — they decide which batch the finder looks up — but
            everything around them is yours.
          </p>
          <Field label="Eyebrow">
            <input
              value={h.styleFinder.eyebrow}
              onChange={(e) => patchFinder({ eyebrow: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={h.styleFinder.headline}
              onChange={(e) => patchFinder({ headline: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Lead paragraph">
            <textarea
              rows={3}
              value={h.styleFinder.lead}
              onChange={(e) => patchFinder({ lead: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Question" hint="Shown above the two choices.">
              <input
                value={h.styleFinder.question}
                onChange={(e) => patchFinder({ question: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Reset button">
              <input
                value={h.styleFinder.resetLabel}
                onChange={(e) => patchFinder({ resetLabel: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Result eyebrow" hint="Above the recommended track.">
              <input
                value={h.styleFinder.recommendEyebrow}
                onChange={(e) => patchFinder({ recommendEyebrow: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="“Next beginner batch” heading">
              <input
                value={h.styleFinder.nextBatchLabel}
                onChange={(e) => patchFinder({ nextBatchLabel: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Start date + price line" hint="Use {date} and {price}.">
            <input
              value={h.styleFinder.startsTemplate}
              onChange={(e) => patchFinder({ startsTemplate: e.target.value })}
              className="input"
            />
          </Field>
        </Section>
```

- [ ] **Step 7: Verify in the browser**

Run `npm run typecheck` — expected silent, exit 0.

Run `npm run dev`, open `http://localhost:3000/#style-finder`:

1. The panel reads exactly as before: `Style Finder`, `Two beginner tracks. Find yours.`, the lead, `When can you make it?` and the two options.
2. Pick "Weekend mornings". The result shows `We recommend`, the track name, `Next beginner batch` and a `Starts … · ₹…` line — or, when no Foundation batch is upcoming, the "no upcoming … beginner batch listed yet" sentence with the track name filled in, **not** the literal `{track}`:
   ```js
   document.querySelector('#style-finder').textContent.includes('{track}')
   ```
   Expected: `false`.
3. `Reset` appears and clears the choice.
4. In `/admin/pages/home` → Style finder, change "Reset button" to `Start over`, save, reload `/#style-finder`, pick a track, and confirm the button reads `Start over`. Change it back and save.

- [ ] **Step 8: Full suite and seed check**

Run: `npx vitest run && npm run sync-seed -- --check`
Expected: `Tests T0 + 56 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 9: Commit**
```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts src/components/StyleFinder.tsx src/app/admin/pages/home/HomePageEditor.tsx
git commit -m "feat: style finder copy becomes editable"
```

---

### Task 16: the confirmation page's 11 copy fields

**Files:**
- Modify: `src/lib/content-schema.ts` (anchor: `    seoTitle: z.string().default(''),` inside `WelcomeSchema` — added in Task 1, immediately above `    tracks: z`)
- Modify: `src/app/welcome/[track]/WelcomeView.tsx` (anchors listed per edit)
- Modify: `src/components/admin/WelcomePageEditor.tsx` (anchors: `        <Section title="Payment not confirmed">` and `        <Section title="Intake details">`)
- Test: `src/lib/content-schema.test.ts` (append)

**Interfaces:**
- Consumes: `WelcomeView`'s existing `copy: Welcome` prop and its local `Filled` component.
- Produces: 11 new `welcome.*` fields. It does **not** touch `welcome.tracks[]` — Plan 3 owns `noteHeadline` / `noteBody` there, and the two sets of additions are disjoint.

**There is no `welcome.whereHeading`.** The "Where" heading already has exactly one editable home: Plan 1 ships `welcomeWhereHeading` (default `Where`) in the label bag and Plan 3 renders it as `label(labels, 'welcomeWhereHeading')`. Adding a `welcome.whereHeading` here would give one visitor-facing string two admin controls in two different screens, one of which would silently do nothing. The eleven fields below are the ones with no home yet.

Plan 3 rewrote the **Where** cell of the intake grid to add the derived contact block. This task therefore wires the ten fields that live outside that cell and adds all eleven to the schema and the editor; Task 17 wires the one remaining literal inside that cell (`noVenueNote`) into the markup Plan 3 actually shipped. **Do not touch any existing `label(labels, …)` call in this file** — those are Plan 3's, they are already editable, and replacing them would be a regression in the direction of *less* editable copy.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/content-schema.test.ts`:

```ts
describe('welcome page copy', () => {
  const w = () => doc().welcome;

  it('ships the unconfirmed-state actions', () => {
    expect(w().unconfirmedCta).toBe('Message us on WhatsApp');
    expect(w().tryAgainLabel).toBe('Try again');
    expect(w().referenceLabel).toBe('Reference: {id}');
  });

  it('ships the confirmed-state actions', () => {
    expect(w().paymentReferenceLabel).toBe('Payment reference: {id}');
    expect(w().gcalLabel).toBe('Google Calendar');
    expect(w().icsLabel).toBe('Apple / Outlook (.ics)');
  });

  // The honest fallbacks. A paying customer whose batch has no date or venue
  // yet must be told so, not shown a blank cell.
  // No whereHeading here on purpose — that heading is Plan 1's
  // labels.welcomeWhereHeading, already rendered by Plan 3. One string, one home.
  it('ships the intake headings and their honest fallbacks', () => {
    expect(w().whenHeading).toBe('When');
    expect(w().noVenueNote).toBe('We’ll share the exact address on WhatsApp.');
    expect(w().noDateNote).toBe(
      'We’ll confirm the exact date on WhatsApp and send you a reminder.',
    );
  });

  it('ships the two intake templates with their placeholders', () => {
    expect(w().whenEvery).toBe('Every {days}');
    expect(w().arriveByNote).toBe('Please arrive by {time} for registration.');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: FAIL — `AssertionError: expected undefined to be 'Message us on WhatsApp'`.

- [ ] **Step 3: Add the fields**

In `src/lib/content-schema.ts`, inside `WelcomeSchema`, insert immediately **below** the `seoTitle` field Task 1 added (anchor: `    seoTitle: z.string().default(''),` — the one inside `WelcomeSchema`, directly above `    tracks: z`):

```ts
    // Payment-not-confirmed actions
    unconfirmedCta: z.string().default('Message us on WhatsApp'),
    tryAgainLabel: z.string().default('Try again'),
    referenceLabel: z.string().default('Reference: {id}'),
    // Confirmed-state actions
    paymentReferenceLabel: z.string().default('Payment reference: {id}'),
    gcalLabel: z.string().default('Google Calendar'),
    icsLabel: z.string().default('Apple / Outlook (.ics)'),
    // Intake grid. The headings are copy; the venue, days, time and arrival
    // time inside them are derived from the batch and studio records, so the
    // studio can say anything warm it likes and still cannot make the address
    // or the date wrong. The "Where" heading is NOT here — it is Plan 1's
    // labels.welcomeWhereHeading, which Plan 3 already renders.
    whenHeading: z.string().default('When'),
    noVenueNote: z.string().default('We’ll share the exact address on WhatsApp.'),
    noDateNote: z
      .string()
      .default('We’ll confirm the exact date on WhatsApp and send you a reminder.'),
    whenEvery: z.string().default('Every {days}'),
    arriveByNote: z.string().default('Please arrive by {time} for registration.'),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/content-schema.test.ts`
Expected: PASS — 4 more cases than after Task 15 (22 new in this file so far).

- [ ] **Step 5: Wire `WelcomeView.tsx`**

Ten edits, each anchored on its own text. The `Filled` component already in this file substitutes `{placeholders}` and wraps each value in `<span className="font-semibold text-cream">` unless told otherwise — use it where the value is styled today, and `.replace()` where it is plain, so the rendered result is identical either way.

| anchor (text before this task) | replacement |
|---|---|
| `              Message us on WhatsApp` | `              {copy.unconfirmedCta}` |
| `              Try again` | `              {copy.tryAgainLabel}` |
| `            <p className="mt-6 text-xs text-cream/40">Reference: {paymentId}</p>` | `            <p className="mt-6 text-xs text-cream/40">{copy.referenceLabel.replace('{id}', paymentId)}</p>` |
| `                    Google Calendar` | `                    {copy.gcalLabel}` |
| `                    Apple / Outlook (.ics)` | `                    {copy.icsLabel}` |
| `              <p className="text-xs uppercase tracking-widest text-cream/70">When</p>` | `              <p className="text-xs uppercase tracking-widest text-cream/70">{copy.whenHeading}</p>` |

Four replacements span more than one line and are written out in full.

The payment reference chip (anchor: `              Payment reference: <span className="text-cream/80">{paymentId}</span>`):

```tsx
            <p className="mt-5 inline-block rounded-full border border-cream/10 bg-ink-900/50 px-4 py-1.5 text-xs text-cream/70">
              <Filled
                template={copy.paymentReferenceLabel}
                vars={{ id: paymentId }}
                classNames={{ id: 'text-cream/80' }}
              />
            </p>
```

The no-date note (anchor: `                We’ll confirm the exact date on WhatsApp and send you a reminder.`):

```tsx
              <p className="mt-5 text-sm text-cream/70">{copy.noDateNote}</p>
```

The "Every <days>" line (anchor: `                Every <span className="font-semibold text-cream">{whenDays}</span>`). `Filled`'s default class is exactly `font-semibold text-cream`, so this renders identically:

```tsx
              <p className="mt-2 leading-relaxed text-cream/85">
                <Filled template={copy.whenEvery} vars={{ days: whenDays }} />
                <br />
                {whenTime}
              </p>
```

The arrival note (anchor: `                Please arrive by {arriveBy} for registration.`):

```tsx
              <p className="mt-2 text-sm text-cream/60">
                {copy.arriveByNote.replace('{time}', arriveBy)}
              </p>
```

- [ ] **Step 6: Add the eleven admin fields**

`src/components/admin/WelcomePageEditor.tsx` already has `txt(label, key, hint)` and `area(label, key, hint)` helpers that bind straight to a `Welcome` key — use them.

Insert this `Section` immediately **above** the anchor `        <Section title="Tracks (post-payment pages)">`, so the new blocks sit after the existing copy sections and before the per-track list:

```tsx
        <Section title="Buttons & references">
          {txt('Search / tab title', 'seoTitle', 'Leave empty to keep “You’re in — Furor Hyderabad”.')}
          {txt('Google Calendar button', 'gcalLabel')}
          {txt('Apple / Outlook button', 'icsLabel')}
          {txt(
            'Payment reference line',
            'paymentReferenceLabel',
            'Shown under the headline once payment is confirmed. Use {id}.',
          )}
        </Section>

        <Section title="Intake details — headings and fallbacks">
          <p className="-mt-1 text-xs text-cream/50">
            The venue, days, times and arrival time are filled in automatically from the batch and
            the studio. These are the words around them, and what we say when a batch has no venue
            or date yet. (The “Where” heading itself lives in Labels.)
          </p>
          {area(
            'When there is no venue yet',
            'noVenueNote',
            'Shown instead of the address when the batch has no studio set.',
          )}
          {txt('“When” heading', 'whenHeading')}
          {txt('Days line', 'whenEvery', 'Use {days} — e.g. “Every Saturday & Sunday”.')}
          {txt('Arrival note', 'arriveByNote', 'Use {time} for the arrive-by time.')}
          {area(
            'When there is no date yet',
            'noDateNote',
            'Shown instead of the calendar buttons when no upcoming batch date is set.',
          )}
        </Section>
```

Then extend the existing "Payment not confirmed" section — insert these three lines immediately **below** its `{area('Body', 'unconfirmedBody', 'Use {trackLabel}.')}` line:

```tsx
          {txt('WhatsApp button', 'unconfirmedCta')}
          {txt('Try-again button', 'tryAgainLabel')}
          {txt('Reference line', 'referenceLabel', 'Use {id} for the payment reference.')}
```

- [ ] **Step 7: Verify both states in the browser**

Run `npm run typecheck` — expected silent, exit 0.

Run `npm run dev`, then:

1. Open `http://localhost:3000/welcome/latin`. The confirmed page reads exactly as before: the badge, headline, reminder, the two step cards with `Google Calendar` / `Apple / Outlook (.ics)` (or the no-date note), and the intake grid with `Where` / `When` / `What to wear & bring`. The "When" cell must read `Every <days>` with the days in bold, then the time, then `Please arrive by <time> for registration.` — no literal `{days}` or `{time}` anywhere:
   ```js
   /\{(days|time|id)\}/.test(document.body.textContent)
   ```
   Expected: `false`.
2. Open `http://localhost:3000/welcome/latin?razorpay_payment_link_status=cancelled`. The unconfirmed page shows `Message us on WhatsApp` and `Try again`.
3. In `/admin/pages/welcome`, change "Try-again button" to `Pick another batch`, save, reload the cancelled URL, and confirm the button changed. Change it back and save.

- [ ] **Step 8: Full suite and seed check**

Run: `npx vitest run && npm run sync-seed -- --check`
Expected: `Tests T0 + 60 passed`; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 9: Commit**
```bash
git add src/lib/content-schema.ts src/lib/content-schema.test.ts "src/app/welcome/[track]/WelcomeView.tsx" src/components/admin/WelcomePageEditor.tsx
git commit -m "feat: confirmation page headings, actions and fallbacks become editable"
```

---

### Task 17: the last hardcoded literal in the Where cell

**Files:**
- Modify: `src/app/welcome/[track]/WelcomeView.tsx` (anchor: ``                {venue || 'We’ll share the exact address on WhatsApp.'}``)
- Test: none new. `welcome.noVenueNote`'s default is already pinned by Task 16 Step 1, and nothing in this repo renders a component.

**Interfaces:**
- Consumes: `copy.noVenueNote` (Task 16).
- Produces: nothing. **No schema field, no admin field, no new test** — this task adds exactly one JSX substitution.

**Why this is one edit and not six.** Spec §3.3's closing line is "Row labels come from `labels` (§4)", and that is exactly what Plan 3 did. The whole reach-us block is already `label(labels, …)` — `welcomeReachUs`, `welcomeCallPhone`, `ctaChatWhatsapp`, `ctaDmInstagram` — and so are all three strings in the Where cell: the heading (`welcomeWhereHeading`), the parking line (`welcomeParking`) and the map button (`welcomeOpenMap`). Every one of those keys ships in Plan 1's `LabelsSchema` and is edited on `/admin/labels`. Adding a parallel `welcome.contact.*` object would give each of those strings a **second** admin control in a second screen, and whichever one the studio happened not to edit would silently do nothing.

Exactly one literal survives Plan 3, and Plan 3's own markup flags it with the comment `{/* Plan 4 turns this last literal into welcome.noVenueNote. */}`: the no-venue fallback. Task 16 already added `welcome.noVenueNote` with that literal as its default. This task points the markup at it and stops.

There is no `welcomeGetDirections` and no `Get directions →` anywhere in this plan set — `WelcomeView` ships `Open map →`, Plan 1's `welcomeOpenMap` defaults to it, and renaming it would rewrite visitor-facing copy under cover of a refactor.

- [ ] **Step 1: Confirm the inventory before editing**

```bash
grep -n "Reach us\|Parking\|Open map\|on Instagram\|Call \|WhatsApp \|share the exact address\|label(labels" "src/app/welcome/[track]/WelcomeView.tsx"
```

Expected: every hit except one is a `label(labels, …)` call. The single hardcoded literal is `'We’ll share the exact address on WhatsApp.'`, inside the `{venue || …}` expression in the Where cell.

**If a second hardcoded literal appears** — Plan 3 shipped differently from what it is written to do — do **not** invent a schema object for it here. Note it, leave it, and raise it as a Plan 3 defect: every string in that block has a designated home in Plan 1's label bag, and a duplicate home is the failure this task exists to avoid. **If the surviving literal's wording differs from `welcome.noVenueNote`'s default**, change the Task 16 default to match the file byte-for-byte (and Task 16 Step 1's assertion with it) — nothing a visitor reads may change.

- [ ] **Step 2: Point the fallback at `welcome.noVenueNote`**

In `src/app/welcome/[track]/WelcomeView.tsx`, find this exact three-line block inside the Where cell (Plan 3 Task 13 Step 7's markup — the comment is Plan 3's own signpost to this edit):

```tsx
              <p className="mt-1 leading-relaxed text-cream/85">
                {/* Plan 4 turns this last literal into welcome.noVenueNote. */}
                {venue || 'We’ll share the exact address on WhatsApp.'}
              </p>
```

and replace it with:

```tsx
              <p className="mt-1 leading-relaxed text-cream/85">
                {venue || copy.noVenueNote}
              </p>
```

`copy` is `WelcomeView`'s existing `copy: Welcome` prop — the same one Task 16 reads `whenHeading`, `noDateNote` and `arriveByNote` from — so no new prop, no new import and no change to `src/app/welcome/[track]/page.tsx`. `welcome.noVenueNote` defaults to this exact literal, so an unedited document renders the identical sentence.

R1a applies: if the comment line is absent because Plan 3 shipped without it, anchor on the `{venue || 'We’ll share the exact address on WhatsApp.'}` line alone and replace just that line with `{venue || copy.noVenueNote}`.

- [ ] **Step 3: Verify in the browser**

Run `npm run typecheck` — expected silent, exit 0.

Run `npm run dev`, open `http://localhost:3000/welcome/latin`:

1. The Where cell and the contact block read exactly as they did after Plan 3 — same heading, same parking line, same map button, same rows, same real phone number and handle.
2. No placeholder leaked:
   ```js
   /\{(phone|number|handle|note|notes|days|time|id)\}/.test(document.body.textContent)
   ```
   Expected: `false`.
3. The `tel:` and `wa.me` links still point at the record values:
   ```js
   [...document.querySelectorAll('a[href^="tel:"], a[href^="https://wa.me/"], a[href*="instagram.com"]')].map((a) => a.href)
   ```
   Expected: one `tel:` with the studio's number, one `wa.me` with the site WhatsApp number, one `instagram.com/<handle>`.
4. Prove the new wiring is live: in `/admin/pages/welcome` → "Intake details — headings and fallbacks", change "When there is no venue yet" to `We will text you the address.`, save, then open a track whose batch has no studio set (or temporarily clear the batch's `branchSlug` in `/admin/batches`) and confirm the Where cell shows the new sentence. Change both back and save.
5. Prove the Where heading is still edited from Labels, not from here: in `/admin/labels`, change `welcomeWhereHeading` to `Location`, save, reload `/welcome/latin` and confirm the heading changed. Change it back and save. There must be exactly one control for that string.

- [ ] **Step 4: Full suite and seed check**

Run: `npx vitest run && npm run sync-seed -- --check`
Expected: `Tests T0 + 60 passed` — **unchanged from Task 16**, because this task adds no test; `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 5: Commit**
```bash
git add "src/app/welcome/[track]/WelcomeView.tsx"
git commit -m "feat: the confirmation page's no-venue fallback becomes editable"
```

---

### Task 18: full-suite gate

**Files:**
- Test: the whole suite

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — `Test Files F0 + 1 passed`, `Tests T0 + 60 passed`, **zero failures and zero skipped**, with `F0` / `T0` as recorded in Task 1 Step 1. Against the assumed starting point (`F0 = 38`, `T0 = 403` — R6) that is `Test Files 39 passed (39)`, `Tests 463 passed (463)`. (`F0 + 2` if the R4 guard reported `seo.test.ts NEW` — i.e. Plan 3 shipped without its Event-JSON-LD task.)

This plan's 60 tests break down as:

| file | added here | expected total after this plan |
|---|---|---|
| `src/lib/seo.test.ts` | 16 (8 in Task 1, 8 in Task 2) | 25 — Plan 3's 9 plus these 16 |
| `src/lib/enquiry.test.ts` | 18 (Task 5) | 18 — the only file this plan creates |
| `src/lib/integrity.test.ts` | 4 (Task 6) | 16 — the original 8, Plan 3's 4, these 4 |
| `src/lib/content-schema.test.ts` | 22 (6+7+3+2+4 in Tasks 8, 11, 14, 15, 16) | 25 — Plan 3's 3 plus these 22 |
| **total** | **60** | |

Task 17 adds none: it is a single JSX substitution against a default Task 16 already pins.

The three "expected total" figures depend on the sibling plans as written; the "added here" column does not. If a total is off, check it against what Task 6 Step 4 and the R4 guard actually recorded before assuming a test is missing.

In particular `roles.test.ts`, `admin-pages-guarded.test.ts`, `save-pipeline.test.ts`, `drafts-core.test.ts` and `review-regressions.test.ts` must all be green. This plan adds no top-level content key and no new `/admin/**/page.tsx`, so the first two are guards that should never have moved — if either is red, a field landed at the wrong depth.

- [ ] **Step 2: Run the typechecker**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 3: Confirm the data document and the seed are still in sync**

Run: `npm run sync-seed -- --check`
Expected: `✓ seed is in sync with data/site-content.json`, exit 0.

This plan changed neither file — every field it added is defaulted. A failure here means an earlier step hand-edited the seed (R2) or that a Plan 1–3 data edit was left unsynced; in either case fix it by editing `data/site-content.json` and running `npm run sync-seed`, never by editing the seed.

- [ ] **Step 4: Confirm the document still carries fifteen top-level keys**

Run:
```bash
node -e "const s=require('./src/data/site-content.seed.json');console.log('top-level keys:',Object.keys(s).length)"
```
Expected: `top-level keys: 16` — the original 15 plus Plan 1's `labels`. **Not 17.** This plan adds none; a 17 means something landed at the wrong depth and `roles.test.ts` would already have caught it.

- [ ] **Step 5: Sweep the public site at 375px**

Run `npm run dev` and visit `/`, `/batches`, `/dance-styles`, `/about`, `/contact`, `/faqs`, `/instructors`, `/stories`, `/privacy`, `/terms`, `/welcome/latin` at a 375px viewport. On each, in the DevTools console:

```js
({
  overflow: document.documentElement.scrollWidth === window.innerWidth,
  clippedPills: [...document.querySelectorAll('.pill')].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
  emptyControls: [...document.querySelectorAll('a,button')].filter((e) => !e.textContent.trim() && !e.getAttribute('aria-label')).length,
  leakedPlaceholders: /\{(price|date|n|total|style|days|time|phone|number|handle|note|id|studio|neighborhood|track|branch|level|where)\}/.test(document.body.innerText),
})
```

Expected on every page: `{ overflow: true, clippedPills: 0, emptyControls: 0, leakedPlaceholders: false }`.

That last flag is the one this plan is uniquely able to break: ~40 of the strings it made editable are `{placeholder}` templates, and a mis-wired `.replace()` ships the token to a visitor rather than the value. It is also the only automated-ish cover those render sites have — this plan's markup tasks (3, 4, 9, 10, 12, 13, 14, 15, 16, 17) all ship with no vitest coverage, by design, because nothing in this repo renders a component.

- [ ] **Step 6: Confirm the tree is clean**

Run: `git status --short`
Expected: **no output.** Every task committed its own files, and no task in this plan touches `data/site-content.json` or `src/data/site-content.seed.json`. If either appears here, an admin save during a browser-verification step wrote to the live document — revert it (`git checkout -- data/site-content.json`) and re-run `npm run sync-seed -- --check`.

- [ ] **Step 7: Record the outcome**

No commit. The last commit of the previous task is the head of this plan; there is nothing left to add. Report the final `Test Files` / `Tests` numbers and the `F0` / `T0` recorded in Task 1 Step 1, so the next reader can check the arithmetic in R6 against what actually happened.

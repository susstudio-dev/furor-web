# SEO Sitelinks + Local Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dancehyderabad.com maximally eligible for Google sitelinks and stronger for "dance classes in Hyderabad" local queries, per `docs/superpowers/specs/2026-08-02-seo-sitelinks-local-design.md`.

**Architecture:** All JSON-LD flows through builders in `src/lib/seo.ts` rendered by `<JsonLd>`; page metadata comes from per-route `generateMetadata`; site content (studios, hero copy, custom pages) lives in `data/site-content.json` and is mirrored into `src/data/site-content.seed.json` by `npm run sync-seed`. We add two pure helpers (word-boundary truncation, opening-hours parser), wire them into existing builders/pages, add a `noindex` flag for custom pages, fix content data, and add config + docs.

**Tech Stack:** Next.js 15 App Router (TypeScript), Zod schemas, Cloudflare Workers via OpenNext, no test runner (verify pure helpers with one-off `npx tsx` scripts; final gate = typecheck + lint + build + dev-server smoke).

## Global Constraints

- Site URL is exactly `https://www.dancehyderabad.com` (`SITE_URL` in `src/lib/seo.ts`).
- Never emit wrong structured data: parse failures must omit the property, not guess.
- No Review/AggregateRating markup (self-serving reviews risk manual action).
- The hero `<h1>` text must NOT change (brand voice, per user decision).
- Content data edits go into `data/site-content.json` first, then `npm run sync-seed` (never hand-edit the seed).
- Repo working tree has unrelated uncommitted changes (`next.config.mjs`, `PRODUCT.md`, `.impeccable/`) — never `git add -A`/`git add .`; stage only the files each task names. Do not run the destructive GH-Pages strip recipe.
- One commit per task; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Scratch verification scripts go in the session scratchpad dir (`$env:CLAUDE_SCRATCHPAD` conceptually — the executor knows its path), NOT the repo.

---

### Task 1: `truncateAtWord` helper + wire into homepage and dance-style descriptions

**Files:**
- Modify: `src/lib/seo.ts` (add export near `absoluteUrl`, ~line 159)
- Modify: `src/app/page.tsx:4-12` (generateMetadata)
- Modify: `src/app/dance-styles/[slug]/page.tsx:29`
- Test: `<scratchpad>/test-truncate.ts` (one-off, not committed)

**Interfaces:**
- Produces: `export function truncateAtWord(text: string, max?: number): string` in `src/lib/seo.ts` (default `max = 160`). Collapses runs of whitespace, trims, returns unchanged when ≤ max; otherwise cuts at the last space before `max` and appends `…`. Result length ≤ max.

- [ ] **Step 1: Write the failing test**

Create `<scratchpad>/test-truncate.ts`:

```ts
import assert from 'node:assert';
import { truncateAtWord } from 'd:/2027/susstudio/Projects/furor-web/src/lib/seo';

// Short strings pass through, whitespace collapsed
assert.strictEqual(truncateAtWord('short text', 160), 'short text');
assert.strictEqual(truncateAtWord('a  b', 160), 'a b'); // the hero double-space bug

// Long strings: ≤ max, ellipsis, never cut mid-word
const long =
  'The original Latin classic — fast, playful, infinitely connecting. Salsa is the heartbeat of Latin dance — a partner dance born of Cuban Son, Mambo and Puerto Rican street styles.';
const out = truncateAtWord(long, 160);
assert.ok(out.length <= 160, `too long: ${out.length}`);
assert.ok(out.endsWith('…'), `no ellipsis: ${out}`);
const body = out.slice(0, -1);
const collapsed = long.replace(/\s+/g, ' ').trim();
assert.ok(collapsed.startsWith(body), 'body must be an exact prefix');
assert.strictEqual(collapsed[body.length], ' ', 'cut must land on a word boundary');
console.log('truncateAtWord OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `npx --yes tsx <scratchpad>/test-truncate.ts`
Expected: FAIL — `truncateAtWord` is not exported.

- [ ] **Step 3: Implement `truncateAtWord` in `src/lib/seo.ts`**

Add above `absoluteUrl` (keep existing comment style):

```ts
// Meta descriptions: Google displays ~160 chars. Cut on a word boundary —
// a mid-word cut ("Puerto R…") reads broken in the SERP snippet.
export function truncateAtWord(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx --yes tsx <scratchpad>/test-truncate.ts`
Expected: `truncateAtWord OK`

- [ ] **Step 5: Wire into the two description call sites**

In `src/app/page.tsx`, the file currently starts:

```ts
import Link from 'next/link';
import { getContent, nextBatchPerStyle, formatBatchDate, formatInr, batchStyleLabel } from '@/lib/content';

export async function generateMetadata() {
  const c = await getContent();
  return {
    // The hero sub-headline carries the service+city phrasing ("Learn Salsa,
    // Bachata… Jubilee Hills, Hyderabad") — the highest-value local query.
    description: c.hero.subHeadline || c.site.tagline,
    alternates: { canonical: '/' },
  };
}
```

Change the `description` line to:

```ts
    description: truncateAtWord(c.hero.subHeadline || c.site.tagline),
```

and add to the imports (new line after the `@/lib/content` import):

```ts
import { truncateAtWord } from '@/lib/seo';
```

In `src/app/dance-styles/[slug]/page.tsx` line 29, change:

```ts
    description: `${s.tagline} ${s.description}`.slice(0, 160),
```

to:

```ts
    description: truncateAtWord(`${s.tagline} ${s.description}`),
```

and extend that file's existing seo import (line 8) from
`import { breadcrumbLd, courseLd } from '@/lib/seo';` to
`import { breadcrumbLd, courseLd, truncateAtWord } from '@/lib/seo';`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/seo.ts src/app/page.tsx "src/app/dance-styles/[slug]/page.tsx"
git commit -m "feat(seo): word-boundary meta description truncation"
```

---

### Task 2: Opening hours + hasMap in DanceSchool JSON-LD

**Files:**
- Modify: `src/lib/seo.ts` (new export `openingHoursLd`; wire into `danceSchoolsLd`, ~lines 43-73)
- Test: `<scratchpad>/test-hours.ts` (one-off, not committed)

**Interfaces:**
- Consumes: private `expandDay(d: string): string` already in `src/lib/seo.ts:164` (Mon→Monday etc.).
- Produces: `export function openingHoursLd(hours: string): Array<{'@type': string; dayOfWeek: string[]; opens: string; closes: string}> | undefined`. Parses the content store's human format `"Mon–Fri 9 AM–6 PM · Sat–Sun 9:30 AM–4:30 PM"` (segments split on `·`; en-dash or hyphen in ranges; optional `:MM`). Returns `undefined` if ANY segment fails — never wrong hours.

- [ ] **Step 1: Write the failing test**

Create `<scratchpad>/test-hours.ts`:

```ts
import assert from 'node:assert';
import { openingHoursLd } from 'd:/2027/susstudio/Projects/furor-web/src/lib/seo';

// Studio 1's real format
const specs = openingHoursLd('Mon–Fri 9 AM–6 PM · Sat–Sun 9:30 AM–4:30 PM')!;
assert.strictEqual(specs.length, 2);
assert.deepStrictEqual(specs[0], {
  '@type': 'OpeningHoursSpecification',
  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  opens: '09:00',
  closes: '18:00',
});
assert.deepStrictEqual(specs[1].dayOfWeek, ['Saturday', 'Sunday']);
assert.strictEqual(specs[1].opens, '09:30');
assert.strictEqual(specs[1].closes, '16:30');

// Studio 2's real format (minutes on both sides)
assert.ok(openingHoursLd('Mon–Fri 9 AM–6 PM · Sat–Sun 12:00 PM–6:00 PM'));

// 12-hour edge cases: 12 PM is noon, 12 AM is midnight
assert.strictEqual(openingHoursLd('Sat 12 PM–6 PM')![0].opens, '12:00');
assert.strictEqual(openingHoursLd('Sun 12 AM–1 AM')![0].opens, '00:00');

// Single day, plain hyphen instead of en-dash
assert.deepStrictEqual(openingHoursLd('Wed 10 AM-5 PM')![0].dayOfWeek, ['Wednesday']);

// Unparseable → undefined (all-or-nothing, never wrong data)
assert.strictEqual(openingHoursLd('By appointment only'), undefined);
assert.strictEqual(openingHoursLd(''), undefined);
assert.strictEqual(openingHoursLd('Mon–Fri 9 AM–6 PM · closed weekends'), undefined);
console.log('openingHoursLd OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --yes tsx <scratchpad>/test-hours.ts`
Expected: FAIL — `openingHoursLd` is not exported.

- [ ] **Step 3: Implement in `src/lib/seo.ts`**

Add below `danceSchoolsLd` (uses the existing `expandDay` at the bottom of the file):

```ts
const DAY_ABBRS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function to24h(h: number, m: number, ampm: string): string | undefined {
  if (h < 1 || h > 12 || m < 0 || m > 59) return undefined;
  let hh = h % 12;
  if (ampm.toUpperCase() === 'PM') hh += 12;
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// The content store keeps hours as display text ("Mon–Fri 9 AM–6 PM ·
// Sat–Sun 9:30 AM–4:30 PM"). Parse that into OpeningHoursSpecification;
// hours are admin-edited free text, so all-or-nothing: any segment that
// doesn't parse suppresses the whole property — wrong hours are worse for
// local SEO than none.
export function openingHoursLd(hours: string) {
  const segments = hours.split('·').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return undefined;
  const specs = [];
  for (const seg of segments) {
    const m = seg.match(
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:\s*[–-]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i,
    );
    if (!m) return undefined;
    const [, d1, d2, openH, openM, openAp, closeH, closeM, closeAp] = m;
    const start = DAY_ABBRS.findIndex((d) => d.toLowerCase() === d1.toLowerCase());
    const end = d2 ? DAY_ABBRS.findIndex((d) => d.toLowerCase() === d2.toLowerCase()) : start;
    if (end < start) return undefined;
    const opens = to24h(Number(openH), Number(openM ?? 0), openAp);
    const closes = to24h(Number(closeH), Number(closeM ?? 0), closeAp);
    if (!opens || !closes) return undefined;
    specs.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_ABBRS.slice(start, end + 1).map(expandDay),
      opens,
      closes,
    });
  }
  return specs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx --yes tsx <scratchpad>/test-hours.ts`
Expected: `openingHoursLd OK`

- [ ] **Step 5: Wire into `danceSchoolsLd`**

Inside the `content.studios.map((s) => ({ ... }))` object in `danceSchoolsLd`, after the `geo:` block (line 66-70) and before `sameAs`, add:

```ts
    openingHoursSpecification: openingHoursLd(s.hours),
    hasMap: `https://www.google.com/maps/search/?api=1&query=${s.geo.lat},${s.geo.lng}`,
```

(`s.geo` and `s.hours` are required fields of the studio schema — no guard needed; check `StudioSchema` in `src/lib/content-schema.ts` if typecheck disagrees.)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/seo.ts
git commit -m "feat(seo): openingHoursSpecification + hasMap on DanceSchool nodes"
```

---

### Task 3: Keyword-rich homepage title

**Files:**
- Modify: `src/app/page.tsx:4-12` (generateMetadata — already touched in Task 1)

**Interfaces:**
- Consumes: `getContent()` from `@/lib/content` (already imported); `content.danceStyles[].name`/`displayOrder`; `content.site.title`.
- Produces: homepage `<title>` = `"Furor — Dance Hyderabad | Salsa, Bachata & West Coast Swing Classes"` (derived from content, so CMS renames flow through). Uses `title.absolute` so the layout's `%s · <site.title>` template does not double the brand.

- [ ] **Step 1: Extend generateMetadata in `src/app/page.tsx`**

After Task 1, generateMetadata reads:

```ts
export async function generateMetadata() {
  const c = await getContent();
  return {
    // The hero sub-headline carries the service+city phrasing ("Learn Salsa,
    // Bachata… Jubilee Hills, Hyderabad") — the highest-value local query.
    description: truncateAtWord(c.hero.subHeadline || c.site.tagline),
    alternates: { canonical: '/' },
  };
}
```

Replace the whole function with:

```ts
export async function generateMetadata() {
  const c = await getContent();
  const styleNames = c.danceStyles
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => s.name);
  const classes =
    styleNames.length > 1
      ? `${styleNames.slice(0, -1).join(', ')} & ${styleNames[styleNames.length - 1]}`
      : styleNames[0] || 'Dance';
  return {
    // The layout default title is brand-only; the homepage must also say what
    // we sell ("… Classes") for queries like "dance classes in Hyderabad".
    // `absolute` opts out of the layout's "%s · brand" template.
    title: { absolute: `${c.site.title} | ${classes} Classes` },
    // The hero sub-headline carries the service+city phrasing ("Learn Salsa,
    // Bachata… Jubilee Hills, Hyderabad") — the highest-value local query.
    description: truncateAtWord(c.hero.subHeadline || c.site.tagline),
    alternates: { canonical: '/' },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(seo): homepage title carries style + classes keywords"
```

---

### Task 4: `noindex` flag for custom pages (robots + sitemap + data)

**Files:**
- Modify: `src/lib/content-schema.ts:407-420` (CustomPageSchema)
- Modify: `src/app/p/[slug]/page.tsx:23-27` (generateMetadata)
- Modify: `src/app/sitemap.ts:36-38`
- Modify: `data/site-content.json` (~line 961, customPages entry `page-4lt8gx`), then `npm run sync-seed` regenerates `src/data/site-content.seed.json`

**Interfaces:**
- Produces: `CustomPage.noindex: boolean` (Zod `.default(false)` — additive, old stored R2 content validates unchanged). `/p/<slug>` emits `robots: { index: false, follow: false }` when set; sitemap excludes such pages.

- [ ] **Step 1: Add the schema field**

In `src/lib/content-schema.ts`, `CustomPageSchema`, after `published: z.boolean().default(true),` (line 415) add:

```ts
  // Thin pages (payment confirmations etc.) must not be indexed or sitemapped.
  noindex: z.boolean().default(false),
```

- [ ] **Step 2: Emit robots from `/p/[slug]`**

In `src/app/p/[slug]/page.tsx` generateMetadata, the return currently reads:

```ts
  return {
    title: page.title,
    description: page.seoDescription || page.intro.lead || undefined,
    alternates: { canonical: `/p/${page.slug}` },
  };
```

Add one line before `alternates`:

```ts
    robots: page.noindex ? { index: false, follow: false } : undefined,
```

- [ ] **Step 3: Exclude from the sitemap**

In `src/app/sitemap.ts` line 37, change `.filter((p) => p.published)` to:

```ts
    .filter((p) => p.published && !p.noindex)
```

- [ ] **Step 4: Flag the confirmation page in data**

In `data/site-content.json`, the `customPages` entry `"id": "page-4lt8gx"` (slug `latinl1july2026`) has `"published": true,` — add directly below it:

```json
      "noindex": true,
```

Then run: `npm run sync-seed`
Expected: `Wrote src/data/site-content.seed.json`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/content-schema.ts "src/app/p/[slug]/page.tsx" src/app/sitemap.ts data/site-content.json src/data/site-content.seed.json
git commit -m "feat(seo): noindex flag for thin custom pages, applied to payment confirmation"
```

---

### Task 5: Real headings for FAQ sections and studio names

**Files:**
- Modify: `src/app/faqs/page.tsx:50`
- Modify: `src/app/page.tsx:300`

**Interfaces:** none (markup-only; classes unchanged so rendering is identical).

- [ ] **Step 1: FAQ section labels become h2**

`src/app/faqs/page.tsx` line 50, change:

```tsx
            <p className="display text-sm uppercase tracking-widest text-ember-400/90">{section.section}</p>
```

to:

```tsx
            <h2 className="display text-sm uppercase tracking-widest text-ember-400/90">{section.section}</h2>
```

- [ ] **Step 2: Studio names in the Visit section become h3**

`src/app/page.tsx` line 300 (inside the `sortedStudios.map`), change:

```tsx
                      <p className="display text-2xl sm:text-3xl font-bold">{s.name}</p>
```

to:

```tsx
                      <h3 className="display text-2xl sm:text-3xl font-bold">{s.name}</h3>
```

(The section's h2 is the "Find us in …" headline at line 276, so h3 nests correctly.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/faqs/page.tsx src/app/page.tsx
git commit -m "fix(seo): FAQ sections and studio names are real headings"
```

---

### Task 6: Duplicate-host protection + content data fixes

**Files:**
- Modify: `wrangler.jsonc` (after `compatibility_flags`, line 6)
- Modify: `data/site-content.json` (hero.subHeadline ~line 22; studio `studio-g2e0ls` ~lines 150-154), then `npm run sync-seed`

**Interfaces:** none.

- [ ] **Step 1: wrangler.jsonc**

After the `"compatibility_flags"` line add:

```jsonc
  // Only www.dancehyderabad.com may be crawlable — the *.workers.dev and
  // preview copies would be duplicate hosts competing with the real domain.
  "workers_dev": false,
  "preview_urls": false,
```

- [ ] **Step 2: Fix hero double space**

In `data/site-content.json` line 22 (`hero.subHeadline`), replace the two spaces in `Beginner-friendly.  Register` with one: `Beginner-friendly. Register`.

- [ ] **Step 3: Fix the PUP studio's address and pin**

Same file, studio entry `"id": "studio-g2e0ls"`:

```json
      "address": "PUP - Paws, Unleash, Play\nHUDA Enclave, Jubilee Hills, Hyderabad, Telangana 500110",
      "geo": {
        "lat": 17.385,
        "lng": 78.4867
      },
```

becomes:

```json
      "address": "PUP – Paws Unleash Play, HUDA Enclave, Jubilee Hills, Hyderabad, Telangana 500110",
      "geo": {
        "lat": 17.426,
        "lng": 78.4005
      },
```

(Coordinates sourced from the venue's public event listing; the old pin was the generic Hyderabad city-centre, ~9 km off. The embedded `\n` also broke the one-line PostalAddress streetAddress.)

Then run: `npm run sync-seed`
Expected: `Wrote src/data/site-content.seed.json`.

- [ ] **Step 4: Validate the JSON still parses + typecheck**

Run: `node -e "JSON.parse(require('fs').readFileSync('data/site-content.json','utf8')); console.log('json ok')"` then `npm run typecheck`
Expected: `json ok`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc data/site-content.json src/data/site-content.seed.json
git commit -m "fix(seo): disable workers.dev duplicate host; correct PUP studio pin + address"
```

---

### Task 7: SEO runbook for the user

**Files:**
- Create: `docs/SEO-RUNBOOK.md`

**Interfaces:** none (docs). Content requirements (write full prose for each — this is a doc for a non-SEO-expert business owner):

- [ ] **Step 1: Write `docs/SEO-RUNBOOK.md`** with these sections, in this order:

1. **Why the site is invisible right now** — both hosts serve Vercel `402 DEPLOYMENT_DISABLED` (verified 2026-08-02); Google deindexes persistently erroring sites; everything below depends on fixing this first.
2. **Cutover to Cloudflare (owner action)** — `npm run deploy`; attach `www.dancehyderabad.com` as the worker's custom domain (Workers & Pages → furor-web → Settings → Domains & Routes); move DNS to Cloudflare if not already; add a Redirect Rule 301 `dancehyderabad.com/*` → `https://www.dancehyderabad.com/$1`; verify `curl -I https://www.dancehyderabad.com/` returns 200 and apex returns 301.
3. **Re-apply content fixes to the live store** — production content lives in R2 and saved values beat the repo seed, so after cutover re-apply via the admin (`/admin/site` studios editor): PUP studio pin `17.426, 78.4005`, single-line address, and the `latinl1july2026` page's `noindex: true` via `/admin/json`. Alternative: `npm run migrate-to-r2` if starting the bucket fresh.
4. **Google Search Console** — add & verify the domain property `dancehyderabad.com` (DNS TXT); submit `https://www.dancehyderabad.com/sitemap.xml`; URL-Inspect + Request Indexing for `/`, `/dance-styles`, `/batches`; watch Coverage for the 402-era errors to clear.
5. **Google Business Profile (the "best dance class in Hyderabad" lever)** — set website to `https://www.dancehyderabad.com`; name/address/phone must match the site character-for-character (NAP consistency); primary category "Dance school"; hours identical to the site; upload class/social photos monthly; ask students for a review right after class milestones (QR to the review link works well) and reply to every review; posts for upcoming batches.
6. **What sitelinks are and when to expect them** — automatic for brand queries; typically reappear weeks after recrawl of a healthy site; the site's nav/headings/breadcrumbs/sitemap now support them; nobody can force them.
7. **Validation** — after deploy, run key pages through Google's Rich Results Test and validator.schema.org: expect DanceSchool (with hours + map), Course, FAQPage, BreadcrumbList.

- [ ] **Step 2: Commit**

```bash
git add docs/SEO-RUNBOOK.md
git commit -m "docs: SEO runbook — cutover, Search Console, Business Profile"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Static gates**

Run: `npm run typecheck` then `npm run lint`
Expected: both exit 0 (lint may print pre-existing warnings; no NEW errors).

- [ ] **Step 2: Production build**

Run: `npm run build` (plain Next build; writes `.next`, which is safe — deploy builds regenerate it)
Expected: exit 0. Note: D: is a slow HDD; allow up to 10 minutes.

- [ ] **Step 3: Dev-server smoke of rendered metadata + JSON-LD**

Start `npm run dev` in the background (dev uses `.next-dev`, port 3000). Then:

- `curl -s http://localhost:3000/ | grep -o "<title>[^<]*</title>"` → expect `Furor — Dance Hyderabad | Salsa, Bachata &amp; West Coast Swing Classes`
- `curl -s http://localhost:3000/` → assert it contains `openingHoursSpecification`, `hasMap`, and `"opens":"09:00"`; assert the studio h3 (`<h3 class="display text-2xl`) is present
- `curl -s http://localhost:3000/faqs` → assert `<h2 class="display text-sm` present and `FAQPage` present
- `curl -s http://localhost:3000/sitemap.xml` → assert it does NOT contain `latinl1july2026`
- `curl -s http://localhost:3000/p/latinl1july2026` → assert it contains `noindex`
- `curl -s http://localhost:3000/dance-styles/salsa | grep -o '<meta name="description" content="[^"]*"'` → description must not end mid-word

Stop the dev server afterwards (kill the node process; on Windows also check for orphaned processes per the OpenNext pitfalls memory).

- [ ] **Step 4: Confirm clean staging state**

Run: `git status` — only expected untouched files remain (`next.config.mjs` modification, `PRODUCT.md`, `.impeccable/` were pre-existing and stay uncommitted).

- [ ] **Step 5: Report**

No commit. Summarize verification evidence (commands + outputs) for the final review.

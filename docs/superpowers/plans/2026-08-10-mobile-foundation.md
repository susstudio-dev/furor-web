# Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the home route's image payload, fix the mobile header so it stops overflowing 335px, reclaim the fold above the booking board, and put a 60s edge cache in front of the public routes — so a visitor arriving from Instagram on mid-range Android over Indian mobile data reaches the booking board fast and without horizontal scroll. **Scope boundary, stated up front (spec §7.3 M2 scopes the `<picture>` work to the hero only):** this plan hand-writes `<picture>` for the LCP element **and nothing else**, so the measured home-route saving is **≈256,800 B of 1,454,235 B — about 17.7%**, not the −85% headline in spec §7.2; the remaining **≈970 KB** sits in the style cards and studio photos, whose variants, resolver and `immutable` cache headers all exist when this plan finishes but whose markup still points at the 2000×1335 masters. That last mile is markup-only follow-up work and is deliberately not in this plan.

**Architecture:** A build-time `sharp` script emits AVIF/WebP/JPEG crops into `public/img/` plus a committed manifest at `src/data/image-variants.json`; a pure resolver in `src/lib/image-variants.ts` turns that manifest into `<picture>` source sets, which the hero consumes as a hand-written `<picture>` with a matching `<link rel="preload">`. Everything else is markup, CSS and content data: a 44px-target mobile header with one Instagram icon, `.pill` clipping guards, a trimmed hero sub-headline plus shorter padding, client-side upload downscaling with a server-side header-parse backstop, and edge cache headers with a purge from the admin save handler. No runtime dependency is added and no content **schema** field changes.

**Tech Stack:** Next.js 15.5 App Router (React 19), TypeScript strict, Tailwind CSS 3, Zod 3, vitest 4.1.10 on Node 24.18.0, `sharp` 0.34.5 (devDependency, build-time only), Cloudflare Workers free plan via OpenNext.

**Execution order:** Plan 2 of 4. Runs after `docs/superpowers/plans/2026-08-10-labels-foundation.md` and before `docs/superpowers/plans/2026-08-10-post-payment-batches.md`. Labels must land first because this plan rewrites the header, the footer and the hero poster block — the three surfaces that would otherwise ship brand-new hardcoded `aria-label`s and strand `hero.posterAlt`; running second means every string this plan touches is already editable and this plan only has to **consume** `label()`.

## Global Constraints

- **R1 — Every edit is anchored on unique TEXT, never on a line number.** Four plans edit `Hero.tsx`, `Header.tsx`, `Footer.tsx`, `src/app/page.tsx` and the seed. Line numbers cited here are **orientation only** ("currently around :89"); the instruction is always "find this exact string". If an anchor string is not found verbatim, STOP and report — do not guess a location.
- **R2 — Never hand-write `src/data/site-content.seed.json`.** `scripts/sync-seed.mjs` regenerates the seed FROM `data/site-content.json`, so a hand-written seed edit is destroyed by the next `npm run sync-seed`. Every content-data change in this plan edits `data/site-content.json`, then runs `npm run sync-seed`, then verifies with `npm run sync-seed -- --check` expecting `✓ seed is in sync with data/site-content.json`, and commits **both** files in the same commit (`save-pipeline.test.ts:7` and `drafts-core.test.ts` parse the bundled seed at import, so a divergence throws at module load).
- **R3 — Content validation never goes on the read path.** No `.refine()` / `.superRefine()` that can reject a stored document. `src/lib/content.ts` wraps `SiteContentSchema.parse(mergeWithSeed(...))` in a try/catch whose catch returns the bundled seed, so a read-path refine turns one bad field into a site-wide outage. The one piece of validation this plan adds (social URL shape, spec §6.1) lives in `src/lib/integrity.ts`, beside the existing `branchSlug` check — write path only.
- **R4 — Never `Write` a test file another plan already created.** `src/lib/integrity.test.ts` exists today with 8 tests and Plan 3 appends to it; this plan therefore does **not** touch it. The new social-URL assertions live in a new file, `src/lib/social-url.test.ts`.
- **R5 — Every code step contains real, complete, compiling code.** No "following X exactly", no "similar to Task N", no "add one field per key", no TBD.
- **R6 — Test-count arithmetic.** This plan runs **second**, so its baseline is Plan 1's end state: **29 files / 317 tests, all green**. (The pre-Plan-1 repo is 26 files / 279 tests, verified on Node v24.18.0 / vitest 4.1.10 — that is *not* this plan's starting point.) This plan's own delta is **+5 files, +35 tests**: `image-variants.test.ts` (8), `image-downscale.test.ts` (7), `image-dimensions.test.ts` (8), `public-urls.test.ts` (6), `social-url.test.ts` (6) — 8+7+8+6+6 = 35. So 29 + 5 = **34 files** and 317 + 35 = **352 tests**. If Plan 1 lands on a different number, re-base from the **delta**, not from 34/352.
- **R7 — Commit style:** lowercase conventional prefix, imperative. **NEVER add a `Co-Authored-By` trailer to any commit.**
- **R8 — No runtime dependency.** `sharp` goes to **devDependencies** only. It must never appear under `dependencies`.
- **Inherited from Plan 1 — do not re-create, only consume.** `src/lib/labels.ts` exports `LABEL_DEFAULTS` and `label(labels, key)`; `src/lib/nav.ts` exports the id-keyed nav array; `HeroSchema` already has `posterAlt` and `Hero.tsx` already reads `content.hero.posterAlt`. This plan consumes exactly six label keys — `ariaToggleMenu`, `ariaMenu`, `ariaSocialInstagram`, `ariaSocialFacebook`, `ariaSocialYoutube`, `ariaSocialWhatsapp` — and **adds none**, because Plan 1's `labels.test.ts` pins `Object.keys(LABEL_DEFAULTS).length` and a new key would break it. Task 7 Step 1 is a preflight that fails loudly if any of the six is missing.
- **Zero new hardcoded user-visible strings.** Every `aria-label` this plan writes reads through `label(content.labels, …)`. Every `alt` reads `content.hero.posterAlt`. There is no module-level `POSTER_ALT` constant.
- Tests are vitest: `npx vitest run`, config `vitest.config.mts`, include `src/**/*.test.ts`, `environment: 'node'`. **No test in this repo renders a React component** — do not add React Testing Library, jsdom or a browser environment. All new logic lands in pure functions in `src/lib`, colocated as `src/lib/foo.ts` → `src/lib/foo.test.ts`, style matching `src/lib/batch-order.test.ts`: `import { describe, expect, it } from 'vitest';` first line, one `describe` per exported symbol, `it('lowercase sentence', …)`.
- TypeScript strict. `npm run typecheck` = `tsc --noEmit`.
- **No content schema changes.** `src/lib/content-schema.ts` is not touched by this plan. No new top-level key, so no `SECTION_PATHS` (`src/lib/roles.ts:49`) registration; no new `src/app/admin/**/page.tsx`, so `admin-pages-guarded.test.ts` is unaffected.
- Cloudflare Workers free plan, 10 ms CPU cap: all image re-encoding is build-time or client-side, never in the Worker. The server-side upload check is a header parse, not a decode.
- **Three tasks ship with ZERO automated regression cover** — Task 7 (header), Task 9 (fold), Task 13 (font fallback + ken-burns). There is no Lighthouse, Playwright or Puppeteer in this repo (spec §7.5), so nothing prevents a future edit from silently reintroducing horizontal scroll or pushing the board back below the fold. The **only** guard is the manual DevTools check written into each of those tasks, and Task 14 re-runs it. Treat those numbers as the contract.
- Measured facts this plan is built on, all re-verified against the working tree on 2026-08-10:
  - home route images = **1,454,235 B across 7 requests** (297,280 + 285,131 + 249,269 + 219,382 + 197,312 + 191,024 + 14,837)
  - LCP resource = `/photos/DSC_0166.jpg` at **297,280 B**; spec §7.5 gate is **< 45,000 B**
  - `container-x` is `px-5` (`globals.css`) → **335 px of content width at 375 px**
  - header row uses **256 px** today (156 brand + 12 gap + 42 ThemeToggle + 8 gap + 38 burger) and **264 px** after (156 + 12 + 44 Instagram + 8 + 44 burger)
  - `hero.subHeadline` is **268 characters** today and becomes **142** (spec §6.3)
  - `tonight.when` is **67 characters** including a trailing space
  - there are **10** `sizes=` occurrences in `src/`: 7 on public surfaces (`Hero.tsx:45`, `PhotoCarousel.tsx:39`, `page.tsx:127`, `page.tsx:406`, `dance-styles/[slug]/page.tsx:69`, `dance-styles/page.tsx:60`, `instructors/page.tsx:73`), 2 in the admin (`ImageUploader.tsx:59`, `:197`) and 1 pass-through prop (`Img.tsx:47`). All ten are dead: `generateImgAttrs` in `next/dist/shared/lib/get-img-props.js` returns before `srcSet`/`sizes` reach the element whenever `images: { unoptimized: true }` is set, which `next.config.mjs` does.

## Owner actions (outside the code)

These cannot be done by an agent and are **not** solved anywhere in the four plans. Name them to the owner when this plan completes.

1. **`/instructors` is 6,926,052 B and nothing in any plan shrinks what ships today.** Of its 9 instructor photos, **7 are R2 uploads under `/uploads/…`** which `scripts/build-images.mjs` skips by design (they are not on disk at build time) and only 2 (`/photos/rishikesh.png`, `/photos/aditya.jpg`) get variants. Task 10's client-side downscale caps **future** uploads at a 1600px long edge; it does nothing for bytes already in R2. The single largest win in spec §7.2 (−99.2%) therefore requires a **one-off re-upload pass**: after Task 10 ships, the owner opens `/admin/instructors`, re-uploads the same seven photographs through the (now downscaling) uploader, and saves. That converts them to ≤1600px WebP in place. Until that pass happens, `/instructors` stays at 6.9 MB.
2. **Verify or replace the YouTube URL.** `site.socials.youtube` is stored as `https://youtube.com/furorhyd`, which is not a valid channel shape. Task 14 adds the format hint and a write-path check; the icon renders only when a URL is set, so an unverified URL still ships a link that 404s. Owner opens `/admin/site`, replaces it with the real `https://youtube.com/@handle` (or clears it), and saves.
3. **Enable the Cloudflare Cache Rule.** Task 12 sets `s-maxage=60` on public routes, but **Cloudflare does not cache HTML by default** — the header does nothing until a zone Cache Rule marks matching requests "Eligible for cache". The rule is: hostname = `www.dancehyderabad.com` AND URI path does not start with `/admin` or `/api`, respecting origin cache-control. Task 12 Step 8 repeats this inline so it is not lost.
4. **Set the purge credentials.** `CF_ZONE_ID` and `CF_PURGE_TOKEN` (a token scoped to *Zone → Cache Purge*) must be added as Worker secrets, or the purge silently no-ops and an owner edit sits behind the edge for up to 60 s.
5. **Confirm `NEXT_PUBLIC_GA4_ID` in production** — Task 3 Step 4 measures it, but only the owner can set it. If it is unset, the paid conversion path has no measurement at all and none of this work can be evaluated.
6. **Run Lighthouse mobile against the deployed Worker, before and after (spec §7.5).** There is no Lighthouse in this repo and no agent can drive one, but every headline number in this plan (LCP < 2.5 s, CLS < 0.1, INP < 200 ms — the `PRODUCT.md` budget Task 15 rewrites) is a Lighthouse-mobile number. Take the **median of 3 runs** against the deployed URL, once before this plan ships and once after:

   ```bash
   npx lighthouse https://www.dancehyderabad.com/ --preset=perf --form-factor=mobile --throttling-method=simulate --output=json --output-path=./lh-before.json
   ```

   Record **LCP, CLS and INP** from each run and keep both JSON files. Without the "before" capture taken *first*, the "after" is a number with nothing to compare it to and the budget in `PRODUCT.md` stays an unverified claim.
7. **Verify on real devices that the AVIF `<source>` is actually selected in the Instagram in-app browser.** This is load-bearing, not a nicety: the *entire* LCP win in this plan is one AVIF `<source>` in Task 6's hand-written `<picture>`, and every measurement in this plan is taken in desktop Chrome, which has supported AVIF for years. The visitor this plan is written for arrives from an Instagram link, so the render happens in Instagram's embedded webview (iOS WKWebView, Android WebView) — not Chrome or Safari proper. Open the site from an Instagram link on **one real iOS device and one real Android device**, and on each confirm the LCP request is `dsc-0166-hero-portrait-750-<hash>.avif` and not the `.webp` or `.jpg` fallback (remote-debug the webview, or read it off the Cloudflare request log by filename). If either falls back, the ≈86% LCP saving in Task 16 Step 4 does not exist for the plan's primary visitor and the WebP quality setting in `scripts/build-images.mjs` becomes the number that matters.

---

## File Structure

| File | Created / Modified | Single responsibility |
|---|---|---|
| `scripts/audit-image-weight.mjs` | Create | Re-runnable image baseline: resolve every content-referenced home-route image against `fs.statSync`, print per-file + total bytes and the LCP gate |
| `scripts/audit-bundle.mjs` | Create | Re-runnable first-load-JS meter (spec §7.5): gzip the real chunk bytes per app route and split the framework floor from app-authored JS |
| `scripts/build-images.mjs` | Create | Build-time `sharp` pipeline: crop + resize + encode AVIF/WebP/JPEG into `public/img/`, write the manifest |
| `src/data/image-variants.json` | Create (generated, committed) | The manifest mapping each source image URL to its rendition files |
| `src/lib/image-variants.ts` | Create | Pure resolver: manifest → `srcset` strings and a hero `<picture>` source bundle |
| `src/lib/image-variants.test.ts` | Create | Tests for the resolver + a guard that the shipped manifest still covers the seed hero poster |
| `src/lib/image-downscale.ts` | Create | Client-side upload downscale: pure `fitWithin` + `createImageBitmap`/`OffscreenCanvas` re-encode |
| `src/lib/image-downscale.test.ts` | Create | Tests for `fitWithin` and the no-browser-API fallback |
| `src/lib/image-dimensions.ts` | Create | Server backstop: parse PNG/JPEG/WebP headers for pixel dimensions, flag oversize |
| `src/lib/image-dimensions.test.ts` | Create | Tests against hand-built header bytes |
| `src/lib/public-urls.ts` | Create | Pure: the canonical public path list, origin-prefixing, and chunking |
| `src/lib/public-urls.test.ts` | Create | Tests for the path list, absolute URLs and chunking |
| `src/lib/edge-purge.ts` | Create | Server-only Cloudflare cache purge; no-op when unconfigured |
| `src/lib/social-url.ts` | Create | Pure shape check + format hint for the three social URLs (spec §6.1 / decision #6) |
| `src/lib/social-url.test.ts` | Create | Tests for the shape check and its `integrityIssues` wiring |
| `src/components/SocialIcons.tsx` | Create | Four inline SVG social glyphs shared by the header drawer and the footer |
| `src/components/Hero.tsx` | Modify | Hand-written `<picture>` + `<link rel="preload">` for the LCP element; reclaimed fold padding |
| `src/components/BrandMark.tsx` | Modify | Drop the competing `priority` on the logo |
| `src/components/Img.tsx` | Modify | Remove the dead `sizes` prop entirely |
| `src/components/Header.tsx` | Modify | 44px targets, one Instagram icon on mobile, ThemeToggle + 3-social row in the drawer, all three inline at `lg:` |
| `src/components/Footer.tsx` | Modify | Mirror the drawer's social row and add the missing WhatsApp link |
| `src/components/PhotoCarousel.tsx` | Modify | Delete a dead `sizes` prop |
| `src/components/TonightTile.tsx` | Modify | Keep only the short `when` inside the pill |
| `src/components/admin/ImageUploader.tsx` | Modify | Delete two dead `sizes` props; downscale before upload |
| `src/app/page.tsx` | Modify | Delete two dead `sizes` props; pass the resolved hero poster to `<Hero>` |
| `src/app/instructors/page.tsx` | Modify | Delete a dead `sizes` prop |
| `src/app/dance-styles/page.tsx` | Modify | Delete a dead `sizes` prop |
| `src/app/dance-styles/[slug]/page.tsx` | Modify | Delete a dead `sizes` prop |
| `src/app/globals.css` | Modify | `.pill` clipping guard, `.accent` font fallback, `.animate-kenburns` scoped to `sm:+` |
| `src/app/admin/site/SiteEditor.tsx` | Modify | YouTube/Instagram/Facebook format hints + live URL-shape warning |
| `src/lib/integrity.ts` | Modify | Call the social-URL shape check on the write path |
| `src/app/api/admin/upload/route.ts` | Modify | Server-side dimension ceiling backstop |
| `src/app/api/admin/save/route.ts` | Modify | Purge the edge cache after a published save |
| `src/lib/revalidate-public.ts` | Modify | Use the shared public path list |
| `data/site-content.json` | Modify | `tonight.when` / `tonight.body` split; `hero.subHeadline` trimmed to 142 chars |
| `src/data/site-content.seed.json` | Modify (generated) | Regenerated by `npm run sync-seed` — never hand-edited (R2) |
| `next.config.mjs` | Modify | 60 s edge cache on public routes; `/admin` and `/api` keep `no-store` |
| `public/_headers` | Modify | `immutable` rules for `/img/*` and `/uploads/*` |
| `package.json` | Modify | `sharp` devDependency + `audit:images`, `audit:bundle`, `build:images` scripts |
| `PRODUCT.md` | Modify | Split the performance budget per spec decision #10; record the 60 s anonymous freshness trade |

---

### Task 1: Baseline image-weight audit

Spec §7.5 requires this **before** anything is touched: "capture before touching anything".

**Files:**
- Create: `scripts/audit-image-weight.mjs`
- Modify: `package.json` (anchor: `"sync-seed": "node scripts/sync-seed.mjs",`)
- Test: manual — the script's own output is the artifact. No automated cover; this is a meter, not a gate.

**Interfaces:**
- Consumes: `data/site-content.json` (falling back to `src/data/site-content.seed.json`) — fields `hero.posterImage`, `danceStyles[].heroImage`, `studios[].photos`, `instructors[].photo`
- Produces: `npm run audit:images` printing per-file bytes, a total, and the LCP gate. No exported symbols.

- [ ] **Step 1: Write the script**

Create `scripts/audit-image-weight.mjs`:

```js
#!/usr/bin/env node
// Image-weight meter for the home route.
//
// Spec §7.5 names this number as the thing that must be captured BEFORE any
// mobile work starts and re-checked after, so it lives in the repo rather than
// in someone's terminal history. It resolves the real content document (not a
// hardcoded list) against the bytes on disk, so a photo swapped in the admin
// changes this report the moment it lands in data/site-content.json.
//
//   node scripts/audit-image-weight.mjs
//   npm run audit:images

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// Spec §7.5: the LCP resource must come in under 45 KB after M1/M2.
const LCP_TARGET_BYTES = 45000;

function loadContent() {
  for (const rel of ['data/site-content.json', 'src/data/site-content.seed.json']) {
    const full = resolve(ROOT, rel);
    if (!existsSync(full)) continue;
    let raw = readFileSync(full, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return { source: rel, content: JSON.parse(raw) };
  }
  console.error('No content document found (data/site-content.json or the bundled seed).');
  process.exit(1);
}

// /logo-mark.png is not in the content document — BrandMark hardcodes it — but
// every page requests it twice (header + footer, same URL, one fetch). Leaving
// it out would understate the route.
const BRAND_MARK = '/logo-mark.png';

function homeRouteImages(c) {
  const rows = [];
  const push = (url, role) => {
    if (typeof url === 'string' && url.length > 0) rows.push({ url, role });
  };
  push(BRAND_MARK, 'BrandMark');
  push(c.hero.posterImage, 'hero.posterImage');
  for (const s of c.danceStyles) push(s.heroImage, 'danceStyles[].heroImage');
  for (const s of c.studios) for (const p of s.photos) push(p, 'studios[].photos');
  // One request per distinct URL: DSC_0166 is both the hero poster and a
  // studio photo, and the browser fetches it once.
  const seen = new Set();
  return rows.filter((r) => (seen.has(r.url) ? false : seen.add(r.url)));
}

function byteSize(url) {
  if (!url.startsWith('/')) return null; // remote URL — not ours to measure
  const full = resolve(ROOT, 'public', url.slice(1));
  if (!existsSync(full)) return null; // R2-backed upload, absent locally
  return statSync(full).size;
}

const n = (v) => v.toLocaleString('en-US');

const { source, content } = loadContent();
const rows = homeRouteImages(content).map((r) => ({ ...r, bytes: byteSize(r.url) }));
const onDisk = rows.filter((r) => r.bytes != null).sort((a, b) => b.bytes - a.bytes);
const missing = rows.filter((r) => r.bytes == null);
const total = onDisk.reduce((sum, r) => sum + r.bytes, 0);

console.log(`Content document: ${source}`);
console.log('');
console.log(
  `Home route images — ${onDisk.length} requests, ${n(total)} B (${(total / 1024).toFixed(1)} KB)`,
);
console.log('');
for (const r of onDisk) {
  console.log(`  ${n(r.bytes).padStart(11)} B  ${r.url.padEnd(30)} ${r.role}`);
}

const hero = rows.find((r) => r.role === 'hero.posterImage');
const heroBytes = hero?.bytes ?? 0;
console.log('');
console.log(
  `LCP resource: ${n(heroBytes)} B  (target < ${n(LCP_TARGET_BYTES)} B)  ` +
    (heroBytes > 0 && heroBytes < LCP_TARGET_BYTES ? 'PASS' : 'FAIL'),
);

// Site-wide debt this script cannot weigh: uploads live in R2 in production
// and public/uploads/ is gitignored, so they never resolve here.
const allRefs = new Set();
for (const i of content.instructors) if (i.photo) allRefs.add(i.photo);
const unresolved = [...allRefs].filter((u) => byteSize(u) == null);
if (missing.length || unresolved.length) {
  console.log('');
  console.log('Not measurable on disk (R2-backed uploads or remote URLs):');
  for (const r of missing) console.log(`  ${r.url}  ${r.role}`);
  for (const u of unresolved) console.log(`  ${u}  instructors[].photo`);
}
```

- [ ] **Step 2: Register the npm script**

In `package.json`, find the exact line `    "sync-seed": "node scripts/sync-seed.mjs",` and insert immediately after it:

```json
    "audit:images": "node scripts/audit-image-weight.mjs",
```

- [ ] **Step 3: Run it and record the baseline**

Run: `npm run audit:images`

Expected, exactly (these are the spec §7.5 baseline numbers, re-verified against the working tree on 2026-08-10):

```
Home route images — 7 requests, 1,454,235 B (1420.2 KB)

      297,280 B  /photos/DSC_0166.jpg           hero.posterImage
      285,131 B  /photos/DSC_0095.jpg           studios[].photos
      249,269 B  /photos/DSC09730.jpg           danceStyles[].heroImage
      219,382 B  /photos/DSC_9973.jpg           danceStyles[].heroImage
      197,312 B  /photos/DSC09698.jpg           danceStyles[].heroImage
      191,024 B  /photos/DSC09776.jpg           studios[].photos
       14,837 B  /logo-mark.png                 BrandMark

LCP resource: 297,280 B  (target < 45,000 B)  FAIL
```

followed by seven `/uploads/…` lines under "Not measurable on disk".

Paste this output into the task's completion note. If the total is not `1,454,235`, STOP and report — the content document has drifted from the spec's measurement and every later estimate needs re-basing.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-image-weight.mjs package.json
git commit -m "chore: committed image-weight audit for the home route baseline"
```

---

### Task 2: Committed first-load JS meter

Spec §7.5 asks for a committed `scripts/audit-bundle.mjs` beside the image audit, and nobody has written it. Without it the two budgets in `PRODUCT.md` (Task 15) are unverifiable claims, and Plan 1 has already added `LABEL_DEFAULTS` to the client bundle through `Header.tsx` with no way to price it.

**Files:**
- Create: `scripts/audit-bundle.mjs`
- Modify: `package.json` (anchor: `    "audit:images": "node scripts/audit-image-weight.mjs",`)
- Test: manual — the script's own output. No automated cover.

**Interfaces:**
- Consumes: `.next/build-manifest.json` (`rootMainFiles`) and `.next/app-build-manifest.json` (`pages`), both written by `next build`
- Produces: `npm run audit:bundle` (report-only, exit 0) and `npm run audit:bundle -- --strict` (exit 1 if any non-admin route breaches a budget). No exported symbols.

- [ ] **Step 1: Write the script**

Create `scripts/audit-bundle.mjs`:

```js
#!/usr/bin/env node
// First-load JS meter (spec §7.5).
//
// `next build` prints a route table but leaves no machine-readable artifact of
// it, and the number that actually matters here is not in that table at all:
// app-authored client JS per route, separated from the React/Next framework
// floor. Spec decision #10 splits the budget on exactly that line, so the
// budget is uncheckable without this script.
//
// Method: read the two build manifests, take the union of rootMainFiles and
// each app route's chunk list, and gzip the real bytes. The "framework floor"
// is the set of chunks EVERY app route loads — i.e. what an empty route would
// still cost. App-authored = route total minus floor.
//
//   npm run build && npm run audit:bundle
//   npm run audit:bundle -- --strict     # exit 1 on a breach

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
// Always the production directory. next.config.mjs points dev at .next-dev
// precisely so a build cannot clobber a running dev server; this script only
// ever reads the build output.
const DIST = resolve(ROOT, '.next');

// PRODUCT.md, per spec decision #10.
const TOTAL_BUDGET = 115 * 1024;
const APP_BUDGET = 12 * 1024;

const strict = process.argv.includes('--strict');

function readJson(rel) {
  const full = resolve(DIST, rel);
  if (!existsSync(full)) {
    console.error(`Missing ${rel}. Run \`npm run build\` first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(full, 'utf8'));
}

const buildManifest = readJson('build-manifest.json');
const appManifest = readJson('app-build-manifest.json');

const rootMain = (buildManifest.rootMainFiles ?? []).filter((f) => f.endsWith('.js'));

const routes = [];
for (const [key, files] of Object.entries(appManifest.pages ?? {})) {
  if (!key.endsWith('/page')) continue; // /layout, /not-found etc. are not routes
  const route = key.slice(0, -'/page'.length) || '/';
  const js = new Set([...rootMain, ...files.filter((f) => f.endsWith('.js'))]);
  routes.push({ route, files: js });
}
if (routes.length === 0) {
  console.error('app-build-manifest.json listed no /page entries — nothing to measure.');
  process.exit(1);
}

const gzCache = new Map();
function gzBytes(file) {
  if (gzCache.has(file)) return gzCache.get(file);
  const full = resolve(DIST, file);
  const size = existsSync(full) ? gzipSync(readFileSync(full), { level: 9 }).length : 0;
  gzCache.set(file, size);
  return size;
}
const gzTotal = (files) => [...files].reduce((sum, f) => sum + gzBytes(f), 0);

// The floor is what every single app route carries.
let shared = new Set(routes[0].files);
for (const r of routes.slice(1)) shared = new Set([...shared].filter((f) => r.files.has(f)));
const floor = gzTotal(shared);

const rows = routes
  .map((r) => {
    const total = gzTotal(r.files);
    return { route: r.route, total, app: total - floor, admin: r.route.startsWith('/admin') };
  })
  .sort((a, b) => b.total - a.total);

const kb = (v) => `${(v / 1024).toFixed(2)} KB`;

console.log(`Framework floor (chunks shared by all ${routes.length} app routes): ${kb(floor)} gz`);
console.log(`Budgets: total < ${kb(TOTAL_BUDGET)} gz, app-authored < ${kb(APP_BUDGET)} gz`);
console.log('');
console.log('  total gz     app gz   route');

let breaches = 0;
for (const r of rows) {
  const overTotal = !r.admin && r.total > TOTAL_BUDGET;
  const overApp = !r.admin && r.app > APP_BUDGET;
  if (overTotal || overApp) breaches++;
  const flag = r.admin ? '   (admin)' : overTotal || overApp ? '   OVER' : '';
  console.log(`  ${kb(r.total).padStart(10)} ${kb(r.app).padStart(10)}   ${r.route}${flag}`);
}

console.log('');
console.log(
  breaches === 0 ? 'All public routes within budget.' : `${breaches} public route(s) over budget.`,
);
if (strict && breaches > 0) process.exit(1);
```

- [ ] **Step 2: Register the npm script**

In `package.json`, find `    "audit:images": "node scripts/audit-image-weight.mjs",` and insert immediately after it:

```json
    "audit:bundle": "node scripts/audit-bundle.mjs",
```

- [ ] **Step 3: Build and take the baseline**

Run: `npm run build`

Expected: a successful production build. **This is slow on this machine** — the repo lives on a mechanical D: drive; allow several minutes. It writes `.next`, not `.next-dev`, so a running `npm run dev` is unaffected.

Then run: `npm run audit:bundle`

Expected: a table whose `/` row reads approximately `123.60 KB` total and `23.46 KB` app-authored, against a framework floor of approximately `100.14 KB` — the three numbers spec decision #10 quotes, and they are self-consistent (123.60 − 100.14 = 23.46). `/` will be flagged `OVER` on both budgets; that is the honest state of the repo today and is exactly why Task 15 rewrites the budget line.

Record the real numbers in the task's completion note. If they differ from the spec's by more than ~2 KB, record the new baseline and note the drift — do not stop; Plan 1 has already added client code since the spec was measured.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-bundle.mjs package.json
git commit -m "chore: committed first-load js meter splitting framework floor from app code"
```

---

### Task 3: Resolve the two §7.5 unknowns

Spec §7.5: *"Two unknowns to resolve cheaply **first**"* — why `next/font` emits **zero** font preloads, and whether `NEXT_PUBLIC_GA4_ID` is set in production. The font one is load-bearing: Task 13 changes the `.accent` fallback to de-risk a font swap, and whether that swap can happen at all depends on the answer. This task diagnoses; it changes no shipped code.

**Files:**
- Test: manual — four probes, each with an exact command and an exact expected output. No automated cover; the deliverable is a recorded finding.

**Interfaces:**
- Consumes: `src/app/layout.tsx` (the three `next/font/google` loaders and `await connection()`), `next.config.mjs` (`htmlLimitedBots: /.*/`), the deployed Worker
- Produces: a written finding pasted into the task's completion note, in the shape `FONT PRELOADS: <dev-only | blocked by htmlLimitedBots | blocked by dynamic layout | Next 15.5 behaviour>` and `GA4: <set | unset>`

- [ ] **Step 1: Confirm the symptom in dev, then in a production build**

`next dev` is not evidence on its own: it serves fonts through the dev asset pipeline and does not emit the build-time preload links at all, so a dev-only absence proves nothing. Check both.

Run `npm run dev`, then in a second shell:

```bash
curl -s http://localhost:3000/ | grep -o '<link[^>]*rel="preload"[^>]*as="font"[^>]*>' | wc -l
```

Expected: `0` — this reproduces the symptom the spec recorded.

Stop the dev server. The build from Task 2 is still valid; rebuild only if the tree has changed. Then run `npm run start` and, in a second shell:

```bash
curl -s http://localhost:3000/ | grep -o '<link[^>]*rel="preload"[^>]*as="font"[^>]*>' | wc -l
curl -s http://localhost:3000/ | grep -o 'href="/_next/static/media/[^"]*\.woff2"' | head -5
```

Expected — one of two outcomes, **record which**:
- **A count > 0.** The finding is `FONT PRELOADS: dev-only`. Fonts are preloaded in production, the swap window is short, and Task 13's `.accent` change is cheap insurance rather than a fix. Skip Steps 2 and 3.
- **`0` again.** The symptom is real in production. Continue to Step 2.

- [ ] **Step 2: Isolate `htmlLimitedBots` (only if Step 1 returned 0 in production)**

`next.config.mjs` sets `htmlLimitedBots: /.*/` (currently around :103) to force metadata to block for every user agent. That changes how the head is flushed, which is the mechanism a font preload depends on.

Find the exact text `  htmlLimitedBots: /.*/,` and prefix it with `// `. Then `npm run build && npm run start` and re-run Step 1's count.

Expected: record whether the count becomes > 0.

**Revert immediately afterwards:** `git checkout -- next.config.mjs`. Removing that line permanently is not on the table here — the comment above it records a real crawl finding, and trading SEO metadata for a font preload is a decision for the owner, not this plan. If this probe is the cause, the finding is `FONT PRELOADS: blocked by htmlLimitedBots` and the fix is a separate decision.

- [ ] **Step 3: Isolate the fully-dynamic root layout (only if Step 2 did not explain it)**

`src/app/layout.tsx` calls `await connection();` (currently around :76), which opts every route out of static rendering. Next resolves font preloads from the build-time route manifest, so a route that is never statically analysed can lose them.

Find the exact line `  await connection();` and prefix it with `// `. Then `npm run build && npm run start` and re-run Step 1's count.

Expected: record whether the count becomes > 0.

**Revert immediately:** `git checkout -- src/app/layout.tsx`. `await connection()` is what makes admin edits appear within ~30 s on Workers (there is no ISR tag cache on the free plan); it is not removable.

If neither Step 2 nor Step 3 changes the count, the finding is `FONT PRELOADS: Next 15.5 behaviour` — nothing in this repo's configuration causes it, and Task 13's fallback change is the only mitigation available.

- [ ] **Step 4: Check GA4 in production**

`NEXT_PUBLIC_GA4_ID` is inlined at **build** time (`DEPLOY.md:103`), so the only reliable check is the deployed HTML, not the local env:

```bash
curl -s https://www.dancehyderabad.com/ | grep -c "googletagmanager.com/gtag/js"
```

Expected: `1` if GA4 is configured, `0` if it is not.

Record `GA4: set` or `GA4: unset`. If **set**, also record that `Analytics.tsx` loads gtag with `strategy="afterInteractive"`, which lands inside the INP window on a mid-range Android — real, but a separate optimisation and out of scope here. If **unset**, this goes to the owner (Owner action 5): the paid conversion path has no measurement, and none of this plan's work can be evaluated against real users.

- [ ] **Step 5: Record the finding — no commit**

This task produces no file changes.

Run: `git status --short`
Expected: empty output. If `next.config.mjs` or `src/app/layout.tsx` is dirty, a probe was not reverted — revert it now.

Paste both findings into the completion note. Task 13 Step 1 reads them.

---

### Task 4: Build-time image pipeline (M1)

**Files:**
- Create: `scripts/build-images.mjs`
- Create: `src/data/image-variants.json` (generated by the script, committed)
- Create: `public/img/**` — 48 generated files, committed
- Modify: `package.json` (anchor: `    "audit:bundle": "node scripts/audit-bundle.mjs",` and the `devDependencies` block)
- Test: manual — the script's file count and byte report. No automated cover here; Task 5's `the shipped manifest` test is the guard that the output stays in step with the content document.

**Interfaces:**
- Consumes: `data/site-content.json` / the seed; `sharp` 0.34.5
- Produces: `src/data/image-variants.json` with shape
  `Record<sourceUrl, Partial<Record<VariantKind, Array<{ width, height, avif, webp, jpg }>>>>`
  where `VariantKind` is `'heroPortrait' | 'heroLandscape' | 'card' | 'studio' | 'thumb' | 'avatar'`. Task 5 types this file.

**Why 48 files when only 9 are requested today.** Spec §7.3 M1 specifies the whole rendition set (hero portrait ×2, hero landscape, style cards, studio, thumbs, avatars) as one deliverable, and §7.3 M2 scopes the `<picture>` markup to the hero alone. So this task emits all of it and Task 6 wires up 9 files (3 formats × 3 hero renditions); the other 39 sit unreferenced. They are emitted now rather than later because the pipeline is one deterministic pass over one manifest with one `immutable` header rule — splitting it means running `sharp` twice, reviewing `public/img` twice, and hand-reconciling two manifests. The cost is repository and deploy-artifact bytes, **not visitor bytes**: nothing requests them, so no visitor downloads one. Step 6 prints the on-disk total so that cost is visible rather than assumed.

- [ ] **Step 1: Declare sharp as a devDependency**

Run: `npm install --save-dev sharp@^0.34.5`

Expected: `package.json` gains `"sharp": "^0.34.5"` under `devDependencies`. It is already present in `node_modules` as a transitive of Next — declaring it makes the build reproducible (spec §8). Verify it landed in the right block:

```bash
node -e "const p=require('./package.json');console.log('dependencies:',p.dependencies.sharp,'devDependencies:',p.devDependencies.sharp)"
```

Expected: `dependencies: undefined devDependencies: ^0.34.5`. If `sharp` appears under `dependencies`, move it — R8.

- [ ] **Step 2: Write the build script**

Create `scripts/build-images.mjs`:

```js
#!/usr/bin/env node
// Build-time responsive image pipeline (spec §7.3 M1).
//
// Cloudflare's free plan has no image optimizer, and next.config.mjs sets
// `images: { unoptimized: true }` — so next/image emits neither srcset nor
// sizes and a 375px phone downloads the same 2000px master a 4K desktop does.
// This script pre-cuts every rendition the site can actually use, at the crop
// each slot really renders, and commits them. Zero Worker CPU, zero
// Cloudflare spend, and nothing new ships to the browser.
//
// Output filenames carry an 8-char hash of the SOURCE bytes, so a replaced
// photo is a replaced URL — which is what makes the `immutable` cache rule in
// public/_headers genuinely safe.
//
//   npm run build:images

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(ROOT, 'public/img');
const MANIFEST = resolve(ROOT, 'src/data/image-variants.json');

// [targetWidth, targetHeight] renditions per kind, plus the focal point the
// live CSS uses, expressed as a fraction of the slack the cover-crop throws
// away. heroPortrait's 0.78/0.38 is exactly Hero.tsx's object-[78%_38%];
// card/heroLandscape's 0.5/0.30 is object-[center_30%]; avatar's 0.5/0.25 is
// instructors/page.tsx's object-[center_25%].
const KINDS = {
  heroPortrait: { token: 'hero-portrait', sizes: [[750, 1380], [1125, 2070]], focus: [0.78, 0.38] },
  heroLandscape: { token: 'hero-landscape', sizes: [[1080, 721]], focus: [0.5, 0.3] },
  card: { token: 'card', sizes: [[750, 938]], focus: [0.5, 0.3] },
  studio: { token: 'studio', sizes: [[750, 562]], focus: [0.5, 0.5] },
  thumb: { token: 'thumb', sizes: [[384, 288]], focus: [0.5, 0.5] },
  avatar: { token: 'avatar', sizes: [[256, 256], [512, 512]], focus: [0.5, 0.25] },
};

const AVIF = { quality: 50, effort: 4, chromaSubsampling: '4:2:0' };
const WEBP = { quality: 72, effort: 5 };
const JPEG = { quality: 76, progressive: true, mozjpeg: true };

function loadContent() {
  for (const rel of ['data/site-content.json', 'src/data/site-content.seed.json']) {
    const full = resolve(ROOT, rel);
    if (!existsSync(full)) continue;
    let raw = readFileSync(full, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  }
  console.error('No content document found.');
  process.exit(1);
}

// The rectangle `object-cover` would keep: fill the target aspect from the
// source, then slide the crop window along the axis with slack by `focus`.
function coverCrop(meta, targetW, targetH, [fx, fy]) {
  const targetAspect = targetW / targetH;
  const sourceAspect = meta.width / meta.height;
  let width;
  let height;
  if (sourceAspect > targetAspect) {
    height = meta.height;
    width = Math.round(meta.height * targetAspect);
  } else {
    width = meta.width;
    height = Math.round(meta.width / targetAspect);
  }
  return {
    left: Math.round((meta.width - width) * fx),
    top: Math.round((meta.height - height) * fy),
    width: Math.min(width, meta.width),
    height: Math.min(height, meta.height),
  };
}

function slugFor(url) {
  return basename(url, extname(url)).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function render(sourceUrl, kind) {
  const abs = resolve(ROOT, 'public', sourceUrl.slice(1));
  const hash = createHash('sha1').update(readFileSync(abs)).digest('hex').slice(0, 8);
  const meta = await sharp(abs).metadata();
  const { token, sizes, focus } = KINDS[kind];
  const out = [];

  for (const [w, h] of sizes) {
    const crop = coverCrop(meta, w, h, focus);
    // fit:'fill' after an explicit extract() — the extract already matches the
    // target aspect exactly, so 'fill' cannot distort and it skips a second
    // aspect negotiation. lanczos3 keeps the 1125w rendition (an upscale from
    // the native crop) from turning mushy.
    const pipeline = sharp(abs).extract(crop).resize(w, h, { fit: 'fill', kernel: 'lanczos3' });
    const stem = `${slugFor(sourceUrl)}-${token}-${w}-${hash}`;
    const files = { avif: `${stem}.avif`, webp: `${stem}.webp`, jpg: `${stem}.jpg` };

    await pipeline.clone().avif(AVIF).toFile(resolve(OUT_DIR, files.avif));
    await pipeline.clone().webp(WEBP).toFile(resolve(OUT_DIR, files.webp));
    await pipeline.clone().jpeg(JPEG).toFile(resolve(OUT_DIR, files.jpg));

    out.push({
      width: w,
      height: h,
      avif: `/img/${files.avif}`,
      webp: `/img/${files.webp}`,
      jpg: `/img/${files.jpg}`,
    });
  }
  return out;
}

const content = loadContent();

// Which crops each content field needs, taken from the slot it renders into.
const JOBS = [
  [content.hero.posterImage, ['heroPortrait', 'heroLandscape']],
  ...content.danceStyles.map((s) => [s.heroImage, ['card']]),
  ...content.studios.flatMap((s) => s.photos.map((p) => [p, ['studio', 'thumb']])),
  ...content.instructors.map((i) => [i.photo, ['avatar']]),
];

mkdirSync(OUT_DIR, { recursive: true });

const manifest = {};
const skipped = [];
let renditions = 0;
let bytesIn = 0;
let avifOut = 0;

for (const [url, kinds] of JOBS) {
  if (typeof url !== 'string' || !url.startsWith('/')) {
    skipped.push(String(url));
    continue;
  }
  const abs = resolve(ROOT, 'public', url.slice(1));
  if (!existsSync(abs)) {
    skipped.push(url);
    continue;
  }
  const firstTouch = manifest[url] === undefined;
  manifest[url] = manifest[url] || {};
  for (const kind of kinds) {
    if (manifest[url][kind]) continue; // same photo reached by two content fields
    const files = await render(url, kind);
    manifest[url][kind] = files;
    renditions += files.length;
    for (const f of files) avifOut += statSync(resolve(ROOT, 'public', f.avif.slice(1))).size;
  }
  if (firstTouch) bytesIn += statSync(abs).size;
}

// Sorted keys so a re-run produces a byte-identical file and a clean git diff.
const sorted = {};
for (const k of Object.keys(manifest).sort()) sorted[k] = manifest[k];
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n', 'utf8');

const onDisk = readdirSync(OUT_DIR).reduce(
  (sum, f) => sum + statSync(resolve(OUT_DIR, f)).size,
  0,
);

const n = (v) => v.toLocaleString('en-US');
console.log(`Wrote ${renditions * 3} files into public/img (${renditions} renditions x 3 formats)`);
console.log(`  sources: ${Object.keys(sorted).length} files, ${n(bytesIn)} B`);
console.log(`  AVIF renditions: ${n(avifOut)} B`);
console.log(`  public/img on disk (all formats): ${n(onDisk)} B`);
console.log(`  manifest: src/data/image-variants.json`);
if (skipped.length) {
  console.log(`  skipped ${skipped.length} sources not on disk (R2-backed uploads):`);
  for (const s of skipped) console.log(`    ${s}`);
}
```

- [ ] **Step 3: Register the npm script**

In `package.json`, find `    "audit:bundle": "node scripts/audit-bundle.mjs",` and insert immediately after it:

```json
    "build:images": "node scripts/build-images.mjs",
```

- [ ] **Step 4: Run the pipeline**

Run: `npm run build:images`

Expected:

```
Wrote 48 files into public/img (16 renditions x 3 formats)
  sources: 8 files, 1,704,199 B
  AVIF renditions: ...
  public/img on disk (all formats): ...
  manifest: src/data/image-variants.json
  skipped 7 sources not on disk (R2-backed uploads):
    /uploads/38ceffc6-7c00-42e0-bec4-ae90c32497c1.png
    /uploads/89b71cb1-a73b-4d37-9f1f-3503dd9224cd.jpg
    /uploads/0f7ca130-b5e9-4ff2-9ba3-997ea34dd11d.png
    /uploads/fa3b45fa-3aef-4eb0-ba30-27e1325845b4.jpg
    /uploads/37ed623f-5b1a-437d-969b-b21927c4a54e.png
    /uploads/5c036ae5-d9c2-48e0-9001-4c8e5f00945f.jpg
    /uploads/3484ba1a-f1dc-482f-bc49-9d1c648f017d.jpg
```

The 16 renditions, itemised so a wrong count is diagnosable:

| source | kinds | renditions |
|---|---|---|
| `/photos/DSC_0166.jpg` (hero poster **and** a studio photo) | heroPortrait ×2, heroLandscape, studio, thumb | 5 |
| `/photos/DSC09730.jpg`, `/photos/DSC09698.jpg`, `/photos/DSC_9973.jpg` | card | 3 |
| `/photos/DSC_0095.jpg` | studio, thumb | 2 |
| `/photos/DSC09776.jpg` | studio, thumb | 2 |
| `/photos/rishikesh.png` | avatar ×2 | 2 |
| `/photos/aditya.jpg` | avatar ×2 | 2 |
| | | **16** |

`sources: 8 files, 1,704,199 B` is the six home-route photos (1,439,398 B) plus `rishikesh.png` (227,331 B) and `aditya.jpg` (37,470 B) — 1,439,398 + 227,331 + 37,470 = 1,704,199. It excludes `/logo-mark.png`, which Task 1 counts as a home-route request but which gets no renditions here. If the source count is not 8 or the rendition count is not 16, STOP — the content document has drifted and Task 5's manifest guard will fail.

- [ ] **Step 5: Verify the LCP rendition hits the spec's gate**

Run:

```bash
node -e "const{statSync,readdirSync}=require('fs');for(const f of readdirSync('public/img').filter(f=>f.includes('hero-portrait-750')).sort())console.log(f, statSync('public/img/'+f).size)"
```

Expected: three lines — `.avif`, `.jpg`, `.webp` for `dsc-0166-hero-portrait-750-<hash>`.

The `.avif` **must be under 45,000 B** (spec §7.5's LCP gate). Spec §7.2 measured 40,488 B for this crop at q50; the exact byte count varies with the local libvips build and the `effort: 4` setting, so anything in the 30,000–45,000 B band is expected. The `.webp` lands around 58,000 B and the `.jpg` around 91,000 B.

If the AVIF is over 45,000 B, drop `AVIF.quality` from 50 to 45 and re-run — do not ship over the gate. Record the actual byte count; Task 6 Step 8 and Task 14 Step 3 both reference it.

- [ ] **Step 6: Record the repository cost of the unwired variants**

Run:

```bash
node -e "const{statSync,readdirSync}=require('fs');const all=readdirSync('public/img');const used=all.filter(f=>f.includes('hero-portrait')||f.includes('hero-landscape'));const b=fs=>fs.reduce((s,f)=>s+statSync('public/img/'+f).size,0);console.log('files',all.length,'bytes',b(all).toLocaleString());console.log('wired by Task 6:',used.length,'files',b(used).toLocaleString(),'B');console.log('emitted, unreferenced:',all.length-used.length,'files',(b(all)-b(used)).toLocaleString(),'B')"
```

Expected: `files 48`, `wired by Task 6: 9 files`, `emitted, unreferenced: 39 files`. Record all three numbers in the completion note — this is the honest price of emitting M1 in full ahead of the markup follow-up, and it is repository/deploy weight only, never visitor bytes.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-images.mjs package.json package-lock.json public/img src/data/image-variants.json
git commit -m "feat: build-time avif/webp/jpeg image pipeline with a committed variant manifest"
```

---

### Task 5: The variant resolver

**Files:**
- Create: `src/lib/image-variants.ts`
- Test: `src/lib/image-variants.test.ts` (new file, 8 tests)

**Interfaces:**
- Consumes: `src/data/image-variants.json` from Task 4
- Produces:
  ```ts
  export interface VariantFile { width: number; height: number; avif: string; webp: string; jpg: string }
  export type VariantKind = 'heroPortrait' | 'heroLandscape' | 'card' | 'studio' | 'thumb' | 'avatar';
  export type VariantManifest = Record<string, Partial<Record<VariantKind, VariantFile[]>>>;
  export const IMAGE_VARIANTS: VariantManifest;
  export function variantsFor(src: string, kind: VariantKind, manifest?: VariantManifest): VariantFile[];
  export function srcSetFor(files: VariantFile[], format: 'avif' | 'webp' | 'jpg'): string;
  export interface HeroPoster {
    portrait: { avif: string; webp: string; jpg: string; jpgSrc: string };
    landscape: { avif: string; webp: string; jpg: string };
  }
  export function heroPoster(src: string, manifest?: VariantManifest): HeroPoster | null;
  ```
  Task 6 calls `heroPoster` from `src/app/page.tsx` (a server component) and passes the result to `<Hero>`, which keeps the manifest JSON out of the client bundle.

- [ ] **Step 1: Write the failing test**

Create `src/lib/image-variants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { heroPoster, srcSetFor, variantsFor, type VariantManifest } from './image-variants';
import seedContent from '@/data/site-content.seed.json';

const fixture: VariantManifest = {
  '/photos/A.jpg': {
    heroPortrait: [
      { width: 750, height: 1380, avif: '/img/a-hp-750-aa.avif', webp: '/img/a-hp-750-aa.webp', jpg: '/img/a-hp-750-aa.jpg' },
      { width: 1125, height: 2070, avif: '/img/a-hp-1125-aa.avif', webp: '/img/a-hp-1125-aa.webp', jpg: '/img/a-hp-1125-aa.jpg' },
    ],
    heroLandscape: [
      { width: 1080, height: 721, avif: '/img/a-hl-1080-aa.avif', webp: '/img/a-hl-1080-aa.webp', jpg: '/img/a-hl-1080-aa.jpg' },
    ],
  },
  '/photos/B.jpg': {
    card: [
      { width: 750, height: 938, avif: '/img/b-card-750-bb.avif', webp: '/img/b-card-750-bb.webp', jpg: '/img/b-card-750-bb.jpg' },
    ],
  },
};

describe('variantsFor', () => {
  it('returns the renditions recorded for a source and kind', () => {
    expect(variantsFor('/photos/A.jpg', 'heroPortrait', fixture).map((f) => f.width)).toEqual([
      750, 1125,
    ]);
  });

  it('returns an empty list for a source the manifest has never seen', () => {
    expect(variantsFor('/uploads/never-built.png', 'avatar', fixture)).toEqual([]);
  });

  it('returns an empty list for a kind that source has no renditions for', () => {
    expect(variantsFor('/photos/B.jpg', 'heroPortrait', fixture)).toEqual([]);
  });
});

describe('srcSetFor', () => {
  it('joins width descriptors in manifest order', () => {
    expect(srcSetFor(variantsFor('/photos/A.jpg', 'heroPortrait', fixture), 'avif')).toBe(
      '/img/a-hp-750-aa.avif 750w, /img/a-hp-1125-aa.avif 1125w',
    );
  });

  it('returns an empty string when there are no renditions', () => {
    expect(srcSetFor([], 'webp')).toBe('');
  });
});

describe('heroPoster', () => {
  it('builds the portrait and landscape source sets the <picture> needs', () => {
    expect(heroPoster('/photos/A.jpg', fixture)).toEqual({
      portrait: {
        avif: '/img/a-hp-750-aa.avif 750w, /img/a-hp-1125-aa.avif 1125w',
        webp: '/img/a-hp-750-aa.webp 750w, /img/a-hp-1125-aa.webp 1125w',
        jpg: '/img/a-hp-750-aa.jpg 750w, /img/a-hp-1125-aa.jpg 1125w',
        jpgSrc: '/img/a-hp-750-aa.jpg',
      },
      landscape: {
        avif: '/img/a-hl-1080-aa.avif 1080w',
        webp: '/img/a-hl-1080-aa.webp 1080w',
        jpg: '/img/a-hl-1080-aa.jpg 1080w',
      },
    });
  });

  it('returns null when a poster has no built crops, so the caller can fall back', () => {
    // The real case: an admin uploads a new hero photo and nobody re-runs
    // `npm run build:images`. Hero must render the raw upload, not nothing.
    expect(heroPoster('/uploads/brand-new.jpg', fixture)).toBe(null);
  });
});

describe('the shipped manifest', () => {
  it('still covers the seed hero poster in both crops', () => {
    // Guard, not coverage: this is the test that fails when someone changes
    // the hero photo without re-running the image pipeline.
    const src = seedContent.hero.posterImage;
    expect(variantsFor(src, 'heroPortrait').length).toBe(2);
    expect(variantsFor(src, 'heroLandscape').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/image-variants.test.ts`

Expected: FAIL with `Failed to resolve import "./image-variants" from "src/lib/image-variants.test.ts"`.

- [ ] **Step 3: Write the resolver**

Create `src/lib/image-variants.ts`:

```ts
import manifest from '@/data/image-variants.json';

/** One rendition: the same crop at one width, in all three formats. */
export interface VariantFile {
  width: number;
  height: number;
  avif: string;
  webp: string;
  jpg: string;
}

/** The crop shapes `scripts/build-images.mjs` knows how to emit. */
export type VariantKind =
  | 'heroPortrait'
  | 'heroLandscape'
  | 'card'
  | 'studio'
  | 'thumb'
  | 'avatar';

export type VariantManifest = Record<string, Partial<Record<VariantKind, VariantFile[]>>>;

// Generated by `npm run build:images` and committed. Import it from SERVER
// components only — it is 8 entries of pure strings and has no business in a
// client bundle that is already fighting a 12 KB app-JS budget.
export const IMAGE_VARIANTS = manifest as unknown as VariantManifest;

export function variantsFor(
  src: string,
  kind: VariantKind,
  m: VariantManifest = IMAGE_VARIANTS,
): VariantFile[] {
  return m[src]?.[kind] ?? [];
}

export function srcSetFor(files: VariantFile[], format: 'avif' | 'webp' | 'jpg'): string {
  return files.map((f) => `${f[format]} ${f.width}w`).join(', ');
}

/** The six source sets a hand-written hero <picture> needs. */
export interface HeroPoster {
  portrait: { avif: string; webp: string; jpg: string; jpgSrc: string };
  landscape: { avif: string; webp: string; jpg: string };
}

/**
 * Null means "this poster has no pre-built crops" — an admin-uploaded photo
 * the build script has never seen. Callers must fall back to rendering the raw
 * `src`; a missing hero is far worse than an unoptimized one.
 */
export function heroPoster(src: string, m: VariantManifest = IMAGE_VARIANTS): HeroPoster | null {
  const portrait = variantsFor(src, 'heroPortrait', m);
  const landscape = variantsFor(src, 'heroLandscape', m);
  if (portrait.length === 0 || landscape.length === 0) return null;
  return {
    portrait: {
      avif: srcSetFor(portrait, 'avif'),
      webp: srcSetFor(portrait, 'webp'),
      jpg: srcSetFor(portrait, 'jpg'),
      jpgSrc: portrait[0].jpg,
    },
    landscape: {
      avif: srcSetFor(landscape, 'avif'),
      webp: srcSetFor(landscape, 'webp'),
      jpg: srcSetFor(landscape, 'jpg'),
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/image-variants.test.ts`

Expected: PASS — `Test Files 1 passed (1)`, `Tests 8 passed (8)`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image-variants.ts src/lib/image-variants.test.ts
git commit -m "feat: pure resolver from the image manifest to picture source sets"
```

---

### Task 6: Hand-written `<picture>` hero, honest priority hints, and the ten dead `sizes` props

Spec §7.1 finding 1: `generateImgAttrs` in `next/dist/shared/lib/get-img-props.js` returns early when `unoptimized` is set, discarding `srcSet` **and** `sizes` before either reaches the element. There are exactly **10** `sizes=` occurrences in `src/`: **7 on public surfaces** (`Hero.tsx:45`, `PhotoCarousel.tsx:39`, `page.tsx:127`, `page.tsx:406`, `dance-styles/[slug]/page.tsx:69`, `dance-styles/page.tsx:60`, `instructors/page.tsx:73`), **2 in the admin** (`ImageUploader.tsx:59`, `:197`) and **1 pass-through prop** (`Img.tsx:47`). All ten are dead code.

**Files:**
- Modify: `src/components/Img.tsx` (anchors: `  sizes?: string;`, `  sizes,`, `        sizes={sizes}`)
- Modify: `src/components/Hero.tsx` (anchors: the `import { Img } from './Img';` line, `export function Hero({ content }: { content: SiteContent }) {`, and the `<Img` element whose first prop is `src={content.hero.posterImage}`)
- Modify: `src/app/page.tsx` (anchors: `import { fitDescription, fitTitle } from '@/lib/seo';`, `      <Hero content={content} />`, and the two `sizes=` lines)
- Modify: `src/components/BrandMark.tsx` (anchor: `        priority`)
- Modify: `src/components/PhotoCarousel.tsx`, `src/app/instructors/page.tsx`, `src/app/dance-styles/page.tsx`, `src/app/dance-styles/[slug]/page.tsx`, `src/components/admin/ImageUploader.tsx` (anchors: each file's exact `sizes=` line, quoted in Step 3)
- Test: `npm run typecheck` is the mechanical test for the `sizes` removal; the `<picture>` is verified in the browser. **No automated regression cover for the markup.**

**Interfaces:**
- Consumes: `heroPoster(src)` and `type HeroPoster` from Task 5; `content.hero.posterAlt` (added by Plan 1)
- Produces: `<Hero content={content} poster={HeroPoster | null} />` — a new required prop on `Hero`

**Anchoring note (R1).** Plan 1 has already edited `Hero.tsx`: `hero.posterAlt` is in `HeroSchema` and the `<Img>`'s `alt` already reads `{content.hero.posterAlt}`. This task therefore anchors on `src={content.hero.posterImage}` (unchanged by Plan 1 and unique in the file), **not** on the alt text and **not** on line numbers. Do **not** introduce a module-level `POSTER_ALT` constant: both the `<img alt>` and the fallback `<Img alt>` must keep reading `content.hero.posterAlt`, or the field is editable in `/admin/hero` and changes nothing.

- [ ] **Step 1: Delete the `sizes` prop from `Img` and let typecheck find every call site**

In `src/components/Img.tsx`, find the exact text:

```ts
  /** Required when used with fill layout's parent — passes through. */
  fill?: boolean;
  sizes?: string;
```

and replace it with:

```ts
  /** Required when used with fill layout's parent — passes through. */
  fill?: boolean;
  // No `sizes`: next.config.mjs sets images.unoptimized, and Next's
  // generateImgAttrs returns before srcSet/sizes reach the element under that
  // flag. A `sizes` prop here is dead weight that reads like responsive
  // loading is happening when it is not (spec §7.1).
```

Then delete the destructured parameter — find the exact line `  sizes,` (inside the `export function Img({` parameter list) and remove it entirely.

Then delete the pass-through — find the exact line `        sizes={sizes}` and remove it entirely.

- [ ] **Step 2: Run typecheck to enumerate the dead props**

Run: `npm run typecheck`

Expected: FAIL with one error per `<Img sizes=…>` call site, each reading
`Property 'sizes' does not exist on type 'IntrinsicAttributes & Props'.`
at exactly these seven locations (line numbers will have shifted if Plan 1 touched a file — match on the file, not the line):

- `src/components/Hero.tsx` (resolved in Step 5, not Step 3)
- `src/components/PhotoCarousel.tsx`
- `src/app/page.tsx` (×2)
- `src/app/instructors/page.tsx`
- `src/app/dance-styles/page.tsx`
- `src/app/dance-styles/[slug]/page.tsx`

If a file appears that is not on this list, STOP and report — a plan running before this one added a new `<Img sizes=…>`.

- [ ] **Step 3: Delete every dead `sizes` prop**

Delete each of these exact lines, with its trailing newline, leaving no blank line behind. Each string is unique within its file:

| File | Exact line to delete |
|---|---|
| `src/components/PhotoCarousel.tsx` | `              sizes="(min-width: 1024px) 512px, (min-width: 640px) 432px, 320px"` |
| `src/app/page.tsx` | `                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"` |
| `src/app/page.tsx` | `                            sizes="(max-width: 768px) 100vw, 33vw"` |
| `src/app/instructors/page.tsx` | `                    sizes="120px"` |
| `src/app/dance-styles/page.tsx` | `                  sizes="(max-width: 768px) 100vw, 33vw"` |
| `src/app/dance-styles/[slug]/page.tsx` | `            sizes="100vw"` |
| `src/components/admin/ImageUploader.tsx` | `              sizes="160px"` |
| `src/components/admin/ImageUploader.tsx` | `                    sizes="(max-width: 768px) 50vw, 25vw"` |

The last two sit on raw `next/image` elements rather than `<Img>`, so typecheck does not flag them — delete them by hand. Together with the `Img.tsx` pass-through (Step 1) and `Hero.tsx`'s (removed wholesale in Step 5), that is all ten.

Verify nothing is left:

```bash
grep -rn "sizes=" src/ ; echo "exit=$?"
```

Expected after Step 5: no matches and `exit=1`. At this point (before Step 5) exactly one match remains — `src/components/Hero.tsx`.

- [ ] **Step 4: Remove the competing `priority` on the logo**

In `src/components/BrandMark.tsx`, find the exact text:

```tsx
      <Image
        src="/logo-mark.png"
        alt={ariaLabel}
        width={width}
        height={height}
        priority
```

and replace it with:

```tsx
      {/* No `priority`: it emits a preload that competes with the hero's own
          LCP preload for the first connection, for a 14,837 B logo that is
          never the LCP element (spec §7.3 M2). */}
      <Image
        src="/logo-mark.png"
        alt={ariaLabel}
        width={width}
        height={height}
```

- [ ] **Step 5: Replace the hero `<Img>` with a hand-written `<picture>`**

In `src/components/Hero.tsx`, find the exact line:

```ts
import { Img } from './Img';
```

and replace it with:

```ts
import type { HeroPoster } from '@/lib/image-variants';
import { Img } from './Img';
```

Then find the exact line:

```ts
export function Hero({ content }: { content: SiteContent }) {
```

and replace it with:

```ts
export function Hero({ content, poster }: { content: SiteContent; poster: HeroPoster | null }) {
```

Then find the `<Img` element whose first prop is `src={content.hero.posterImage}` — it is the only one in this file, it sits directly inside `<div className="relative h-full w-full">` (currently around :35–49), and Plan 1 has already changed its `alt` to `{content.hero.posterAlt}`. Replace that whole element, from its opening `<Img` through its self-closing `/>`, with:

```tsx
          {poster ? (
            <>
              {/* Preload the LCP image by hand. A bare AVIF preload would be
                  wasted on a browser that ends up picking WebP, so each one
                  carries the same `type` and `media` the matching <source>
                  does — the browser skips a preload whose type it cannot
                  decode and falls through to the <picture> negotiation. */}
              <link
                rel="preload"
                as="image"
                type="image/avif"
                media="(max-width: 639px)"
                imageSrcSet={poster.portrait.avif}
                imageSizes="100vw"
                fetchPriority="high"
              />
              <link
                rel="preload"
                as="image"
                type="image/avif"
                media="(min-width: 640px)"
                imageSrcSet={poster.landscape.avif}
                imageSizes="100vw"
                fetchPriority="high"
              />
              {/* Order is load-bearing: a browser takes the FIRST <source>
                  whose media and type it supports, and the <img> is the last
                  resort — so every <source> must precede it, media-constrained
                  ones first. The portrait crop exists because the render box is
                  375x690 CSS px (aspect 0.543) against a 1.498 source:
                  object-cover throws away 63.7% of the width, and a
                  purpose-built crop stops paying for pixels never on screen. */}
              <picture>
                <source media="(min-width: 640px)" type="image/avif" srcSet={poster.landscape.avif} sizes="100vw" />
                <source media="(min-width: 640px)" type="image/webp" srcSet={poster.landscape.webp} sizes="100vw" />
                <source media="(min-width: 640px)" srcSet={poster.landscape.jpg} sizes="100vw" />
                <source type="image/avif" srcSet={poster.portrait.avif} sizes="100vw" />
                <source type="image/webp" srcSet={poster.portrait.webp} sizes="100vw" />
                <img
                  src={poster.portrait.jpgSrc}
                  srcSet={poster.portrait.jpg}
                  sizes="100vw"
                  // Reads the editable field, never a local constant: the alt
                  // is admin-owned copy (spec §4.4) and a module-level default
                  // would strand hero.posterAlt in the schema forever.
                  alt={content.hero.posterAlt}
                  fetchPriority="high"
                  decoding="async"
                  // No width/height: the parent is absolute inset-0 and CSS
                  // sizes both axes, so the intrinsic ratio never reaches
                  // layout and a landscape source cannot shift anything.
                  // On portrait phones the subject sits hard right so it is not
                  // permanently buried under the text block.
                  className="photo absolute inset-0 h-full w-full object-cover object-[78%_38%] sm:object-[center_30%] animate-kenburns"
                />
              </picture>
            </>
          ) : (
            // The poster was replaced in the admin and `npm run build:images`
            // has not been re-run. Serve the raw upload rather than nothing.
            <Img
              src={content.hero.posterImage}
              alt={content.hero.posterAlt}
              seed="hero"
              label=""
              fill
              priority
              className="object-cover object-[78%_38%] sm:object-[center_30%] animate-kenburns"
            />
          )}
```

**These `sizes` attributes are not the dead ones.** On a raw `<source>`/`<img>` the browser honours `sizes` directly; the ten deleted props were on `next/image`, which discards them under `unoptimized`.

- [ ] **Step 6: Resolve the poster on the server and pass it down**

In `src/app/page.tsx`, find the exact line:

```ts
import { fitDescription, fitTitle } from '@/lib/seo';
```

and replace it with:

```ts
import { fitDescription, fitTitle } from '@/lib/seo';
import { heroPoster } from '@/lib/image-variants';
```

Then find the exact line:

```tsx
      <Hero content={content} />
```

and replace it with:

```tsx
      {/* Resolved here, not inside Hero: Hero is a client component, and
          importing the variant manifest there would ship it in the client
          bundle for no reason. */}
      <Hero content={content} poster={heroPoster(content.hero.posterImage)} />
```

- [ ] **Step 7: Verify the build compiles and the picture negotiates correctly**

Run: `npm run typecheck`
Expected: PASS with no output.

Run: `grep -rn "sizes=" src/components/Img.tsx src/components/Hero.tsx src/app/page.tsx`
Expected: only the six `<source>`/`<img>` matches inside `Hero.tsx`'s `<picture>`. No match in `Img.tsx`, none in `page.tsx`.

Run `npm run dev` and open `http://localhost:3000` with DevTools docked, device toolbar at **375 × 667**, throttling off, then run in the console:

```js
const img = document.querySelector('section picture img');
JSON.stringify({
  chosen: img.currentSrc,
  natural: img.naturalWidth + 'x' + img.naturalHeight,
  alt: img.alt,
  preloads: [...document.head.querySelectorAll('link[rel=preload][as=image]')].map(l => l.media),
  brandPreload: !!document.head.querySelector('link[rel=preload][href*="logo-mark"]'),
}, null, 2)
```

Expected exactly:
- `chosen` ends in `hero-portrait-750-<hash>.avif` (Chrome/Edge/Firefox) — **not** `.jpg`, **not** `DSC_0166.jpg`
- `natural` is `750x1380`
- `alt` equals the current value of `hero.posterAlt` in `/admin/hero` — change it there, save, reload, and confirm the DOM follows. If it does not, `POSTER_ALT` crept back in.
- `preloads` is `["(max-width: 639px)", "(min-width: 640px)"]` — both hoisted into `<head>`. If this array is empty, React did not hoist the `<link>` elements and the task is not done.
- `brandPreload` is `false` (the `priority` removal landed)

Then resize the device toolbar to **1280 × 800**, reload, and re-run: `chosen` must end in `hero-landscape-1080-<hash>.avif` and `natural` must be `1080x721`.

Finally, with the Network tab filtered to `Img` and a hard reload at 375 × 667, confirm `DSC_0166.jpg` is **not** requested.

- [ ] **Step 8: Re-run the audit and record the new home weight**

Run: `npm run audit:images`

Expected: **unchanged** — still `7 requests, 1,454,235 B` and `LCP resource: 297,280 B ... FAIL`. That is correct, not a failure: the script measures what the **content document** points at, and the hero field still points at the master. The real change is what the browser fetches.

Measure that in DevTools: hard reload at **375 × 667**, Network tab filtered to `Img`, and record the transfer total. Expected ≈ **1,197,400 B** (1,454,235 − 297,280 + the Task 4 Step 5 AVIF byte count), a **≈17.7%** reduction, all of it in the LCP element which drops **≈87%**. Record the actual against the AVIF size you recorded in Task 4 Step 5; the two must reconcile.

- [ ] **Step 9: Commit**

```bash
git add src/components/Hero.tsx src/components/Img.tsx src/components/BrandMark.tsx src/components/PhotoCarousel.tsx src/components/admin/ImageUploader.tsx src/app/page.tsx src/app/instructors/page.tsx src/app/dance-styles/page.tsx "src/app/dance-styles/[slug]/page.tsx"
git commit -m "perf: hand-written picture element for the hero, drop ten dead sizes props"
```

---

### Task 7: The mobile header and footer social row (M3 / spec §6.1)

Must land before any social icon ships, or the primary surface scrolls sideways. `container-x` is `px-5` → **335 px of content at 375 px**. Three 44px targets with `gap-2` cost `3 × (44 + 8) = 156px` → **412px needed against 335px available**: over by 77px at 375px and **92px at 360px**, the dominant Android width in this market. Nothing in the ancestor chain sets `overflow-x`, so the result is a horizontally scrolling page, not a clipped one.

**Files:**
- Create: `src/components/SocialIcons.tsx`
- Modify: `src/components/Header.tsx` (anchors: `import { ThemeToggle } from './ThemeToggle';`, the `customNavItems` assignment's closing `    .map((p) => ({ label: p.navLabel || p.title, href: \`/p/${p.slug}\` }));`, the `<div className="ml-auto lg:ml-0 flex shrink-0 items-center gap-2 sm:gap-3">` cluster, and the drawer's `<div className="container-x py-4 space-y-1">`)
- Modify: `src/components/Footer.tsx` (anchors: `import { BrandMark } from './BrandMark';`, and the `<div className="mt-6 flex items-center gap-4 text-sm text-cream/70">` block)
- Test: manual — exact widths and a no-horizontal-scroll assertion at three viewport widths. **This task ships with ZERO automated regression cover.** Nothing in the suite renders a component, so nothing will catch a future edit that pushes the header back over 335px. The DevTools check in Step 7 is the entire guard, and Task 14 Step 4 re-runs it.

**Interfaces:**
- Consumes: `content.site.socials.{instagram,facebook,youtube}` (already in `SiteSettingsSchema`), `content.site.whatsappNumber`, `buildWhatsAppHref` from `@/lib/enquiry` (already imported in `Footer.tsx`), and `label` + `content.labels` from Plan 1
- Produces: `InstagramIcon`, `FacebookIcon`, `YouTubeIcon`, `WhatsAppIcon` — zero-prop components returning a 22×22 `<svg aria-hidden>` drawn in `currentColor`

- [ ] **Step 1: Preflight — confirm Plan 1 shipped the six label keys**

This task consumes six keys and **must not add any**: Plan 1's `labels.test.ts` pins `Object.keys(LABEL_DEFAULTS).length`, so adding one here turns that test red in a file this plan does not own.

Run:

```bash
grep -o "ariaToggleMenu\|ariaMenu\|ariaSocialInstagram\|ariaSocialFacebook\|ariaSocialYoutube\|ariaSocialWhatsapp" src/lib/content-schema.ts | wc -l
```

Expected: `6`.

**Grep the schema, not `labels.ts`.** Plan 1 declares the keys inside `LabelsSchema` in `src/lib/content-schema.ts`; `src/lib/labels.ts` derives `LABEL_DEFAULTS` from `LabelsSchema.parse({})` and names no key literally, so grepping `labels.ts` returns `0` and would hard-stop this task on a false negative. Use `grep -o … | wc -l`, which counts **matches**, not `grep -c`, which counts matching **lines** — the count then stays correct however Plan 1 formats the schema (two keys on one line, or a key named twice).

If it is fewer than 6, **STOP and report** which keys are missing. Do not invent them, do not fall back to a hardcoded string, and do not add them to `LABEL_DEFAULTS` — resolving the gap is a change to Plan 1's contract and needs a decision, not a workaround.

Also confirm the consumption signature Plan 1 established:

```bash
grep -n "label(content.labels" src/components/Header.tsx | head -3
```

Expected: at least one match (Plan 1 converted the burger's `aria-label`). Use that exact call shape throughout this task.

- [ ] **Step 2: Create the icon set**

Create `src/components/SocialIcons.tsx`:

```tsx
// Inline SVG, ~250 B gzipped each: no requests, no client JS, sharp at every
// DPR, and they inherit the surrounding text colour so both themes work with
// no second asset. Every icon is aria-hidden — the link around it carries the
// accessible name, which comes from `labels` and is editable in /admin/labels.

export function InstagramIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M14 8.5V7.2c0-.6.4-.8.7-.8H16V4h-2.1C11.6 4 11 5.5 11 6.8v1.7H9.5V11H11v9h3v-9h2.1l.4-2.5H14Z" />
    </svg>
  );
}

export function YouTubeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  );
}

export function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.9a8.1 8.1 0 1 1-4.2 15l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 0 1 12 3.9Zm-3.1 4c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.2 0 1.3.9 2.5 1 2.7.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3l-1.8-.9c-.3-.1-.5-.1-.7.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5 0-.2 0-.3-.1-.5l-.8-1.8c-.2-.4-.4-.4-.6-.4h-.5Z" />
    </svg>
  );
}
```

- [ ] **Step 3: Import the icons and the label helper into Header**

In `src/components/Header.tsx`, find the exact line:

```ts
import { ThemeToggle } from './ThemeToggle';
```

and replace it with:

```ts
import { ThemeToggle } from './ThemeToggle';
import { FacebookIcon, InstagramIcon, YouTubeIcon } from './SocialIcons';
```

`label` is already imported by Plan 1 (Step 1 confirmed a `label(content.labels` call exists). If for any reason it is not, STOP — Step 1's preflight was not honoured.

Then add the `SocialLink` type at module scope. Find the exact line:

```ts
export function Header({ content }: { content: SiteContent }) {
```

and replace it with:

```ts
interface SocialLink {
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function Header({ content }: { content: SiteContent }) {
```

- [ ] **Step 4: Build the social link list**

In `src/components/Header.tsx`, find the exact line that ends the `customNavItems` assignment:

```ts
    .map((p) => ({ label: p.navLabel || p.title, href: `/p/${p.slug}` }));
```

and replace it with:

```ts
    .map((p) => ({ label: p.navLabel || p.title, href: `/p/${p.slug}` }));

  // Each icon renders only when its URL is set — the stored YouTube URL is
  // unverified (spec decision #6), and an icon that 404s is worse than one
  // that is absent. Accessible names come from `labels`, never from a literal:
  // "every user-visible string editable" includes the ones only a screen
  // reader hears.
  const socials: SocialLink[] = [];
  if (content.site.socials.instagram) {
    socials.push({
      id: 'instagram',
      href: content.site.socials.instagram,
      label: label(content.labels, 'ariaSocialInstagram'),
      icon: <InstagramIcon />,
    });
  }
  if (content.site.socials.facebook) {
    socials.push({
      id: 'facebook',
      href: content.site.socials.facebook,
      label: label(content.labels, 'ariaSocialFacebook'),
      icon: <FacebookIcon />,
    });
  }
  if (content.site.socials.youtube) {
    socials.push({
      id: 'youtube',
      href: content.site.socials.youtube,
      label: label(content.labels, 'ariaSocialYoutube'),
      icon: <YouTubeIcon />,
    });
  }
  const iconClass =
    'inline-flex h-11 w-11 items-center justify-center rounded-full text-cream/80 transition hover:bg-cream/5 hover:text-cream';
```

- [ ] **Step 5: Rebuild the right-hand cluster**

In `src/components/Header.tsx`, find the element that opens with the exact line:

```tsx
        <div className="ml-auto lg:ml-0 flex shrink-0 items-center gap-2 sm:gap-3">
```

and replace that element in full — from that opening tag through its matching `</div>` (it currently contains `<ThemeToggle />` and the burger `<button>` carrying `aria-expanded={open}`) — with:

```tsx
        {/* Mobile budget, measured at 375px against 335px of container-x
            content width: BrandMark 156 + gap-3 12 + Instagram 44 + gap-2 8 +
            burger 44 = 264. Three 44px social targets would need 412 and turn
            the primary surface into a horizontally scrolling page (spec §6.1).
            Desktop has the room, so it keeps all three inline. */}
        <div className="ml-auto lg:ml-0 flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-1">
            {socials.map((s) => (
              <a
                key={s.id}
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                className={iconClass}
              >
                {s.icon}
              </a>
            ))}
          </div>
          {/* Wrapped rather than given `hidden lg:inline-flex` directly: the
              toggle's own class string already sets inline-flex, and which of
              two display utilities wins would depend on Tailwind's internal
              ordering. A wrapper makes it unambiguous. */}
          <span className="hidden lg:inline-flex">
            <ThemeToggle />
          </span>
          {/* Instagram alone below lg. It is the traffic source, and the one
              link a visitor who arrived from a Reel uses to check the school is
              real before paying. */}
          {content.site.socials.instagram ? (
            <a
              href={content.site.socials.instagram}
              aria-label={label(content.labels, 'ariaSocialInstagram')}
              target="_blank"
              rel="noopener noreferrer"
              className={`lg:hidden ${iconClass}`}
            >
              <InstagramIcon />
            </a>
          ) : null}
          {/* h-11 w-11 p-0: `p-0` is a utility and beats .btn-ghost's @apply'd
              px-4 py-2 (components layer). The burger was 38px — under the 44px
              touch minimum, and it is one of only two controls up here. */}
          <button
            type="button"
            className="lg:hidden btn-ghost h-11 w-11 p-0"
            aria-label={label(content.labels, 'ariaToggleMenu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{label(content.labels, 'ariaMenu')}</span>
            <Burger open={open} />
          </button>
        </div>
```

- [ ] **Step 6: Add the social row and the theme toggle to the drawer**

In `src/components/Header.tsx`, find the drawer container's opening tag:

```tsx
          <div className="container-x py-4 space-y-1">
```

and insert the following block immediately **before** the `</div>` that closes it — i.e. after the `customNavItems.map(...)` expression that is currently its last child:

```tsx
            {/* 3 x 44 + 2 x 12 = 156px inside a 335px drawer — 179px spare.
                ThemeToggle lives here rather than in the bar because
                layout.tsx already runs a pre-paint script honouring
                prefers-color-scheme, so a system-mode visitor is served
                correctly without ever opening this.
                Rendered unconditionally, not gated on socials.length: the
                theme toggle must stay reachable even when no social URL is
                set, and an empty flex row costs nothing. */}
            <div className="flex items-center gap-3 border-t border-cream/10 pt-4">
              {socials.map((s) => (
                <a
                  key={s.id}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 text-cream/80 transition hover:border-ember-500/60 hover:text-cream"
                >
                  {s.icon}
                </a>
              ))}
              <span className="ml-auto">
                <ThemeToggle />
              </span>
            </div>
```

- [ ] **Step 7: Mirror the row in the footer and add the missing WhatsApp link**

In `src/components/Footer.tsx`, find the exact line:

```ts
import { BrandMark } from './BrandMark';
```

and replace it with:

```ts
import { BrandMark } from './BrandMark';
import { FacebookIcon, InstagramIcon, WhatsAppIcon, YouTubeIcon } from './SocialIcons';
```

`label` is imported here already by Plan 1 (it converted the footer's link labels). Confirm with `grep -n "from '@/lib/labels'" src/components/Footer.tsx` — expected: one match. If there is none, STOP; Step 1's preflight was not honoured.

Then find the element opening with the exact line:

```tsx
            <div className="mt-6 flex items-center gap-4 text-sm text-cream/70">
```

and replace that element in full — from that opening tag through its matching `</div>` (it currently holds the three text links Instagram / Facebook / YouTube) — with:

```tsx
            {/* Mirrors the burger drawer's row so the channels are reachable
                from the top and the bottom of every page. WhatsApp was missing
                here despite buildWhatsAppHref already being imported at the top
                of this file — the one channel this business converts on. */}
            <div className="mt-6 flex items-center gap-3 text-cream/70">
              {content.site.socials.instagram ? (
                <a
                  aria-label={label(content.labels, 'ariaSocialInstagram')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 transition hover:border-ember-500/60 hover:text-cream"
                  href={content.site.socials.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <InstagramIcon />
                </a>
              ) : null}
              {content.site.socials.facebook ? (
                <a
                  aria-label={label(content.labels, 'ariaSocialFacebook')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 transition hover:border-ember-500/60 hover:text-cream"
                  href={content.site.socials.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FacebookIcon />
                </a>
              ) : null}
              {content.site.socials.youtube ? (
                <a
                  aria-label={label(content.labels, 'ariaSocialYoutube')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 transition hover:border-ember-500/60 hover:text-cream"
                  href={content.site.socials.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <YouTubeIcon />
                </a>
              ) : null}
              <a
                aria-label={label(content.labels, 'ariaSocialWhatsapp')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 transition hover:border-ember-500/60 hover:text-cream"
                href={buildWhatsAppHref(content.site.whatsappNumber, { source: 'footer' })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon />
              </a>
            </div>
```

**Forward dependency, record it in the completion note:** this adds a **new** `buildWhatsAppHref` call site. Plan 4 (`2026-08-10-editability-backfill.md`) makes `buildWhatsAppHref` take a third argument for editable templates; its call-site list must include this one, or `npm run typecheck` there reports `Expected 3 arguments, but got 2.` here.

- [ ] **Step 8: Verify the arithmetic and the absence of horizontal scroll**

Run: `npm run typecheck`
Expected: PASS with no output.

Run `npm run dev`, open `http://localhost:3000`, DevTools device toolbar. At each of **360 × 640**, **375 × 667** and **390 × 844**, run in the console:

```js
const bar = document.querySelector('header .container-x');
const kids = [...bar.children].map(k => [k.tagName, Math.round(k.getBoundingClientRect().width)]);
const targets = [...bar.querySelectorAll('a[aria-label], button[aria-label]')]
  .map(e => [e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]);
JSON.stringify({
  containerWidth: Math.round(bar.getBoundingClientRect().width),
  kids,
  targets,
  fortyFours: targets.filter(t => t[1] === 44 && t[2] === 44).length,
  noHScroll: document.documentElement.scrollWidth === window.innerWidth,
}, null, 2)
```

Expected at **375 × 667**:
- `containerWidth` is `335`
- `kids` contains an `A` (the brand link) of width `156`
- `fortyFours` is exactly `2` — the Instagram link and the burger. Their `aria-label` **text** is whatever `/admin/labels` currently holds for `ariaSocialInstagram` and `ariaToggleMenu`; do not assert on the strings, assert on the geometry.
- `noHScroll` is `true`

Hand check: `156 (brand) + 12 (parent gap-3, the minimum separation) + 44 (Instagram) + 8 (cluster gap-2) + 44 (burger) = 264` against 335 available — **71px of slack**, against 256/79px before. `noHScroll` must be `true` at all three widths. If it is `false` at **360**, STOP — the icon or the burger has grown past its box and shipping it turns the primary surface into a sideways-scrolling page.

Then open the burger and run:

```js
const drawer = document.querySelector('header .lg\\:hidden .container-x');
const row = drawer.lastElementChild;
JSON.stringify({
  rowIcons: [...row.querySelectorAll('a')].map(a => Math.round(a.getBoundingClientRect().width)),
  rowWidth: Math.round(row.getBoundingClientRect().width),
  hasThemeToggle: !!row.querySelector('button[aria-label^="Theme"]'),
})
```

Expected: `rowIcons` is `[44,44,44]` (all three social URLs are set today), `rowWidth` is `335`, `hasThemeToggle` is `true`. Icons + gaps = `3 × 44 + 2 × 12 = 156` in a 335px drawer.

Finally at **1280 × 800**: all three icons **and** the ThemeToggle visible in the bar, burger and drawer hidden. Scroll to the footer at 375px and confirm four 44px circles (Instagram, Facebook, YouTube, WhatsApp) on one row with no wrap.

- [ ] **Step 9: Commit**

```bash
git add src/components/SocialIcons.tsx src/components/Header.tsx src/components/Footer.tsx
git commit -m "fix: mobile header fits 335px — one instagram icon, 44px targets, socials in the drawer"
```

---

### Task 8: `.pill` clipping guard and the La Rumba tile content split (spec §6.4)

`TonightTile.tsx` puts the whole `when` string inside a `.pill`, which is `whitespace-nowrap`, inside a wrapper that is `overflow-clip`. The live value is **67 characters** — `"Every Saturday · 7 PM onwards at Over the Moon Brew Co, Gachibowli "`, trailing space included. On a 375px phone the tail, **including the venue name**, is cut off: not wrapped, not scrollable, not visible.

**Files:**
- Modify: `src/app/globals.css` (anchor: the `.pill` `@apply` line quoted in Step 1)
- Modify: `src/components/TonightTile.tsx` (anchor: `            <p className="pill bg-ember-500/20 text-ember-400">`)
- Modify: `data/site-content.json` (`tonight.when`, `tonight.body`)
- Modify: `src/data/site-content.seed.json` — **generated by `npm run sync-seed`, never hand-edited** (R2)
- Test: `npx vitest run src/lib/save-pipeline.test.ts src/lib/drafts-core.test.ts` (both parse the bundled seed at import, so a malformed edit throws at module load) plus a manual clipping check

**Interfaces:**
- Consumes / Produces: nothing exported. One CSS rule and two content strings.

- [ ] **Step 1: Harden `.pill`**

In `src/app/globals.css`, find the exact line:

```css
    @apply inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs uppercase tracking-wider;
```

and replace it with:

```css
    /* max-w-full + overflow-hidden + text-ellipsis: nowrap inside an
       overflow-clip ancestor razor-cuts a long value with no warning to
       whoever typed it, and that is exactly the bug TonightTile shipped. This
       protects the ten other .pill call sites that render admin-controlled
       text (QuickEnroll.tsx, page.tsx x2, instructors/page.tsx, ...) — the
       clipping now happens inside the pill's own box, visibly, instead of
       escaping it. Every newly-editable label from Plan 1 that lands in a pill
       would otherwise be a fresh instance of the same silent bug. */
    @apply inline-flex max-w-full items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-2.5 py-1 text-xs uppercase tracking-wider;
```

The existing comment directly above that line (`nowrap: a pill that breaks onto two lines …`) stays — it explains why `whitespace-nowrap` is still there.

- [ ] **Step 2: Pin the venue out of the pill in the markup**

In `src/components/TonightTile.tsx`, find the exact line:

```tsx
            <p className="pill bg-ember-500/20 text-ember-400">
```

and replace it with:

```tsx
            {/* Only the short cadence goes in the pill. The venue lives in
                `body`, which wraps — a 67-character `when` was being cut off
                mid-venue-name on every phone (spec §6.4). Keep it that way:
                this comment is what stops the venue being pasted back in. */}
            <p className="pill bg-ember-500/20 text-ember-400">
```

The markup is otherwise unchanged. The fix is the content in Step 3 plus the CSS guard in Step 1; this comment is the guard against a regression through the admin.

- [ ] **Step 3: Fix the content in `data/site-content.json`, then regenerate the seed**

**Never edit `src/data/site-content.seed.json` by hand (R2)** — `scripts/sync-seed.mjs` regenerates it from `data/site-content.json` and would silently destroy the edit.

Run:

```bash
node -e "
const fs=require('node:fs');
const p='data/site-content.json';
let raw=fs.readFileSync(p,'utf8');
if(raw.charCodeAt(0)===0xfeff) raw=raw.slice(1);
const j=JSON.parse(raw);
j.tonight.when='Every Saturday · 7 PM';
j.tonight.body=\"Hyderabad's weekly Latin social at Over the Moon Brew Co, Gachibowli. All levels welcome. Entry at the Venue.\";
fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n','utf8');
console.log('when:', JSON.stringify(j.tonight.when), j.tonight.when.length, 'chars');
console.log('body:', JSON.stringify(j.tonight.body), j.tonight.body.length, 'chars');
"
```

Expected:

```
when: "Every Saturday · 7 PM" 21 chars
body: "Hyderabad's weekly Latin social at Over the Moon Brew Co, Gachibowli. All levels welcome. Entry at the Venue." 108 chars
```

67 → 21 characters in the pill, and the venue is now inside a paragraph that wraps. Note the trailing space is gone.

Then regenerate and verify:

```bash
npm run sync-seed
npm run sync-seed -- --check
```

Expected: `Wrote src/data/site-content.seed.json`, then `✓ seed is in sync with data/site-content.json`.

- [ ] **Step 4: Verify the seed still parses and the pill no longer overflows**

Run: `npx vitest run src/lib/save-pipeline.test.ts src/lib/drafts-core.test.ts`
Expected: PASS. Both files parse the bundled seed at import, so a malformed edit throws at module load rather than in an assertion.

Run `npm run dev`, open `http://localhost:3000` at **375 × 667**, scroll to the La Rumba tile, and run:

```js
const pill = [...document.querySelectorAll('.pill')].find(p => p.textContent.includes('Live'));
const card = pill.closest('.overflow-clip');
JSON.stringify({
  text: pill.textContent.trim(),
  pillWidth: Math.round(pill.getBoundingClientRect().width),
  cardInner: Math.round(card.getBoundingClientRect().width) - 64,
  clipped: pill.scrollWidth > pill.clientWidth,
})
```

Expected: `text` is `"Live · Every Saturday · 7 PM"`, `pillWidth` is comfortably under `cardInner` (the card is `p-8` = 32px a side), and `clipped` is `false`. Then confirm the venue name is now visible in the body paragraph under the headline.

- [ ] **Step 5: Commit**

`data/site-content.json` **must** be in this commit — omitting it leaves the tree dirty and Task 16's clean-tree gate fails.

```bash
git add src/app/globals.css src/components/TonightTile.tsx data/site-content.json src/data/site-content.seed.json
git commit -m "fix: pill clips inside its own box, la rumba venue moves out of the nowrap chip"
```

---

### Task 9: Reclaim the fold — sub-headline trim plus padding (M4 + spec §6.3)

Spec §7.5 calls the board's position on a 375 × 667 phone *"the number that validates or kills M4's arithmetic — measure it first."*

M4 is **two** changes, and the copy one is the larger of the two. The 268-character sub-headline runs ~8 lines at `text-lg` (18px/28px) in a 335px column; at 142 characters it runs ~4. That is ~112px, against 48px from the padding. Shipping only the padding delivers roughly a quarter of M4 and leaves the spec's stated success condition — *"111px of the card visible on a 667px iPhone SE"* — out of reach.

**Files:**
- Modify: `data/site-content.json` (`hero.subHeadline`)
- Modify: `src/data/site-content.seed.json` — generated by `npm run sync-seed` (R2)
- Modify: `src/components/Hero.tsx` (anchors: the `{/* Bottom padding minus QuickEnroll's pull-up` comment, the `container-x relative z-10 pt-8 pb-36` div, the sub-headline `<p>`'s `className="mt-6 max-w-2xl text-lg text-cream/80 sm:text-xl hero-fade"`, and `<div className="mt-8 hero-fade" style={{ animationDelay: '1.15s' }}>`)
- Test: manual — a before/after `getBoundingClientRect().top` measurement, plus the seed-parse suites. **This task ships with ZERO automated regression cover** for the layout; the Step 1/Step 4 measurement pair is the entire guard.

**Interfaces:**
- Consumes / Produces: nothing exported. Content copy plus layout arithmetic.

- [ ] **Step 1: Measure the board's position BEFORE changing anything**

Run `npm run dev`, open `http://localhost:3000`, DevTools device toolbar at **375 × 667**, `window.scrollTo(0,0)`, then run:

```js
const board = document.querySelector('#start-this-week');
const sub = document.querySelector('section .container-x p.hero-fade + h1 ~ p') || [...document.querySelectorAll('section .container-x p')].find(p => p.className.includes('max-w-2xl'));
const r = board.getBoundingClientRect();
const lh = parseFloat(getComputedStyle(sub).lineHeight);
JSON.stringify({
  boardTop: Math.round(r.top + window.scrollY),
  visibleAboveFold: Math.max(0, Math.round(667 - r.top)),
  subChars: sub.textContent.trim().length,
  subLines: Math.round(sub.getBoundingClientRect().height / lh),
  heroPadBottom: getComputedStyle(document.querySelector('section .container-x')).paddingBottom,
})
```

**Record all five numbers in the task's completion note before proceeding.** Spec §7.3 M4's estimate is `boardTop` ≈ 736px with 0px visible above the fold; `subChars` must read `268` and `subLines` is expected to be `8`. If `boardTop` is already under 600px, STOP and report — the arithmetic below is derived from the spec's estimate and needs re-basing against reality.

- [ ] **Step 2: Write the trimmed sub-headline into the content document**

Spec §6.3 gives the exact replacement copy and the reasoning for every deletion: the "India's most loved" claim goes because the pill directly above already reads "India's largest Latin dance school"; the two venue names go because they appear in the Visit Us section and on every batch card; and the literal ₹500 goes because the button immediately below derives the price from live batch data, so hardcoding it in prose means the copy lies the day the deposit changes (`Hero.tsx`'s own rule, stated in the comment above `trialFrom`).

**Edit `data/site-content.json` only, then regenerate the seed (R2).**

```bash
node -e "
const fs=require('node:fs');
const p='data/site-content.json';
let raw=fs.readFileSync(p,'utf8');
if(raw.charCodeAt(0)===0xfeff) raw=raw.slice(1);
const j=JSON.parse(raw);
const before=j.hero.subHeadline.length;
j.hero.subHeadline='Salsa, Bachata and West Coast Swing in Hyderabad. Never danced a step? Foundation is built for exactly you — feel the music once, then decide.';
fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n','utf8');
console.log(before, '->', j.hero.subHeadline.length, 'chars');
console.log(JSON.stringify(j.hero.subHeadline));
"
```

Expected, exactly:

```
268 -> 142 chars
"Salsa, Bachata and West Coast Swing in Hyderabad. Never danced a step? Foundation is built for exactly you — feel the music once, then decide."
```

If the "before" number is not `268`, STOP — the owner has already edited this field in the admin and overwriting it would discard their copy. Report and ask.

Then regenerate and verify:

```bash
npm run sync-seed
npm run sync-seed -- --check
```

Expected: `Wrote src/data/site-content.seed.json`, then `✓ seed is in sync with data/site-content.json`.

Note for the owner: this field stays fully editable at `/admin/hero`. The spec drafts the copy; the owner may rewrite it. The **length** is what the fold arithmetic depends on, so a rewrite much past ~150 characters gives the padding back.

- [ ] **Step 3: Trim the padding**

In `src/components/Hero.tsx`, find the exact comment block:

```tsx
      {/* Bottom padding minus QuickEnroll's pull-up (-mt-24/-mt-32/-mt-36)
          leaves a constant 48px of clear air between the hero CTAs and the
          card edge at every breakpoint — enough for the card to peek without
          crowding the buttons above it. */}
      <div className="container-x relative z-10 pt-8 pb-36 sm:pt-10 sm:pb-44 lg:pt-12 lg:pb-48">
```

and replace it with:

```tsx
      {/* Bottom padding minus QuickEnroll's pull-up (-mt-24/-mt-32/-mt-36).
          Deliberately NOT constant across breakpoints any more: at sm+ it
          still leaves 48px of clear air between the hero CTAs and the card
          edge, but on a phone the base pad drops to pb-28 so the clear air is
          16px and the board's top edge climbs 32px up a 667px viewport. The
          board is the conversion surface and it starts below the fold — 32px
          of card peeking beats 32px of empty space. */}
      <div className="container-x relative z-10 pt-8 pb-28 sm:pt-10 sm:pb-44 lg:pt-12 lg:pb-48">
```

Then find the exact line:

```tsx
          className="mt-6 max-w-2xl text-lg text-cream/80 sm:text-xl hero-fade"
```

and replace it with:

```tsx
          className="mt-4 max-w-2xl text-lg text-cream/80 sm:text-xl hero-fade"
```

Then find the exact line:

```tsx
        <div className="mt-8 hero-fade" style={{ animationDelay: '1.15s' }}>
```

and replace it with:

```tsx
        <div className="mt-6 hero-fade" style={{ animationDelay: '1.15s' }}>
```

- [ ] **Step 4: Measure again against the full M4 target**

Reload `http://localhost:3000` at **375 × 667**, `window.scrollTo(0,0)`, and run the **same expression from Step 1**.

Expected:
- `subChars` is `142` and `subLines` is `4` (down from 268 / 8)
- `heroPadBottom` reads `112px`
- `boardTop` has dropped by **≥ 140px** and lands at **≈ 556–580px**
- `visibleAboveFold` is **≥ 87px**, target **111px**

The arithmetic, stated so a shortfall is diagnosable rather than mysterious:

| change | delta |
|---|---|
| `pb-36 → pb-28` (144 → 112) | −32px |
| `mt-6 → mt-4` on the sub-headline (24 → 16) | −8px |
| `mt-8 → mt-6` on the CTA block (32 → 24) | −8px |
| sub-headline 8 lines → 4 lines at 28px | −112px |
| **derived total** | **−160px** |

Spec §7.3 M4 estimates −180px (736 → 556, 111px visible). This plan's arithmetic accounts for 160 of those 180, so a measurement around 576px / 91px visible is the expected landing and still delivers M4's intent. **Record the actual and report the gap against 556/111.** Do not cut further padding to close it without re-measuring, and do not touch the h1 — spec §8 freezes the headline and the count-in.

If the delta is under 140px, one of the four changes did not land: check `subChars` first (a stale dev cache serves the old content document — restart `npm run dev`), then `heroPadBottom`.

Also confirm at **1280 × 800** that `getComputedStyle` on the same container still reports `paddingBottom: 192px` — the `lg:pb-48` path is untouched, so there is no desktop regression.

- [ ] **Step 5: Confirm the seed still parses**

Run: `npx vitest run src/lib/save-pipeline.test.ts src/lib/drafts-core.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

Both content files go in with the code — omitting `data/site-content.json` leaves the tree dirty and Task 16's clean-tree gate fails.

```bash
git add src/components/Hero.tsx data/site-content.json src/data/site-content.seed.json
git commit -m "perf: reclaim the mobile fold — trim the hero sub-headline to 142 chars and tighten padding"
```

---

### Task 10: Cap admin uploads client-side (M5, client half)

Spec §7.3 M5: *"It must be client-side: re-encoding in the Worker is seconds of CPU against a 10ms cap."* Without this, admin uploads bypass the build-time pipeline entirely — which is how `/instructors` reached 6,926,052 B.

**Files:**
- Create: `src/lib/image-downscale.ts`
- Test: `src/lib/image-downscale.test.ts` (new file, 7 tests)
- Modify: `src/components/admin/ImageUploader.tsx` (anchors: `import { Field } from './fields';`, the two `fd.append('file', file);` blocks quoted in Step 5, and the `hint={hint || 'JPEG / PNG / WebP / AVIF · up to 8 MB. Or paste a URL.'}` line)

**Interfaces:**
- Consumes: browser `createImageBitmap`, `OffscreenCanvas`, `OffscreenCanvas.convertToBlob`
- Produces:
  ```ts
  export const UPLOAD_MAX_EDGE_PX = 1600;
  export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number };
  export function downscaleImageFile(file: File, maxEdge?: number): Promise<File>;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/image-downscale.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { downscaleImageFile, fitWithin, UPLOAD_MAX_EDGE_PX } from './image-downscale';

describe('fitWithin', () => {
  it('leaves an image already inside the ceiling untouched', () => {
    expect(fitWithin(1200, 900, 1600)).toEqual({ width: 1200, height: 900 });
  });

  it('scales a landscape photo down to the ceiling on its long edge', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait photo down to the ceiling on its long edge', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never returns a zero dimension for an extreme aspect ratio', () => {
    // A 20000x3 banner would round the short edge to 0, and OffscreenCanvas
    // throws on a zero dimension — clamp to 1 instead of crashing the upload.
    expect(fitWithin(20000, 3, 1600)).toEqual({ width: 1600, height: 1 });
  });

  it('returns zeroes rather than NaN for a non-positive input', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });

  it('ships a 1600px ceiling', () => {
    expect(UPLOAD_MAX_EDGE_PX).toBe(1600);
  });
});

describe('downscaleImageFile', () => {
  it('returns the original file where OffscreenCanvas is not available', async () => {
    // Node has no createImageBitmap/OffscreenCanvas, which is exactly the
    // shape of an old mobile browser. The upload must still go through — the
    // server-side dimension ceiling is the guard in that case.
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', {
      type: 'image/jpeg',
    });
    await expect(downscaleImageFile(file)).resolves.toBe(file);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/image-downscale.test.ts`

Expected: FAIL with `Failed to resolve import "./image-downscale" from "src/lib/image-downscale.test.ts"`.

- [ ] **Step 3: Write the module**

Create `src/lib/image-downscale.ts`:

```ts
// Admin uploads are resized in the BROWSER before they are posted. Doing it in
// the Worker would be seconds of CPU against a 10ms free-plan cap, and without
// it every admin upload silently bypasses the build-time image pipeline — a
// 6.9 MB /instructors page is what that looks like (spec §7.3 M5).

/** Longest edge, in pixels, an upload keeps after the client-side resize. */
export const UPLOAD_MAX_EDGE_PX = 1600;

/** Pure: the box `width x height` fits into, scaled down only, never up. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0) return { width: 0, height: 0 };
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Best-effort. Every failure path returns the ORIGINAL file: a browser without
 * OffscreenCanvas, an image the decoder rejects, a re-encode that came out
 * larger. Refusing to upload would be a worse outcome than uploading big, and
 * the server-side dimension ceiling still backstops it.
 */
export async function downscaleImageFile(
  file: File,
  maxEdge: number = UPLOAD_MAX_EDGE_PX,
): Promise<File> {
  const g = globalThis as {
    createImageBitmap?: unknown;
    OffscreenCanvas?: unknown;
  };
  if (typeof g.createImageBitmap !== 'function' || typeof g.OffscreenCanvas !== 'function') {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height, maxEdge);
    if (target.width === bitmap.width && target.height === bitmap.height) return file;

    const canvas = new OffscreenCanvas(target.width, target.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    // WebP, not AVIF: convertToBlob's AVIF support is uneven across browsers
    // and a rejected promise here costs the admin their upload. The build-time
    // pipeline is where AVIF is produced.
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    if (!blob || blob.size >= file.size) return file;

    const stem = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${stem}.webp`, { type: 'image/webp' });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/image-downscale.test.ts`

Expected: PASS — `Test Files 1 passed (1)`, `Tests 7 passed (7)`.

- [ ] **Step 5: Wire it into both uploaders**

In `src/components/admin/ImageUploader.tsx`, find the exact line:

```ts
import { Field } from './fields';
```

and replace it with:

```ts
import { Field } from './fields';
import { downscaleImageFile, UPLOAD_MAX_EDGE_PX } from '@/lib/image-downscale';
```

Then, in `upload()`, find this exact block (note the **six-space** indentation — this is what distinguishes it from the `uploadMany()` copy):

```ts
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
```

and replace it with:

```ts
      // Resize before the POST, not after: re-encoding in the Worker is
      // seconds of CPU against a 10ms cap.
      const shrunk = await downscaleImageFile(file);
      const fd = new FormData();
      fd.append('file', shrunk);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
```

Then, in `uploadMany()`, find this exact block (**eight-space** indentation):

```ts
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
```

and replace it with:

```ts
        const shrunk = await downscaleImageFile(file);
        const fd = new FormData();
        fd.append('file', shrunk);
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
```

Finally, make the behaviour visible to whoever is uploading. Find the exact line:

```tsx
      hint={hint || 'JPEG / PNG / WebP / AVIF · up to 8 MB. Or paste a URL.'}
```

and replace it with:

```tsx
      hint={
        hint ||
        `JPEG / PNG / WebP / AVIF · resized to ${UPLOAD_MAX_EDGE_PX}px on the long edge · up to 8 MB. Or paste a URL.`
      }
```

- [ ] **Step 6: Verify in the admin**

Run: `npm run typecheck`
Expected: PASS with no output.

Run `npm run dev`, sign in at `http://localhost:3000/admin`, open a screen with an image field (e.g. `/admin/instructors`), open the DevTools Network tab, and upload a photo whose long edge is over 1600px — any of `public/photos/*.jpg` is 2000×1335.

Expected: the `POST /api/admin/upload` request payload is a `.webp` well under 400 KB rather than the original 2000px JPEG, and the response `url` ends in `.webp`.

Also upload something already small (under 1600px on both edges) and confirm it goes up untouched with its original extension — `fitWithin` returns the same dimensions and `downscaleImageFile` returns the original `File` object.

- [ ] **Step 7: Commit**

```bash
git add src/lib/image-downscale.ts src/lib/image-downscale.test.ts src/components/admin/ImageUploader.tsx
git commit -m "perf: resize admin uploads in the browser to a 1600px long edge"
```

---

### Task 11: Server-side dimension ceiling (M5, backstop half)

**Files:**
- Create: `src/lib/image-dimensions.ts`
- Test: `src/lib/image-dimensions.test.ts` (new file, 8 tests)
- Modify: `src/app/api/admin/upload/route.ts` (anchors: `import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';` and the `const buf = Buffer.from(await file.arrayBuffer());` block)

**Interfaces:**
- Consumes: the `Uint8Array` the upload route already builds for MIME sniffing
- Produces:
  ```ts
  export interface ImageSize { width: number; height: number }
  export const UPLOAD_MAX_STORED_EDGE_PX = 2600;
  export function readImageSize(bytes: Uint8Array): ImageSize | null;
  export function oversizeError(size: ImageSize | null, maxEdge?: number): string | null;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/image-dimensions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { oversizeError, readImageSize, UPLOAD_MAX_STORED_EDGE_PX } from './image-dimensions';

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x00, 0x00, 0x00, 0x0d], 8); // chunk length
  b.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment to make the marker walk do real work, then SOF0.
  const b = new Uint8Array(33);
  b.set([0xff, 0xd8], 0);
  b.set([0xff, 0xe0, 0x00, 0x10], 2); // APP0, length 16 (incl. the 2 length bytes)
  b.set([0xff, 0xc0, 0x00, 0x0b, 0x08], 20); // SOF0, length 11, precision 8
  const dv = new DataView(b.buffer);
  dv.setUint16(25, height);
  dv.setUint16(27, width);
  b.set([0x01, 0x01, 0x11, 0x00], 29);
  return b;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  b.set([0x57, 0x45, 0x42, 0x50], 8); // 'WEBP'
  b.set([0x56, 0x50, 0x38, 0x58], 12); // 'VP8X'
  const w = width - 1;
  const h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  b.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return b;
}

describe('readImageSize', () => {
  it('reads dimensions from a PNG IHDR chunk', () => {
    expect(readImageSize(png(1600, 1200))).toEqual({ width: 1600, height: 1200 });
  });

  it('reads dimensions from a JPEG SOF0 past an APP0 segment', () => {
    expect(readImageSize(jpeg(4000, 3000))).toEqual({ width: 4000, height: 3000 });
  });

  it('reads the canvas size from a WebP VP8X chunk', () => {
    expect(readImageSize(webpVp8x(4032, 3024))).toEqual({ width: 4032, height: 3024 });
  });

  it('returns null for a format it does not parse', () => {
    // AVIF and anything else. Null means "unknown", and the 8 MB byte cap in
    // the route stays the only guard — never a rejection.
    const avifish = new Uint8Array(20);
    avifish.set([0x66, 0x74, 0x79, 0x70], 4); // 'ftyp'
    avifish.set([0x61, 0x76, 0x69, 0x66], 8); // 'avif'
    expect(readImageSize(avifish)).toBe(null);
  });

  it('returns null for truncated bytes rather than throwing', () => {
    expect(readImageSize(new Uint8Array([0x89, 0x50, 0x4e]))).toBe(null);
  });
});

describe('oversizeError', () => {
  it('rejects an image over the stored ceiling', () => {
    expect(oversizeError({ width: 4032, height: 3024 })).toBe(
      'Image is 4032x3024. Please use one no larger than 2600px on its longest edge.',
    );
  });

  it('accepts an image exactly at the ceiling', () => {
    expect(oversizeError({ width: UPLOAD_MAX_STORED_EDGE_PX, height: 100 })).toBe(null);
  });

  it('accepts an image whose size could not be read', () => {
    expect(oversizeError(null)).toBe(null);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/image-dimensions.test.ts`

Expected: FAIL with `Failed to resolve import "./image-dimensions" from "src/lib/image-dimensions.test.ts"`.

- [ ] **Step 3: Write the module**

Create `src/lib/image-dimensions.ts`:

```ts
// Header-only dimension reader. The upload route already buffers the bytes to
// sniff the MIME type, so this costs a few dozen byte reads and no decode —
// which is the only kind of image work that fits under a 10ms CPU cap.
//
// This is the BACKSTOP for the client-side resize in image-downscale.ts: it
// catches a browser with no OffscreenCanvas and anything that posts the
// endpoint directly. It is deliberately not a decoder — an unparsed format
// returns null and is allowed through on the 8 MB byte cap alone.

export interface ImageSize {
  width: number;
  height: number;
}

/** Hard ceiling on a stored upload's longest edge. Comfortably above the
 *  1600px the admin UI resizes to, so a legitimate upload is never bounced. */
export const UPLOAD_MAX_STORED_EDGE_PX = 2600;

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...b.subarray(i, i + n));

export function readImageSize(b: Uint8Array): ImageSize | null {
  // PNG: 8-byte signature, then IHDR is always the first chunk.
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    return { width: u32be(b, 16), height: u32be(b, 20) };
  }

  // JPEG: walk the marker chain to the first SOFn frame header.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++; // fill byte
        continue;
      }
      // Standalone markers carry no length field.
      if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break; // EOI / start of scan
      const len = u16be(b, i + 2);
      // SOF0..SOF15, minus DHT (c4), JPG (c8) and DAC (cc).
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
      if (len < 2) break;
      i += 2 + len;
    }
    return null;
  }

  // WebP: a RIFF container with one of three bitstream chunks.
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8X') {
      return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    }
    if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    }
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    return null;
  }

  return null;
}

/** Null means "store it". A string is the message shown to the admin. */
export function oversizeError(
  size: ImageSize | null,
  maxEdge: number = UPLOAD_MAX_STORED_EDGE_PX,
): string | null {
  if (!size) return null;
  if (Math.max(size.width, size.height) <= maxEdge) return null;
  return `Image is ${size.width}x${size.height}. Please use one no larger than ${maxEdge}px on its longest edge.`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/image-dimensions.test.ts`

Expected: PASS — `Test Files 1 passed (1)`, `Tests 8 passed (8)`.

- [ ] **Step 5: Enforce it in the upload route**

In `src/app/api/admin/upload/route.ts`, find the exact line:

```ts
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
```

and replace it with:

```ts
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
import { oversizeError, readImageSize } from '@/lib/image-dimensions';
```

Then find the exact block:

```ts
  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageType(new Uint8Array(buf));
  if (!sniffed || !(sniffed in EXT)) {
    return NextResponse.json(
      { error: 'Unsupported type (JPEG, PNG, WebP or AVIF only)' },
      { status: 400 },
    );
  }
```

and replace it with:

```ts
  const buf = Buffer.from(await file.arrayBuffer());
  const bytes = new Uint8Array(buf);
  const sniffed = sniffImageType(bytes);
  if (!sniffed || !(sniffed in EXT)) {
    return NextResponse.json(
      { error: 'Unsupported type (JPEG, PNG, WebP or AVIF only)' },
      { status: 400 },
    );
  }
  // Backstop for the admin UI's client-side resize (image-downscale.ts). A
  // browser without OffscreenCanvas, or a direct POST, would otherwise store a
  // 4000px master that every visitor then downloads in full — which is exactly
  // how /instructors reached 6.9 MB. Header parse only: no decode, no CPU.
  const oversize = oversizeError(readImageSize(bytes));
  if (oversize) return NextResponse.json({ error: oversize }, { status: 400 });
```

- [ ] **Step 6: Verify the route rejects an oversized direct upload**

Run: `npm run typecheck`
Expected: PASS with no output.

Run `npm run dev`, sign in at `/admin`, then from the browser console **on an admin page** (so the session cookie and the same-origin check pass):

```js
const c = new OffscreenCanvas(3200, 2400); c.getContext('2d').fillRect(0,0,10,10);
const blob = await c.convertToBlob({ type: 'image/png' });
const fd = new FormData(); fd.append('file', new File([blob], 'big.png', { type: 'image/png' }));
const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
console.log(r.status, await r.json());
```

Expected: `400` and `{ error: "Image is 3200x2400. Please use one no larger than 2600px on its longest edge." }`.

Then repeat with `new OffscreenCanvas(2000, 1500)` and expect `200` with a `url` — 2000 is under the 2600 ceiling, so the backstop must let it through. The ceiling deliberately sits above the 1600px the UI resizes to, so a legitimate upload is never bounced by the guard that only exists for the paths the UI cannot reach.

- [ ] **Step 7: Commit**

```bash
git add src/lib/image-dimensions.ts src/lib/image-dimensions.test.ts src/app/api/admin/upload/route.ts
git commit -m "feat: server-side pixel-dimension ceiling as the upload backstop"
```

---

### Task 12: Edge caching with a purge on save (M6, spec decision #11)

**Files:**
- Create: `src/lib/public-urls.ts`
- Test: `src/lib/public-urls.test.ts` (new file, 6 tests)
- Create: `src/lib/edge-purge.ts`
- Modify: `src/lib/revalidate-public.ts` (anchor: `export function revalidatePublicPages(content: SiteContent): void {`)
- Modify: `src/app/api/admin/save/route.ts` (anchors: `import { revalidatePublicPages } from '@/lib/revalidate-public';` and `      revalidatePublicPages(result.next);`)
- Modify: `next.config.mjs` (anchor: the `      // Served uploads are opaque image bytes — lock them down harder` comment)
- Modify: `public/_headers` (anchor: the final `/logo-mark.png` block)
- Modify: `PRODUCT.md` (anchor: the `- Staff edit content on the deployed` line)

**Interfaces:**
- Consumes: `SiteContent` from `@/lib/content-schema`, `SITE_URL` from `@/lib/seo`
- Produces:
  ```ts
  // src/lib/public-urls.ts
  export function publicPathsFor(content: SiteContent): string[];
  export function absoluteUrls(paths: string[], origin: string): string[];
  export function chunk<T>(items: T[], size: number): T[][];
  // src/lib/edge-purge.ts
  export function purgeEdgeCache(paths: string[]): Promise<void>;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/public-urls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { absoluteUrls, chunk, publicPathsFor } from './public-urls';
import type { SiteContent } from './content-schema';

const doc = () =>
  ({
    danceStyles: [{ slug: 'salsa' }, { slug: 'bachata' }],
    stories: [{ slug: 'first-night' }],
    customPages: [{ slug: 'latinl1july2026' }],
  }) as unknown as SiteContent;

describe('publicPathsFor', () => {
  it('includes every static public route', () => {
    const paths = publicPathsFor(doc());
    for (const p of ['/', '/about', '/batches', '/contact', '/faqs', '/instructors', '/sitemap.xml']) {
      expect(paths).toContain(p);
    }
  });

  it('includes one path per dance style, story and custom page', () => {
    const paths = publicPathsFor(doc());
    expect(paths).toContain('/dance-styles/salsa');
    expect(paths).toContain('/dance-styles/bachata');
    expect(paths).toContain('/stories/first-night');
    expect(paths).toContain('/p/latinl1july2026');
  });

  it('never repeats a path', () => {
    // A duplicate costs a wasted revalidatePath and a wasted purge slot —
    // Cloudflare's purge API takes 30 URLs per request.
    const paths = publicPathsFor(doc());
    expect(paths.length).toBe(new Set(paths).size);
  });
});

describe('absoluteUrls', () => {
  it('prefixes the origin without producing a double slash', () => {
    expect(absoluteUrls(['/', '/batches'], 'https://www.dancehyderabad.com/')).toEqual([
      'https://www.dancehyderabad.com/',
      'https://www.dancehyderabad.com/batches',
    ]);
  });
});

describe('chunk', () => {
  it('splits into batches of at most n, keeping order', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns an empty list for an empty input', () => {
    expect(chunk([], 30)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/public-urls.test.ts`

Expected: FAIL with `Failed to resolve import "./public-urls" from "src/lib/public-urls.test.ts"`.

- [ ] **Step 3: Write the path module**

Create `src/lib/public-urls.ts`:

```ts
import type { SiteContent } from './content-schema';

// One list, two consumers: revalidatePath() in dev and on any ISR host, and
// the Cloudflare edge purge after a published save. They must not drift — a
// path that is cached but never purged serves a 60s-stale page after an edit.

const STATIC_PATHS = [
  '/',
  '/about',
  '/faqs',
  '/contact',
  '/instructors',
  '/stories',
  '/dance-styles',
  '/batches',
  '/privacy',
  '/terms',
  '/sitemap.xml',
] as const;

export function publicPathsFor(content: SiteContent): string[] {
  const seen = new Set<string>(STATIC_PATHS);
  for (const s of content.danceStyles) seen.add(`/dance-styles/${s.slug}`);
  for (const s of content.stories) seen.add(`/stories/${s.slug}`);
  for (const p of content.customPages) seen.add(`/p/${p.slug}`);
  return [...seen];
}

export function absoluteUrls(paths: string[], origin: string): string[] {
  const base = origin.replace(/\/$/, '');
  return paths.map((p) => `${base}${p}`);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/public-urls.test.ts`

Expected: PASS — `Test Files 1 passed (1)`, `Tests 6 passed (6)`.

- [ ] **Step 5: Point `revalidate-public.ts` at the shared list**

In `src/lib/revalidate-public.ts`, find the exact line:

```ts
import type { SiteContent } from './content-schema';
```

and replace it with:

```ts
import type { SiteContent } from './content-schema';
import { publicPathsFor } from './public-urls';
```

Then find the whole function, from the exact line `export function revalidatePublicPages(content: SiteContent): void {` through the `}` that closes it, and replace it with:

```ts
export function revalidatePublicPages(content: SiteContent): void {
  try {
    revalidatePath('/', 'layout');
    for (const p of publicPathsFor(content)) revalidatePath(p);
  } catch (err) {
    console.warn('revalidatePath failed (non-fatal):', err);
  }
}
```

The comment block above the function is unchanged and still applies.

- [ ] **Step 6: Write the purge**

Create `src/lib/edge-purge.ts`:

```ts
import 'server-only';
import { absoluteUrls, chunk } from './public-urls';
import { SITE_URL } from './seo';

// Public routes gain a 60s edge cache (spec decision #11) so an Instagram
// burst hits Cloudflare instead of the Worker. The freshness promise is kept
// by purging on save: an owner edit is visible immediately, and only anonymous
// visitors who arrive between the edit and the purge see up to 60s-old HTML.
//
// Unconfigured is a no-op, not an error. Dev has no zone, and a deploy without
// the token must still be able to save.
const PURGE_BATCH = 30; // Cloudflare's per-request file limit

export async function purgeEdgeCache(paths: string[]): Promise<void> {
  const zone = process.env.CF_ZONE_ID;
  const token = process.env.CF_PURGE_TOKEN;
  if (!zone || !token || paths.length === 0) return;

  const urls = absoluteUrls(paths, SITE_URL);
  for (const files of chunk(urls, PURGE_BATCH)) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) {
        // Never fail the save on this. A stale edge entry expires in 60s
        // anyway; a 500 on save loses the owner's work.
        console.warn(`edge purge returned ${res.status} for ${files.length} urls`);
      }
    } catch (err) {
      console.warn('edge purge failed (non-fatal):', err);
    }
  }
}
```

If `SITE_URL` is not an export of `src/lib/seo.ts`, STOP and report rather than inventing a constant — the origin must be the same one `generateMetadata`'s `metadataBase` uses, or the purge targets URLs nobody requested.

- [ ] **Step 7: Call it from the save handler**

In `src/app/api/admin/save/route.ts`, find the exact line:

```ts
import { revalidatePublicPages } from '@/lib/revalidate-public';
```

and replace it with:

```ts
import { revalidatePublicPages } from '@/lib/revalidate-public';
import { purgeEdgeCache } from '@/lib/edge-purge';
import { publicPathsFor } from '@/lib/public-urls';
```

Then find the exact line:

```ts
      revalidatePublicPages(result.next);
```

and replace it with:

```ts
      revalidatePublicPages(result.next);
      // Public routes carry s-maxage=60; without this an owner edit would sit
      // behind the edge for up to a minute. Never throws — see edge-purge.ts.
      await purgeEdgeCache(publicPathsFor(result.next));
```

- [ ] **Step 8: Add the cache headers**

In `next.config.mjs`, find the exact comment line:

```js
      // Served uploads are opaque image bytes — lock them down harder
```

and insert this block immediately **before** it (i.e. after the `/api/:path*` rule closes):

```js
      // Public routes only, and only for a visitor holding neither the admin
      // nor the preview cookie — those two variants must never enter a shared
      // cache. /admin and /api keep no-store via the rules above; the negative
      // lookahead keeps this rule off them entirely.
      //
      // DEPLOY STEP, not optional: Cloudflare does not cache HTML by default,
      // so this header does nothing until a zone Cache Rule marks matching
      // requests "Eligible for cache" — hostname = www.dancehyderabad.com AND
      // URI path not starting with /admin or /api, respecting origin
      // cache-control. Without that rule this change is inert but harmless.
      {
        source: '/((?!admin|api|uploads).*)',
        missing: [
          { type: 'cookie', key: 'furor_admin' },
          { type: 'cookie', key: 'furor_preview' },
        ],
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
          },
        ],
      },
```

- [ ] **Step 9: Add the immutable asset rules**

In `public/_headers`, find the exact block at the end of the file:

```
/logo-mark.png
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

and replace it with:

```
/logo-mark.png
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

# Build-time image variants from scripts/build-images.mjs. The filenames carry
# an 8-char hash of the SOURCE bytes, so a replaced photo is a replaced URL —
# which is what makes `immutable` safe here and not on /photos/*. Deliberately
# a separate path prefix from /photos so the two Cache-Control rules can never
# both match one file.
/img/*
  Cache-Control: public, max-age=31536000, immutable

# Filenames are server-generated UUIDs, so an upload's bytes never change under
# its URL. In production these are served by src/app/uploads/[file]/route.ts,
# which already sets the same value; this covers the dev/static path.
/uploads/*
  Cache-Control: public, max-age=31536000, immutable
```

- [ ] **Step 10: Keep PRODUCT.md truthful about freshness**

In `PRODUCT.md`, find the exact line:

```markdown
- Staff edit content on the deployed `/admin`; edits appear on the public site within ~30 s (per-request rendering, no redeploy).
```

and replace it with:

```markdown
- Staff edit content on the deployed `/admin`; edits appear on the public site within ~30 s (per-request rendering, no redeploy). Public routes carry a 60 s edge cache that is purged on every published save, so an owner edit is immediate; an anonymous visitor who arrives between an edit and the purge may see up to 60 s-old content.
```

- [ ] **Step 11: Verify**

Run: `npx vitest run src/lib/public-urls.test.ts`
Expected: PASS — `Tests 6 passed (6)`.

Run: `npm run typecheck`
Expected: PASS with no output.

Run `npm run dev` and check the headers:

```bash
curl -sI http://localhost:3000/batches | grep -i cache-control
curl -sI http://localhost:3000/admin/login | grep -i cache-control
```

Expected: `/batches` reports `cache-control: public, max-age=0, s-maxage=60, stale-while-revalidate=600`; `/admin/login` reports `cache-control: no-store, private`.

Then confirm the purge is inert without credentials: with `CF_ZONE_ID` and `CF_PURGE_TOKEN` unset (the dev default), make any edit in `/admin/site` and save. Expected: the save succeeds, the public page reflects it, and no `edge purge` warning appears in the dev server log — `purgeEdgeCache` returns before it fetches anything.

- [ ] **Step 12: Commit**

```bash
git add src/lib/public-urls.ts src/lib/public-urls.test.ts src/lib/edge-purge.ts src/lib/revalidate-public.ts src/app/api/admin/save/route.ts next.config.mjs public/_headers PRODUCT.md
git commit -m "perf: 60s edge cache on public routes with a purge on admin save"
```

---

### Task 13: De-risk the fold against the font swap (M7)

The h1's second line sits at ~309px in a 335px column — 8% headroom, one font-swap away from becoming three lines and swinging the fold by ~40px, which would dwarf every padding tweak in Task 9.

**Files:**
- Modify: `src/app/globals.css` (anchors: `    font-family: var(--font-serif), Georgia, 'Times New Roman', serif;` and `  .animate-kenburns { animation: kenburns calc(var(--bar) * 12) ease-in-out infinite alternate }`)
- Test: manual — a computed-style check and an animation-name check. **This task ships with ZERO automated regression cover.**

**Interfaces:**
- Consumes / Produces: nothing exported.

- [ ] **Step 1: Read Task 3's finding before changing anything**

Retrieve the `FONT PRELOADS:` line recorded in Task 3 Step 5 and write it into this task's note.

- If it reads `dev-only`, fonts **are** preloaded in production, the swap window is short, and Step 2 is cheap insurance. Do it anyway — the cost is one CSS token — but record that the risk it mitigates is small.
- If it reads `blocked by htmlLimitedBots`, `blocked by dynamic layout` or `Next 15.5 behaviour`, the swap is real on every cold visit and Step 2 is **load-bearing**: it is the only mitigation this plan can ship without reversing a decision that belongs to the owner.

If Task 3 was skipped, go back and do it. Changing a font fallback to de-risk a swap whose cause is undiagnosed is guesswork.

- [ ] **Step 2: Replace the Georgia fallback**

In `src/app/globals.css`, find the exact line:

```css
    font-family: var(--font-serif), Georgia, 'Times New Roman', serif;
```

and replace it with:

```css
    /* var(--font-sans) rather than Georgia: next/font emits Inter WITH a
       size-adjusted local fallback, so the glyph advances during the swap are
       far closer to the real face than Georgia's are. The h1's second line has
       only 8% headroom in a 335px column — a wide fallback pushes it to three
       lines and swings the fold by ~40px, dwarfing every padding tweak in M4.
       `serif` stays last so the italic still resolves to something serif on a
       browser that has neither variable. */
    font-family: var(--font-serif), var(--font-sans), serif;
```

- [ ] **Step 3: Scope the ken-burns animation to `sm:` and up**

In `src/app/globals.css`, find the exact line:

```css
  .animate-kenburns { animation: kenburns calc(var(--bar) * 12) ease-in-out infinite alternate }
```

and replace it with:

```css
  /* Phones only get stillness here: this drives an infinite compositor
     animation over ~11.7 MB of GPU texture, for an effect that is hidden
     behind an opaque .hero-scrim-x on light-theme mobile anyway (spec §7.1
     finding 3). Nested inside the prefers-reduced-motion block above, so a
     phone gets no animation and a reduced-motion desktop still gets none. */
  @media (min-width: 640px) {
    .animate-kenburns { animation: kenburns calc(var(--bar) * 12) ease-in-out infinite alternate }
  }
```

- [ ] **Step 4: Verify**

Run `npm run dev`, open `http://localhost:3000` at **375 × 667**, and run:

```js
const heroImg = document.querySelector('section picture img') || document.querySelector('section img.photo');
const h1 = document.querySelector('h1');
const accent = document.querySelector('.accent');
JSON.stringify({
  kenburns: getComputedStyle(heroImg).animationName,
  h1Lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
  accentStack: getComputedStyle(accent || document.body).fontFamily,
})
```

Expected at 375px: `kenburns` is `"none"`. Resize to **1280 × 800** and re-run: `kenburns` is `"kenburns"`.

For the font stack, scroll to a section using `<Accentuate>` (e.g. "What we teach") so an `.accent` element exists, then confirm `accentStack` contains `__Fraunces` and `__Inter` and **does not** contain `Georgia`.

Then confirm there is no fold regression: with the device toolbar back at **375 × 667**, `window.scrollTo(0,0)` and re-run **Task 9 Step 1's expression**. `boardTop` must equal Task 9 Step 4's recorded value ±4px. If it moved more than that, the `.accent` change altered wrapping somewhere above the board — record where before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "perf: metric-close font fallback and no ken-burns compositor loop on phones"
```

---

### Task 14: YouTube format hint and social URL-shape validation (spec §6.1 / decision #6)

Spec §6.1's closing paragraph: *"The `SiteEditor` YouTube field gains a format hint (`https://youtube.com/@handle`) and URL-shape validation."* Task 7 shipped the other half of that paragraph — the icon renders only when a URL is set. This is the half nobody implemented.

`https://youtube.com/furorhyd` is stored today and is **not** a valid channel shape; it renders a link that 404s. Shape-checking it at save is what turns that into a form message instead of a dead icon.

**Files:**
- Create: `src/lib/social-url.ts`
- Test: `src/lib/social-url.test.ts` (new file, 6 tests)
- Modify: `src/lib/integrity.ts` (anchors: `export interface IntegrityIssue {`, `  duplicates(doc as Doc, issues);`)
- Modify: `src/app/admin/site/SiteEditor.tsx` (anchors: `import { saveSiteContent } from '@/lib/admin-save';`, the `<div className="grid sm:grid-cols-3 gap-3">` block holding the three URL fields, and the closing of the local `Field` component)

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  export const SOCIAL_KEYS: readonly ['instagram', 'facebook', 'youtube'];
  export type SocialKey = (typeof SOCIAL_KEYS)[number];
  export const SOCIAL_URL_HINT: Record<SocialKey, string>;
  export function socialUrlIssue(key: SocialKey, value: string): string | null;
  ```

**Two things this deliberately does NOT do.**
1. **Never a Zod refine (R3).** `src/lib/content.ts` catches a parse failure and serves the bundled seed for the entire public site, so a refine on `site.socials` would let one bad URL — pasted into `/admin/json`, or arriving from a restored version — blank the whole site's content. The check lives in `integrity.ts`, on the write path, beside the existing `branchSlug` check.
2. **Never a reachability check.** Nothing here fetches. A save must not depend on a third party being up, and the Workers free plan has a 10 ms CPU cap. Shape only; verifying the URL resolves is Owner action 2.

Also note the save semantics this relies on: `save-pipeline.ts` rejects only issues a patch **introduced** (`introduced(doc, integrityIssues(doc), merged, integrityIssues(merged))`). The already-stored bad YouTube URL is therefore pre-existing, so adding this check **cannot lock the owner out of `/admin/site`** — which is precisely where they go to fix it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/social-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { integrityIssues } from './integrity';
import { SOCIAL_URL_HINT, socialUrlIssue } from './social-url';

describe('socialUrlIssue', () => {
  it('accepts a well-formed profile URL for each network', () => {
    expect(socialUrlIssue('instagram', 'https://instagram.com/furorhyd')).toBe(null);
    expect(socialUrlIssue('facebook', 'https://www.facebook.com/furorhyd')).toBe(null);
    expect(socialUrlIssue('youtube', 'https://youtube.com/@furorhyd')).toBe(null);
  });

  it('treats a blank URL as "no icon", not as an error', () => {
    // Task 7 renders each icon only when its URL is set, so empty is a valid
    // stored state and must never block a save.
    expect(socialUrlIssue('youtube', '')).toBe(null);
  });

  it('rejects the bare-path YouTube URL stored today and names the shape it wants', () => {
    const issue = socialUrlIssue('youtube', 'https://youtube.com/furorhyd');
    expect(issue).toContain(SOCIAL_URL_HINT.youtube);
    expect(issue).toContain('/furorhyd');
  });

  it('rejects a non-https scheme, a wrong host and an unparseable string', () => {
    expect(socialUrlIssue('instagram', 'http://instagram.com/furorhyd')).toContain('https://');
    expect(socialUrlIssue('instagram', 'https://example.com/furorhyd')).toContain('instagram.com');
    expect(socialUrlIssue('facebook', 'not a url')).toContain('valid URL');
  });
});

describe('integrityIssues — social URLs', () => {
  // These wiring assertions live here rather than in integrity.test.ts because
  // a concurrent plan appends to that file, and both plans' cumulative test
  // counts have to stay predictable (R4).
  it('reports a malformed social URL on the write path', () => {
    const issues = integrityIssues({
      site: { socials: { youtube: 'https://youtube.com/furorhyd' } },
    });
    expect(issues.map((i) => i.path)).toEqual([['site', 'socials', 'youtube']]);
  });

  it('reports nothing for a document with no socials block', () => {
    expect(integrityIssues({ site: {} })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/social-url.test.ts`

Expected: FAIL with `Failed to resolve import "./social-url" from "src/lib/social-url.test.ts"`.

- [ ] **Step 3: Write the shape check**

Create `src/lib/social-url.ts`:

```ts
// Shape-only validation for the three URLs in site.socials.
//
// WRITE PATH ONLY (integrity.ts), never a Zod refine: content.ts wraps
// SiteContentSchema.parse in a try/catch that falls back to the bundled seed,
// so a refine rejecting one stored URL would swap the ENTIRE public site for
// seed content. As a write-path check the same violation merely refuses a save.
//
// Shape, not reachability. Nothing here fetches: a save must not depend on a
// third party being up, and the Workers free plan has a 10ms CPU cap.

export const SOCIAL_KEYS = ['instagram', 'facebook', 'youtube'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

const LABEL: Record<SocialKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

/** Shown in the admin as the field hint and quoted in every error message. */
export const SOCIAL_URL_HINT: Record<SocialKey, string> = {
  instagram: 'https://instagram.com/furorhyd',
  facebook: 'https://facebook.com/furorhyd',
  youtube: 'https://youtube.com/@handle',
};

const HOSTS: Record<SocialKey, readonly string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  youtube: ['youtube.com', 'm.youtube.com', 'youtu.be'],
};

// A YouTube channel is /@handle, /channel/UC…, /c/Name or /user/Name. A bare
// /name — which is what is stored today — is not a channel and 404s.
const YOUTUBE_CHANNEL_PATH = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/;

/** Null means "store it". A string is the message shown to the admin. */
export function socialUrlIssue(key: SocialKey, value: string): string | null {
  if (value === '') return null; // blank means "no icon", a valid state

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `${LABEL[key]} URL is not a valid URL. Use ${SOCIAL_URL_HINT[key]}.`;
  }

  if (url.protocol !== 'https:') {
    return `${LABEL[key]} URL must start with https:// — use ${SOCIAL_URL_HINT[key]}.`;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!HOSTS[key].includes(host)) {
    return `${LABEL[key]} URL must point at ${HOSTS[key][0]} — use ${SOCIAL_URL_HINT[key]}.`;
  }

  if (key === 'youtube' && !YOUTUBE_CHANNEL_PATH.test(url.pathname)) {
    return (
      `YouTube URL must name a channel: ${SOCIAL_URL_HINT.youtube}, /channel/UC…, /c/… or ` +
      `/user/…. "${url.pathname}" is not a channel path and will 404.`
    );
  }

  if (url.pathname === '' || url.pathname === '/') {
    return `${LABEL[key]} URL must include the profile path. Use ${SOCIAL_URL_HINT[key]}.`;
  }

  return null;
}
```

- [ ] **Step 4: Wire it into the write path**

In `src/lib/integrity.ts`, find the exact line:

```ts
export interface IntegrityIssue {
```

and replace it with:

```ts
import { SOCIAL_KEYS, socialUrlIssue } from './social-url';

export interface IntegrityIssue {
```

Then find the exact line:

```ts
/** Every invariant violation in the document. Empty means consistent. */
```

and replace it with:

```ts
// Social URLs are shape-checked here, not in the schema: a Zod refine would
// run on every read and a single malformed URL would make getContent() serve
// the bundled seed for the whole public site. Note save-pipeline.ts only
// rejects issues a patch INTRODUCED, so the already-stored bad YouTube URL
// stays saveable — which matters, because /admin/site is where it gets fixed.
function socials(doc: Doc, issues: IntegrityIssue[]): void {
  const site = doc.site;
  if (site == null || typeof site !== 'object') return;
  const bag = (site as Row).socials;
  if (bag == null || typeof bag !== 'object') return;
  for (const key of SOCIAL_KEYS) {
    const value = (bag as Row)[key];
    if (typeof value !== 'string') continue;
    const issue = socialUrlIssue(key, value.trim());
    if (issue) issues.push({ path: ['site', 'socials', key], message: issue });
  }
}

/** Every invariant violation in the document. Empty means consistent. */
```

Then find the exact line:

```ts
  duplicates(doc as Doc, issues);
```

and replace it with:

```ts
  duplicates(doc as Doc, issues);
  socials(doc as Doc, issues);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/social-url.test.ts`

Expected: PASS — `Test Files 1 passed (1)`, `Tests 6 passed (6)`.

Then confirm the existing integrity suite is untouched:

Run: `npx vitest run src/lib/integrity.test.ts`
Expected: PASS — `Tests 8 passed (8)`. This plan adds nothing to that file (R4); if the count is not 8, something edited it.

- [ ] **Step 6: Add the hint and the live warning to `SiteEditor`**

In `src/app/admin/site/SiteEditor.tsx`, find the exact line:

```ts
import { saveSiteContent } from '@/lib/admin-save';
```

and replace it with:

```ts
import { saveSiteContent } from '@/lib/admin-save';
import { SOCIAL_URL_HINT, socialUrlIssue, type SocialKey } from '@/lib/social-url';
```

Then find the three-column block that opens with the exact line:

```tsx
        <div className="grid sm:grid-cols-3 gap-3">
```

and replace that element in full — from that opening tag through its matching `</div>` (it currently holds the Instagram URL, Facebook URL and YouTube URL fields) — with:

```tsx
        {/* Format hints + a live shape warning (spec §6.1). The warning is
            advisory; the authority is integrityIssues() on the save path, so a
            malformed URL cannot be stored even by pasting into /admin/json. */}
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Instagram URL" hint={`Format: ${SOCIAL_URL_HINT.instagram}`}>
            <input
              value={c.site.socials.instagram || ''}
              onChange={(e) => patchSite({ socials: { ...c.site.socials, instagram: e.target.value } })}
              placeholder={SOCIAL_URL_HINT.instagram}
              className="input"
            />
            <SocialUrlNote k="instagram" value={c.site.socials.instagram || ''} />
          </Field>
          <Field label="Facebook URL" hint={`Format: ${SOCIAL_URL_HINT.facebook}`}>
            <input
              value={c.site.socials.facebook || ''}
              onChange={(e) => patchSite({ socials: { ...c.site.socials, facebook: e.target.value } })}
              placeholder={SOCIAL_URL_HINT.facebook}
              className="input"
            />
            <SocialUrlNote k="facebook" value={c.site.socials.facebook || ''} />
          </Field>
          <Field
            label="YouTube URL"
            hint={`Format: ${SOCIAL_URL_HINT.youtube} — a bare /name is not a channel and will 404. Leave blank to hide the icon.`}
          >
            <input
              value={c.site.socials.youtube || ''}
              onChange={(e) => patchSite({ socials: { ...c.site.socials, youtube: e.target.value } })}
              placeholder={SOCIAL_URL_HINT.youtube}
              className="input"
            />
            <SocialUrlNote k="youtube" value={c.site.socials.youtube || ''} />
          </Field>
        </div>
```

Then add the note component. Find the exact closing of the file's local `Field` helper:

```tsx
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
```

and replace it with:

```tsx
// Advisory only — the save path is the authority. Rendering the same message
// the server would return means the admin sees it while typing rather than
// after losing a save.
function SocialUrlNote({ k, value }: { k: SocialKey; value: string }) {
  const issue = socialUrlIssue(k, value.trim());
  if (!issue) return null;
  return <p className="mt-1 text-xs text-ember-400">{issue}</p>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
```

- [ ] **Step 7: Verify in the admin**

Run: `npm run typecheck`
Expected: PASS with no output.

Run `npm run dev`, sign in, open `http://localhost:3000/admin/site`.

Expected:
- All three URL fields show a `Format: …` hint; the YouTube hint reads `Format: https://youtube.com/@handle — a bare /name is not a channel and will 404. Leave blank to hide the icon.`
- The YouTube field already holds `https://youtube.com/furorhyd` and shows the ember warning beneath it immediately, without typing.
- Typing `https://youtube.com/@furorhyd` clears the warning live.
- **Save with the bad URL still in place succeeds** — it is a pre-existing issue, not one this patch introduced, and locking the owner out of the screen where they fix it would be the wrong failure mode.
- Now change something else (e.g. the tagline) **and** paste `htp://instagram.com/x` into the Instagram field, then save. Expected: the save is refused with the Instagram message — that issue *is* newly introduced.

- [ ] **Step 8: Commit**

```bash
git add src/lib/social-url.ts src/lib/social-url.test.ts src/lib/integrity.ts src/app/admin/site/SiteEditor.tsx
git commit -m "feat: social url format hints and write-path shape validation"
```

---

### Task 15: Update the performance budget in PRODUCT.md

Spec decision #10: the measured React/Next framework floor alone is **100.14 KB gz** — above the stated `<100KB` budget before a single line of application code. Home is 123.60 KB. Task 2 built the meter that makes the replacement budget checkable; this writes it down.

**Files:**
- Modify: `PRODUCT.md` (anchor: the `- Performance budget (binding):` line)
- Test: manual — a diff read-back

**Interfaces:**
- Consumes / Produces: nothing. Documentation.

- [ ] **Step 1: Replace the budget line**

In `PRODUCT.md`, find the exact line:

```markdown
- Performance budget (binding): LCP < 2.5 s, CLS < 0.1, INP < 200 ms on Lighthouse mobile; first-load JS < 100 KB gzip per route; hero image < 120 KB AVIF; hero video < 2 MB.
```

and replace it with:

```markdown
- Performance budget (binding): LCP < 2.5 s, CLS < 0.1, INP < 200 ms on Lighthouse mobile; first-load JS **total < 115 KB gzip per route**, of which **app-authored client JS < 12 KB gzip per route** (the React/Next framework floor alone measures 100.14 KB gz, so a single sub-100 KB number was unreachable without leaving Next.js — home is 123.60 KB total / 23.46 KB app-authored today); LCP image < 45 KB AVIF; hero video < 2 MB. Check both with `npm run build && npm run audit:bundle`.
```

If the numbers you recorded in Task 2 Step 3 differ from 123.60 / 100.14 / 23.46, use **your measured numbers** in the parenthetical — the budget thresholds (115 / 12 / 45) stay as specified either way.

- [ ] **Step 2: Verify the diff reads correctly**

Run: `git diff PRODUCT.md`

Expected: exactly one changed line. It must contain `total < 115 KB gzip per route`, `app-authored client JS < 12 KB gzip per route`, `LCP image < 45 KB AVIF` and `npm run audit:bundle`; and it must no longer contain `first-load JS < 100 KB gzip per route` or `hero image < 120 KB AVIF`.

- [ ] **Step 3: Commit**

```bash
git add PRODUCT.md
git commit -m "docs: split the first-load js budget into a total and an app-authored sub-budget"
```

---

### Task 16: Full suite, typecheck, and final measurement

**Files:**
- Test: the whole repo

**Interfaces:**
- Consumes: everything built in Tasks 1–15
- Produces: the verified green baseline Plan 3 (`2026-08-10-post-payment-batches.md`) starts from

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`

Expected: **`Test Files 34 passed (34)`, `Tests 352 passed (352)`.**

The arithmetic, stated so a mismatch is diagnosable. The baseline is **Plan 1's end state**, not the pre-Plan-1 repo — this plan runs second (R6):

| file | tests |
|---|---|
| baseline: Plan 1's end state (29 files, unchanged by this plan) | 317 |
| `src/lib/image-variants.test.ts` (new) | 8 |
| `src/lib/image-downscale.test.ts` (new) | 7 |
| `src/lib/image-dimensions.test.ts` (new) | 8 |
| `src/lib/public-urls.test.ts` (new) | 6 |
| `src/lib/social-url.test.ts` (new) | 6 |
| **total** | **34 files / 352** |

This plan's delta is **+5 files, +35 tests** (8+7+8+6+6 = 35): 317 + 8 + 7 + 8 + 6 = 346 across the four image and cache modules; + 6 for `social-url` = **352**. `src/lib/integrity.test.ts` stays at **8** — this plan appends nothing to it (R4), leaving Plan 3's expected 8 → 12 intact. If Plan 1 finished on a number other than 29/317, apply the +5/+35 delta to whatever it actually finished on and record that instead of stopping.

If the count differs: a **lower file count** means a new test file was never committed; a failure in `save-pipeline.test.ts` or `drafts-core.test.ts` means Task 8's or Task 9's content edit is malformed; a failure in `integrity.test.ts` means Task 14 Step 4 broke an existing invariant rather than adding one.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS, no output, exit code 0.

- [ ] **Step 3: Confirm the content document and the seed are in sync**

Run: `npm run sync-seed -- --check`

Expected: `✓ seed is in sync with data/site-content.json`.

This is the check that catches a hand-edited seed (R2). If it fails, one of Tasks 8 or 9 wrote the seed directly instead of regenerating it — re-run `npm run sync-seed` and re-verify, then confirm the intended values are still present:

```bash
node -e "const j=require('./src/data/site-content.seed.json');console.log(j.hero.subHeadline.length,'chars |',JSON.stringify(j.tonight.when))"
```

Expected: `142 chars | "Every Saturday · 7 PM"`.

- [ ] **Step 4: Re-run both audits and record the deltas**

Run: `npm run audit:images`

Expected: **unchanged** from Task 1 — `7 requests, 1,454,235 B`, `LCP resource: 297,280 B ... FAIL`. The audit measures what the **content document** points at; only the hero's markup was re-pointed, not the field.

Then `npm run dev`, `http://localhost:3000` at **375 × 667**, hard reload, Network tab filtered to `Img`, and record:

- total image transfer: expected ≈ **1,197,400 B** (was 1,454,235 B) — a **≈17.7%** reduction, entirely from the LCP element
- LCP resource: `dsc-0166-hero-portrait-750-<hash>.avif` at the byte count recorded in Task 4 Step 5 (spec §7.2 measured 40,488 B; **must** be < 45,000 B) — a **≈86%** reduction from 297,280 B
- `DSC_0166.jpg` must **not** appear in the request list

The remaining ≈**970 KB** is the style cards and studio photos, whose variants and `immutable` cache headers now exist but whose markup still points at the masters — the follow-up named in this plan's Goal, not a defect in it.

Run: `npm run build && npm run audit:bundle`

Expected: the `/` row is within ~1 KB of Task 2 Step 3's baseline. This plan adds `SocialIcons.tsx` (inline SVG, no JS) to two client components and removes nothing, so a change larger than ~1 KB means something unexpected entered the client bundle — most likely `src/lib/image-variants.ts` being imported from `Hero.tsx` instead of `page.tsx`. Check that first.

- [ ] **Step 5: Re-run the mobile assertions one last time**

At **360 × 640**, **375 × 667** and **390 × 844**, run:

```js
JSON.stringify({
  width: window.innerWidth,
  noHScroll: document.documentElement.scrollWidth === window.innerWidth,
  boardTop: Math.round(document.querySelector('#start-this-week').getBoundingClientRect().top + window.scrollY),
  visibleAboveFold: Math.max(0, Math.round(window.innerHeight - document.querySelector('#start-this-week').getBoundingClientRect().top)),
  kenburns: getComputedStyle(document.querySelector('section picture img')).animationName,
})
```

Expected: `noHScroll` is `true` at all three widths; `boardTop` matches Task 9 Step 4's recorded value ±4px at 375px; `visibleAboveFold` is ≥ 87px at 375 × 667; `kenburns` is `"none"`.

This is the only regression cover the header, fold and font tasks have. Paste the three results into the completion note so the next person has the numbers to compare against.

- [ ] **Step 6: Confirm the tree is clean**

Run: `git status --short`

Expected: **empty output.**

If anything is uncommitted, it belongs to the task that produced it — commit it there with that task's message style, never as a catch-all. The usual offender is `data/site-content.json` left out of Task 8's or Task 9's `git add`.

Also confirm no dead `sizes` prop survived:

```bash
grep -rn "sizes=" src/ | grep -v "src/components/Hero.tsx"
```

Expected: no output. The only `sizes` attributes left in the repo are the six inside `Hero.tsx`'s hand-written `<picture>`, where the browser genuinely honours them.

---

### Task 17: Baseline the Worker CPU-per-render against the 10 ms cap

Spec §10 names Zod node-count growth **"the single measurable risk in the spec"**, and spec §7.5 asks for a Worker CPU measurement against the free plan's 10 ms cap. Nothing in any of the four plans measures it — so the risk the spec calls its only measurable one is, today, unmeasured.

The exposure is real and it is *cumulative across the four plans*, not this one's: `src/lib/content.ts` runs `SiteContentSchema.parse(...)` on **every** public render (the root layout's `await connection()` opts every route out of static rendering, so there is no cached HTML to amortise it against), and Plans 1, 3 and 4 add roughly **180 new schema leaves** between them — `LabelsSchema` alone is 56 keys. Each leaf is parse work on the request path.

This plan is the right place to take the number because it adds **zero** schema fields (see Global Constraints: `src/lib/content-schema.ts` is untouched here), so a reading taken now is a clean post-Plan-1 baseline that Plans 3 and 4 can be measured against afterwards. Take it now; without it, "Plan 4 made rendering slower" is unfalsifiable.

**Files:**
- Test: manual — a recorded measurement. This task changes **no files** and makes **no commit**, exactly like Task 3. `wrangler.jsonc:69` already sets `"observability": { "enabled": true }`, so nothing needs enabling.

**Interfaces:**
- Consumes: the deployed Worker; `wrangler tail`; `src/lib/content.ts` (the `SiteContentSchema.parse` on the read path)
- Produces: a finding pasted into the completion note, in the shape `WORKER CPU (post-Plan-2 baseline): p50 <x> ms, p90 <y> ms over <n> renders of /`. Hand this number to Plan 3 and Plan 4.

- [ ] **Step 1: Tail the deployed Worker and capture CPU time per render**

In one shell:

```bash
npx wrangler tail --format=json > cpu-baseline.ndjson
```

In a second shell, drive at least 20 cold-ish public renders (the 30 s TTL cache in `content.ts` means back-to-back hits share a raw read — space them out so you measure real parses, not cache hits):

```bash
for i in $(seq 1 20); do curl -s -o /dev/null "https://www.dancehyderabad.com/?cpu=$i"; sleep 2; done
```

Stop the tail, then summarise:

```bash
node -e "const l=require('fs').readFileSync('cpu-baseline.ndjson','utf8').trim().split('\n').map(s=>{try{return JSON.parse(s)}catch{return null}}).filter(Boolean).map(e=>e.cpuTime??e.wallTime).filter(v=>typeof v==='number').sort((a,b)=>a-b);console.log('n',l.length,'p50',l[Math.floor(l.length*0.5)],'p90',l[Math.floor(l.length*0.9)],'max',l[l.length-1])"
```

Record `n`, `p50`, `p90` and `max`. If `cpuTime` is absent from the tail events, fall back to the **CPU Time** chart in the Cloudflare dashboard (Workers & Pages → the Worker → Metrics) over the same window and record the p50/p99 it reports, noting which source you used.

Delete `cpu-baseline.ndjson` when done — it is a scratch artifact and must not be committed (Task 16 Step 6's clean-tree gate).

- [ ] **Step 2: Record the finding and the headroom**

Write the finding into the completion note, plus the headroom against the cap:

```
WORKER CPU (post-Plan-2 baseline): p50 <x> ms, p90 <y> ms over <n> renders of /
Headroom against the 10 ms free-plan cap: <10 - y> ms at p90
```

Interpretation, so the number is actionable rather than decorative:
- **p90 under ~3 ms** — comfortable. Plans 3 and 4 can add their schema leaves and re-measure with this same recipe.
- **p90 between ~3 and ~6 ms** — record it as a watch item and re-run this task after Plan 4, before it is called done.
- **p90 over ~6 ms** — raise it before Plan 4 starts. The remaining schema growth is likely to breach the cap, and a breach on Workers is a `1102` error to the visitor, not a slow page.

- [ ] **Step 3: Write down the mitigation, so the next person does not have to rediscover it**

Do **not** implement it here — this task measures only. Record in the completion note that the fix the spec names is already half-built:

`src/lib/content.ts` memoises only the **raw string** across requests (the module-level `cached` slot holding `{ raw, version, at }` on a 30 s TTL), while `SiteContentSchema.parse(...)` re-runs on every request inside the React-`cache()`d `loadContent`. That memo can be **widened to cache the parsed object** alongside the raw string, which collapses the per-render Zod cost to roughly one parse per isolate per 30 s regardless of how many leaves the schema grows to.

Two constraints on whoever does it, both already load-bearing in this file:
1. `bustContentCache()` must clear the parsed object too, or an admin save leaves a stale render behind for up to 30 s.
2. The parsed object must be treated as immutable and shared — it would be handed to concurrent requests in the same isolate, so no caller may mutate it in place.

This is a note, not a task. It becomes a task only if Step 2 lands in the amber or red band.

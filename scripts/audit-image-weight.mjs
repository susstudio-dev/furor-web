#!/usr/bin/env node
// Image-weight meter for the home route.
//
// Spec §7.5 names this number as the thing that must be captured BEFORE any
// mobile work starts and re-checked after, so it lives in the repo rather than
// in someone's terminal history.
//
// Task 16 rebuild: before this, the script resolved `hero.posterImage` off
// the content document and measured that file — the 2000x1335 master, still
// correctly the admin-editable source of truth and Task 6's null-poster
// fallback target. But since Task 6 the browser never fetches that URL for
// the hero; it negotiates an AVIF variant out of a hand-written <picture>.
// The old script printed "LCP resource: 297,280 B FAIL" and would print that
// FOREVER no matter how good the pipeline got — it could not observe success.
//
// This version instead:
//   1. Negotiates what a browser actually fetches — the same srcset/sizes
//      selection algorithm a browser runs, applied to the real emitted
//      <picture> source sets (`src/lib/lcp-negotiation.ts`, unit-tested
//      against the real committed manifest in lcp-negotiation.test.ts).
//   2. Reports each named device profile separately (375x667 @DPR2,
//      390x844 @DPR3) against the per-DPR budget PRODUCT.md now carries,
//      instead of one flat number.
//   3. Reports two bases — initial-viewport (eager-loaded only) and
//      full-route (every referenced image) — and marks every row so the two
//      can never be silently blended. Post-Task-6 the full-route total is
//      HIGHER than the pre-plan baseline, not lower: the studio gallery
//      still requests the raw master lazily, and the hero now additionally
//      fetches a distinct AVIF variant. Only the eager/initial-viewport
//      basis carries the win.
//   4/5. Closes the loop against real markup for the one thing that matters
//      most: preload placement. Task 6 once shipped preload <link>s that
//      rendered inert in <body> because they lacked a real string `href` —
//      react-dom's SSR "Resource" hoisting requires one. A live browser's
//      DOM cannot be trusted to catch a regression like that (React's client
//      resource management moves recognized <link>s into <head> on
//      hydration regardless of where they sit), so this renders the same
//      preload markup page.tsx emits through react-dom/server directly (no
//      jsdom, no browser, no dev server) and asserts byte-offset placement
//      against the real SSR output.
//
//   node scripts/audit-image-weight.mjs
//   npm run audit:images

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// Pre-plan baseline (measured, Task 1) — cited for context, never re-derived.
const BASELINE_FULL_ROUTE_BYTES = 1454235;
const BASELINE_REQUESTS = 7;
// Pre-Task-6, the hero's own <Img fill priority> made it (plus the
// always-eager BrandMark logo) the entire eager/initial-viewport set —
// per Task 6's report ("the original Hero component used
// `<Img fill priority sizes=\"100vw\">`").
const BASELINE_EAGER_BYTES = 14837 /* logo-mark.png */ + 297280; /* DSC_0166.jpg master */

// `src/lib/lcp-negotiation.ts` is dependency-free on purpose (see its
// top-of-file comment) so it can be loaded here without a bundler: strip its
// TypeScript syntax with esbuild (already an installed dependency, pulled in
// transitively by vitest — no new package added) and import the resulting
// plain JS from a data: URL. That only works because the module has zero
// runtime import specifiers to resolve.
async function loadNegotiationLib() {
  const src = readFileSync(resolve(ROOT, 'src/lib/lcp-negotiation.ts'), 'utf8');
  const { code } = transformSync(src, { loader: 'ts', format: 'esm', sourcefile: 'lcp-negotiation.ts' });
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

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

function loadManifest() {
  const full = resolve(ROOT, 'src/data/image-variants.json');
  if (!existsSync(full)) return {};
  return JSON.parse(readFileSync(full, 'utf8'));
}

function byteSize(url) {
  if (!url.startsWith('/')) return null; // remote URL — not ours to measure
  const full = resolve(ROOT, 'public', url.slice(1));
  if (!existsSync(full)) return null; // R2-backed upload, absent locally
  return statSync(full).size;
}

// /logo-mark.png is not in the content document — BrandMark hardcodes it —
// but every page requests it once (same URL, header + footer). Leaving it
// out would understate the route. It renders with `loading="eager"` (no
// `priority`, per Task 6) — visible above the fold on first paint, so it
// belongs in the eager/initial-viewport basis alongside the hero.
const BRAND_MARK = '/logo-mark.png';

// Every image the content document references, EXCLUDING the hero's own
// fetch — that is handled separately below because since Task 6 it is no
// longer `hero.posterImage`'s raw URL (when pre-built variants exist). If
// `heroResolved` is false, Hero.tsx's null-poster branch renders the raw
// master with `priority`, so it is added back here as an eager row.
function contentReferencedRows(content, heroResolved) {
  const rows = [];
  const push = (url, role, eager) => {
    if (typeof url === 'string' && url.length > 0) rows.push({ url, role, eager });
  };
  push(BRAND_MARK, 'BrandMark', true);
  if (!heroResolved) {
    push(content.hero.posterImage, 'hero.posterImage (raw fallback — no pre-built variants)', true);
  }
  for (const s of content.danceStyles) push(s.heroImage, 'danceStyles[].heroImage', false);
  for (const s of content.studios) for (const p of s.photos) push(p, 'studios[].photos', false);
  // One request per distinct URL — DSC_0166.jpg is both the hero's admin
  // field and a Jubilee studio photo; the browser fetches it once. Without
  // this the baseline reads 1,751,515 B instead of 1,454,235 B.
  const seen = new Set();
  return rows.filter((r) => (seen.has(r.url) ? false : seen.add(r.url)));
}

// Renders the exact preload pattern page.tsx emits (two <link>s, real
// string `href`s, siblings ahead of the rest of the tree, which Next's root
// layout places inside <body>) through the real react-dom/server engine, so
// the placement check runs against genuine SSR output rather than an
// assumption. Mirrors lcp-negotiation.test.ts's fixture; see that file for
// the reproduction of the historical (hrefless) bug this catches.
function renderPreloadMarkup(poster) {
  function firstUrl(srcSet) {
    return srcSet.split(',')[0].trim().split(' ')[0];
  }
  const linkProps = (media, href, imageSrcSet) => ({
    rel: 'preload',
    as: 'image',
    type: 'image/avif',
    media,
    href,
    imageSrcSet,
    imageSizes: '100vw',
    fetchPriority: 'high',
  });
  const tree = createElement(
    'html',
    null,
    createElement('head', null),
    createElement(
      'body',
      null,
      createElement('link', linkProps('(max-width: 639px)', poster.portrait.jpgSrc, poster.portrait.avif)),
      createElement(
        'link',
        linkProps('(min-width: 640px)', firstUrl(poster.landscape.jpg), poster.landscape.avif),
      ),
      createElement('div', null, 'rest of the page (Hero, QuickEnroll, …)'),
    ),
  );
  return renderToStaticMarkup(tree);
}

const n = (v) => v.toLocaleString('en-US');
const kb = (v) => (v / 1024).toFixed(1);

async function main() {
  const lib = await loadNegotiationLib();
  const { source, content } = loadContent();
  const manifest = loadManifest();

  const heroSrc = content.hero.posterImage;
  const poster = lib.buildHeroPosterFromManifest(manifest, heroSrc);
  const heroResolved = poster !== null;

  console.log(`Content document: ${source}`);
  console.log('');

  const baseRows = contentReferencedRows(content, heroResolved).map((r) => ({ ...r, bytes: byteSize(r.url) }));

  console.log('='.repeat(78));
  console.log('BASIS 1: initial-viewport bytes vs. BASIS 2: full-route bytes');
  console.log('These are never blended — every row below is tagged eager or lazy, and');
  console.log('each total is a straight sum of the rows tagged for it.');
  console.log('='.repeat(78));

  if (!heroResolved) {
    console.log('');
    console.log(
      `⚠ heroPoster('${heroSrc}') has no pre-built variants — Hero.tsx's null-poster`,
    );
    console.log('  fallback is active (raw master, eager). No <picture>/preload markup renders,');
    console.log('  so per-DPR negotiation and the placement check below are both skipped.');
  }

  for (const profile of lib.DEVICE_PROFILES) {
    console.log('');
    console.log(`--- Device profile: ${profile.name} ---`);
    const rows = [...baseRows];
    let heroRow = null;
    if (heroResolved) {
      const negotiated = lib.negotiateHeroLcp(poster, profile);
      heroRow = {
        url: negotiated.url,
        role: `hero LCP <picture>, negotiated (${profile.name})`,
        eager: true,
        bytes: byteSize(negotiated.url),
      };
      rows.push(heroRow);
    }

    const onDisk = rows.filter((r) => r.bytes != null).sort((a, b) => b.bytes - a.bytes);
    const missing = rows.filter((r) => r.bytes == null);
    for (const r of onDisk) {
      console.log(
        `  ${r.eager ? 'EAGER' : 'lazy '}  ${n(r.bytes).padStart(11)} B  ${r.url.padEnd(42)} ${r.role}`,
      );
    }
    for (const r of missing) {
      console.log(`  ????? ${' '.repeat(11)}   ${r.url.padEnd(42)} ${r.role}  (not on disk)`);
    }

    const eagerTotal = onDisk.filter((r) => r.eager).reduce((s, r) => s + r.bytes, 0);
    const fullTotal = onDisk.reduce((s, r) => s + r.bytes, 0);
    console.log('');
    console.log(
      `  Initial-viewport bytes (eager only):  ${n(eagerTotal).padStart(11)} B  (${onDisk.filter((r) => r.eager).length} requests)`,
    );
    console.log(
      `  Full-route bytes (every reference):   ${n(fullTotal).padStart(11)} B  (${onDisk.length} requests)`,
    );
    console.log(
      `    vs. pre-plan baseline:              ${n(BASELINE_FULL_ROUTE_BYTES)} B (${BASELINE_REQUESTS} requests) — Δ ${
        fullTotal - BASELINE_FULL_ROUTE_BYTES >= 0 ? '+' : ''
      }${n(fullTotal - BASELINE_FULL_ROUTE_BYTES)} B. Full-route weight is expected to RISE post-Task-6 (the`,
    );
    console.log(
      '    studio gallery still requests the raw master lazily; the hero now ALSO fetches a distinct AVIF).',
    );

    if (heroRow) {
      const budget = profile.dpr <= 2 ? 45000 : 60000;
      const cmp = profile.dpr <= 2 ? '<' : '≤';
      const pass = heroRow.bytes != null && (profile.dpr <= 2 ? heroRow.bytes < budget : heroRow.bytes <= budget);
      console.log('');
      console.log(
        `  LCP resource (${profile.name}): ${n(heroRow.bytes)} B  (target ${cmp} ${n(budget)} B)  ${
          pass ? 'PASS' : 'FAIL'
        }`,
      );
      console.log(
        `    vs. pre-Task-6 eager baseline (this profile's LCP element was the raw master): ${n(
          297280,
        )} B — a ${(((297280 - heroRow.bytes) / 297280) * 100).toFixed(1)}% reduction.`,
      );
    }
  }

  console.log('');
  console.log('='.repeat(78));
  console.log('Preload placement — asserted against real react-dom/server SSR output');
  console.log('='.repeat(78));
  if (heroResolved) {
    const html = renderPreloadMarkup(poster);
    const result = lib.assertPreloadPlacement(html);
    console.log(`  ${result.preloadCount} preload <link rel="preload" as="image"> tag(s) rendered.`);
    console.log(`  Placement check: ${result.ok ? 'PASS' : 'FAIL'}`);
    for (const issue of result.issues) console.log(`    - ${issue}`);
  } else {
    console.log('  Skipped — no <picture>/preload markup renders in the null-poster fallback branch.');
  }

  console.log('');
  console.log('='.repeat(78));
  console.log('Context: eager-basis win vs. the pre-plan baseline');
  console.log('='.repeat(78));
  console.log(
    `  Pre-plan (BrandMark + raw hero master, both eager): ${n(BASELINE_EAGER_BYTES)} B (Task 6's report).`,
  );
  console.log('  Post-Task-6, per device profile: see "Initial-viewport bytes" above.');

  // Site-wide debt this script cannot weigh: uploads live in R2 in production
  // and public/uploads/ is gitignored, so they never resolve here.
  const allRefs = new Set();
  for (const i of content.instructors) if (i.photo) allRefs.add(i.photo);
  const unresolved = [...allRefs].filter((u) => byteSize(u) == null);
  if (unresolved.length) {
    console.log('');
    console.log('Not measurable on disk (R2-backed uploads or remote URLs):');
    for (const u of unresolved) console.log(`  ${u}  instructors[].photo`);
  }
}

await main();

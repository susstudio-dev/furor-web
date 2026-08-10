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

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
  // /uploads/ is gitignored and R2-backed (migrate-to-r2.mjs) — admins replace
  // these without a git commit, so the immutable hash-in-filename contract
  // this pipeline relies on cannot hold for them. Skip by path, not by
  // existsSync: a dev machine can have stale local copies under
  // public/uploads/ (untracked, left over from local testing) that a fresh
  // clone would not have, and baking those incidental bytes into a committed
  // manifest would ship a stale rendition the moment the admin swaps the photo.
  if (url.startsWith('/uploads/')) {
    skipped.push(url);
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

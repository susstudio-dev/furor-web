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

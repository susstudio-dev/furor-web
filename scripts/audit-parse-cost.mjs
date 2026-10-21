#!/usr/bin/env node
// Zod parse-cost meter for the content document (spec §7.5 / §10, Task 17).
//
// Spec §10 names Zod node-count growth "the single measurable risk in the
// spec": `src/lib/content.ts` runs `SiteContentSchema.parse(mergeWithSeed(...))`
// on every public render (the root layout's `await connection()` opts every
// route out of static rendering, so there is no cached HTML to amortise it
// against), and Plans 1/3/4 add ~180 new schema leaves between them —
// `LabelsSchema` alone is 56 keys. Spec §7.5 asks this be measured against the
// Workers free plan's 10ms-per-request CPU cap.
//
// The honest version of that measurement is a DEPLOYED Worker: `wrangler tail
// --format=json` reports real `cpuTime` per request, on the real V8-isolate
// runtime, under the real request pipeline (routing, R2 read, headers,
// streaming). This branch is not deployed, and deploying is an owner action —
// see the "Owner action" section of the Task 17 report for the exact recipe
// once it is.
//
// What CAN be measured without a deploy is the dominant synchronous cost on
// that path: JSON.parse + mergeWithSeed + SiteContentSchema.parse, run
// in-process, on the REAL committed content document, hundreds of times, with
// wall-clock timing. This is a PROXY, not the Worker number:
//   - It runs on Node's V8, not workerd's V8. Same engine family, different
//     build/flags/embedder — cold-compile and GC behaviour can differ.
//   - It excludes everything else a request pays for: routing, the R2 (or
//     filesystem, in dev) read itself, header/response construction, any
//     React rendering downstream of `getContent()`.
//   - It cannot see isolate reuse/eviction patterns — see the report for what
//     that means for the "cold" number below.
// Treat every number this script prints as a lower bound on real Worker CPU
// time for this one operation, not an upper bound on total request cost.
//
//   npm run audit:parse-cost
//   npm run audit:parse-cost -- --strict   # exit 1 if steady-state p90 > 6ms

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync, transformSync } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const strict = process.argv.includes('--strict');

// ── Load the real modules under test ────────────────────────────────────────
// content-schema.ts pulls in zod (a real npm dependency) plus two zero-import
// local modules (label-defaults.ts, hero-defaults.ts), so — unlike
// lcp-negotiation.ts in audit-image-weight.mjs — it cannot be loaded with a
// bare TS-syntax strip. esbuild's bundler (already an installed dependency,
// transitively pulled in by vitest — no new package added) resolves and
// inlines the whole graph, including zod itself, into one self-contained ESM
// string, which is then imported from a data: URL. No temp files, no writes
// outside memory.
function loadSchemaModule() {
  const result = buildSync({
    entryPoints: [resolve(ROOT, 'src/lib/content-schema.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    target: 'node18',
  });
  const code = result.outputFiles[0].text;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

// content-merge.ts has zero imports (by design — see its top-of-file comment
// and content.ts's), so a plain TS-syntax strip is enough, same technique
// audit-image-weight.mjs uses for lcp-negotiation.ts.
function loadMergeModule() {
  const src = readFileSync(resolve(ROOT, 'src/lib/content-merge.ts'), 'utf8');
  const { code } = transformSync(src, { loader: 'ts', format: 'esm', sourcefile: 'content-merge.ts' });
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

// ── Load the real document ──────────────────────────────────────────────────
// Prefers the live local store (data/site-content.json, gitignored, whatever
// this machine's admin has actually saved) and falls back to the bundled seed
// — same precedence and BOM-handling as audit-image-weight.mjs's loadContent,
// and the same JSON.parse content.ts's real read path runs.
function loadRawDoc() {
  for (const rel of ['data/site-content.json', 'src/data/site-content.seed.json']) {
    const full = resolve(ROOT, rel);
    if (!existsSync(full)) continue;
    let raw = readFileSync(full, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return { source: rel, raw };
  }
  console.error('No content document found (data/site-content.json or the bundled seed).');
  process.exit(1);
}

function loadSeedObject() {
  let raw = readFileSync(resolve(ROOT, 'src/data/site-content.seed.json'), 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

// Rough proxy for "node count" (spec §10's term): counts primitive leaves
// (string/number/boolean/null) in the parsed+validated object. Context only —
// not fed into any pass/fail decision.
function countLeaves(v) {
  if (v === null || typeof v !== 'object') return 1;
  if (Array.isArray(v)) return v.reduce((s, x) => s + countLeaves(x), 0);
  return Object.values(v).reduce((s, x) => s + countLeaves(x), 0);
}

// ── Timing helpers ───────────────────────────────────────────────────────────
const ms = (bigintDelta) => Number(bigintDelta) / 1e6;

function timeLoop(fn, n) {
  const times = new Array(n);
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    times[i] = ms(process.hrtime.bigint() - t0);
  }
  return times;
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const mean = times.reduce((s, v) => s + v, 0) / times.length;
  return { n: sorted.length, p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: sorted[sorted.length - 1], mean };
}

const f = (v) => v.toFixed(4);
const row = (label, s) =>
  console.log(
    `  ${label.padEnd(34)} n=${String(s.n).padStart(5)}  p50=${f(s.p50)}ms  p90=${f(s.p90)}ms  p99=${f(s.p99)}ms  max=${f(s.max)}ms  mean=${f(s.mean)}ms`,
  );

async function main() {
  const [schemaMod, mergeMod] = await Promise.all([loadSchemaModule(), loadMergeModule()]);
  const { source, raw } = loadRawDoc();
  const seed = loadSeedObject();

  console.log(`Content document: ${source} (${raw.length} bytes)`);
  const sampleParsed = schemaMod.SiteContentSchema.parse(mergeMod.mergeWithSeed(JSON.parse(raw), seed));
  console.log(`Leaf count (rough node-count proxy, post-validation): ${countLeaves(sampleParsed)}`);
  console.log(
    `Array sizes: danceStyles=${sampleParsed.danceStyles.length} studios=${sampleParsed.studios.length} ` +
      `batches=${sampleParsed.batches.length} instructors=${sampleParsed.instructors.length} ` +
      `testimonials=${sampleParsed.testimonials.length} stories=${sampleParsed.stories.length} ` +
      `customPages=${sampleParsed.customPages.length}`,
  );
  console.log('');

  // ── Cold call ──────────────────────────────────────────────────────────
  // The very first invocation in this process, before any JIT warmup — the
  // closest local proxy for a fresh Workers isolate's first request. Timed
  // in isolation, BEFORE the steady-state loop below touches these functions
  // again, so it is not diluted by any prior call.
  const coldT0 = process.hrtime.bigint();
  JSON.parse(raw);
  const coldMerged = mergeMod.mergeWithSeed(JSON.parse(raw), seed);
  schemaMod.SiteContentSchema.parse(coldMerged);
  const coldMs = ms(process.hrtime.bigint() - coldT0);

  // ── Warm-up (discarded) ────────────────────────────────────────────────
  for (let i = 0; i < 30; i++) {
    schemaMod.SiteContentSchema.parse(mergeMod.mergeWithSeed(JSON.parse(raw), seed));
  }

  // ── Steady-state: full per-request pipeline ───────────────────────────
  // Fresh JSON.parse every iteration — content.ts's `cached` slot memoises
  // only the raw string, never the parsed object, so this reproduces the
  // REAL per-request cost, not an understatement of it.
  const N = 2000;
  const cpu0 = process.cpuUsage();
  const full = timeLoop(() => {
    const parsed = JSON.parse(raw);
    const merged = mergeMod.mergeWithSeed(parsed, seed);
    schemaMod.SiteContentSchema.parse(merged);
  }, N);
  const cpuDelta = process.cpuUsage(cpu0);
  const fullStats = stats(full);

  // ── Component breakdown (diagnostic — which part dominates) ──────────
  const parsedDoc = JSON.parse(raw);
  const merged = mergeMod.mergeWithSeed(parsedDoc, seed);
  const jsonOnly = stats(timeLoop(() => JSON.parse(raw), 1000));
  const mergeOnly = stats(timeLoop(() => mergeMod.mergeWithSeed(parsedDoc, seed), 1000));
  const zodOnly = stats(timeLoop(() => schemaMod.SiteContentSchema.parse(merged), 1000));

  console.log('='.repeat(92));
  console.log(`Cold call (first invocation this process, no JIT warmup): ${f(coldMs)}ms`);
  console.log('='.repeat(92));
  console.log('');
  console.log('='.repeat(92));
  console.log(`Steady state — full per-request pipeline: JSON.parse + mergeWithSeed + SiteContentSchema.parse`);
  console.log('='.repeat(92));
  row('JSON.parse + merge + zod.parse', fullStats);
  console.log(
    `  Cross-check via process.cpuUsage() over the same ${N} iterations: ` +
      `${((cpuDelta.user + cpuDelta.system) / 1000 / N).toFixed(4)}ms/iter avg CPU ` +
      `(vs. ${f(fullStats.mean)}ms/iter avg wall-clock). Node aggregates cpuUsage() across ALL threads,` +
      ` including background GC/JIT compiler threads that run concurrently with the main thread on a` +
      ` multi-core host, so this number CAN exceed wall-clock and is not more trustworthy than it —` +
      ' wall-clock hrtime is treated as the primary figure below.',
  );
  console.log('');
  console.log('Component breakdown (diagnostic — same steady-state regime, isolated loops):');
  row('JSON.parse only', jsonOnly);
  row('mergeWithSeed only', mergeOnly);
  row('SiteContentSchema.parse only', zodOnly);

  console.log('');
  console.log('='.repeat(92));
  console.log('Headroom against the Workers free-plan 10ms/request CPU cap');
  console.log('='.repeat(92));
  const headroom = 10 - fullStats.p90;
  console.log(`  p90 = ${f(fullStats.p90)}ms  →  headroom = 10 - ${f(fullStats.p90)} = ${f(headroom)}ms`);
  let band;
  if (fullStats.p90 < 3) band = 'COMFORTABLE (p90 < 3ms) — Plans 3/4 can add schema leaves and re-run this script.';
  else if (fullStats.p90 <= 6) band = 'WATCH (3ms <= p90 <= 6ms) — record it, re-run after Plan 4 before calling it done.';
  else band = 'RAISE (p90 > 6ms) — schema growth is likely to breach the cap; raise before Plan 4 starts.';
  console.log(`  Band: ${band}`);
  console.log('');
  console.log(
    'Reminder: this is an in-process Node proxy for ONE operation on the request path, not the deployed',
  );
  console.log(
    'Worker\'s real cpuTime (routing, the R2/filesystem read, and response construction are unmeasured here).',
  );
  console.log(
    'See the Task 17 report\'s "Owner action" section for the `wrangler tail` recipe that reads the real number.',
  );

  if (strict && fullStats.p90 > 6) {
    console.error('\n--strict: steady-state p90 exceeds the 6ms watch threshold.');
    process.exit(1);
  }
}

await main();

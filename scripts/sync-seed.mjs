#!/usr/bin/env node
// Copies the live local content (data/site-content.json) into the bundled
// seed (src/data/site-content.seed.json). The seed is what ships in git and
// what fresh prod / dev environments load on first run.
//
// Run this before pushing when you want your local admin edits to become the
// new defaults for everyone else.
//
//   npm run sync-seed             # write
//   npm run sync-seed -- --check  # exit non-zero if the two files diverge
//
// Strips BOM, parses to make sure the JSON is valid, and writes UTF-8 no-BOM.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const LIVE = resolve(ROOT, 'data/site-content.json');
const SEED = resolve(ROOT, 'src/data/site-content.seed.json');

function readJson(path) {
  if (!existsSync(path)) {
    console.error(`Missing file: ${path}`);
    process.exit(1);
  }
  let raw = readFileSync(path, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  try {
    return { raw, parsed: JSON.parse(raw) };
  } catch (err) {
    console.error(`Invalid JSON in ${path}: ${err.message}`);
    process.exit(1);
  }
}

const live = readJson(LIVE);
const seed = readJson(SEED);

// Re-serialize live with stable indentation so the diff against seed is clean.
const liveText = JSON.stringify(live.parsed, null, 2) + '\n';
const seedText = JSON.stringify(seed.parsed, null, 2) + '\n';

const checkOnly = process.argv.includes('--check');
const matches = liveText === seedText;

if (checkOnly) {
  if (matches) {
    console.log('✓ seed is in sync with data/site-content.json');
    process.exit(0);
  }
  console.error(
    '✗ seed and data/site-content.json diverge. Run `npm run sync-seed` to update the seed before pushing.',
  );
  process.exit(1);
}

if (matches) {
  console.log('seed already matches data/site-content.json — nothing to do.');
  process.exit(0);
}

writeFileSync(SEED, liveText, { encoding: 'utf8' });
console.log(`Wrote ${SEED.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
console.log(`  source: data/site-content.json (${live.raw.length} bytes)`);
console.log(`  output: ${liveText.length} bytes`);
console.log('');
console.log('Next: `git add src/data/site-content.seed.json` and commit + push.');

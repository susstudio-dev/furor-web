#!/usr/bin/env node
// One-time production data migration: pushes the locally restored Vercel
// export into the R2 bucket the Worker reads.
//
//   npm run migrate-to-r2 -- --dry-run   # show what would be uploaded
//   npm run migrate-to-r2                # upload via wrangler (needs login)
//
// Uploads:
//   data/site-content.json      -> site-content.json
//   data/audit.json             -> audit.json            (if present)
//   data/versions/*.json        -> versions/<name>
//   public/uploads/*            -> uploads/<name>  (with correct content-type)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const BUCKET = 'furor-content';
const dryRun = process.argv.includes('--dry-run');

const TYPES = {
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const jobs = [];
function add(localPath, key) {
  if (!existsSync(localPath)) return;
  const type = TYPES[path.extname(localPath).toLowerCase()];
  if (!type) {
    console.warn(`skip (unknown type): ${localPath}`);
    return;
  }
  jobs.push({ localPath, key, type });
}

add('data/site-content.json', 'site-content.json');
add('data/audit.json', 'audit.json');
if (existsSync('data/versions')) {
  for (const f of readdirSync('data/versions')) {
    if (f.endsWith('.json')) add(path.join('data/versions', f), `versions/${f}`);
  }
}
if (existsSync('public/uploads')) {
  for (const f of readdirSync('public/uploads')) {
    add(path.join('public/uploads', f), `uploads/${f}`);
  }
}

if (jobs.length === 0) {
  console.error('Nothing to upload — is data/site-content.json in place?');
  process.exit(1);
}

// Invoke wrangler's JS entry through the current Node — no shell, so paths
// and content types never need quoting on any platform.
const wranglerBin = path.join('node_modules', 'wrangler', 'bin', 'wrangler.js');
console.log(`${dryRun ? '[dry-run] ' : ''}${jobs.length} object(s) -> r2://${BUCKET}\n`);
for (const j of jobs) {
  const args = [
    wranglerBin, 'r2', 'object', 'put', `${BUCKET}/${j.key}`,
    `--file=${j.localPath}`,
    `--content-type=${j.type}`,
    '--remote',
  ];
  console.log('  node ' + args.join(' '));
  if (!dryRun) {
    try {
      execFileSync(process.execPath, args, { stdio: 'inherit' });
    } catch {
      console.error(
        '\nUpload failed. Common causes, in order:\n' +
          '  1. R2 not enabled on the account (error 10042) — dash.cloudflare.com →\n' +
          '     R2 Object Storage → Get started. Needs a card on file; stays $0\n' +
          '     within the free tier.\n' +
          '  2. Bucket missing — npx wrangler r2 bucket create furor-content\n' +
          '  3. Not logged in / token lacks R2 write — npx wrangler login\n' +
          'Then rerun: npm run migrate-to-r2  (re-uploading is harmless)',
      );
      process.exit(1);
    }
  }
}
console.log(dryRun ? '\nDry run only — rerun without --dry-run to upload.' : '\nDone. Verify with: npx wrangler r2 object get ' + BUCKET + '/site-content.json --pipe | head');

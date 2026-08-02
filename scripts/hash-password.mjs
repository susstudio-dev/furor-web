#!/usr/bin/env node
// Generates an ADMIN_OWNER_PASSWORD_HASH value in the PBKDF2 format the app
// verifies via WebCrypto — the only stretched format that fits the Cloudflare
// Workers free plan's 10 ms CPU budget (bcrypt does not).
//
//   npm run hash-password -- 'your-password-here'
//   npm run hash-password -- 'your-password-here' --iterations 50000
//
// Then: wrangler secret put ADMIN_OWNER_PASSWORD_HASH   (paste the output)
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const iterFlag = args.indexOf('--iterations');
// 100k is workerd's PBKDF2 cap. If login ever hits the free plan's CPU limit,
// regenerate with --iterations 50000.
let iterations = 100_000;
if (iterFlag !== -1) {
  iterations = Number(args[iterFlag + 1]);
  args.splice(iterFlag, 2);
}
const password = args[0];

if (!password || !Number.isInteger(iterations) || iterations < 1000 || iterations > 100_000) {
  console.error("Usage: npm run hash-password -- '<password>' [--iterations 1000..100000]");
  process.exit(1);
}
if (password.length < 12) {
  console.error('Refusing: use at least 12 characters for the admin password.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
console.log(
  `pbkdf2$sha256$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`,
);

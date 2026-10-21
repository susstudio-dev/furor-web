import { NextResponse } from 'next/server';
import { isRemoteStorage, readText } from '@/lib/storage';
import { CONTENT_KEY } from '@/lib/content';

export const dynamic = 'force-dynamic';

// Public, no SECRETS. Definitively answers "is storage wired correctly".
// The probe is a single cheap read (1 R2 class-B op) — never a bucket list,
// which an anonymous caller could loop to burn the free-plan quota. Raw
// error detail goes to the server log only.
export async function GET() {
  const remote = await isRemoteStorage();

  let storageProbe = 'skipped (filesystem)';
  if (remote) {
    try {
      const raw = await readText(CONTENT_KEY);
      storageProbe = raw == null ? 'ok (empty store, serving seed)' : 'ok (content present)';
    } catch (err) {
      console.error('health storage probe failed:', err);
      storageProbe = 'FAILED (see server logs)';
    }
  }

  // Which owner password credential the runtime can see — states only,
  // never values. 'none' means every login 401s no matter what is typed.
  const ownerHash = (process.env.ADMIN_OWNER_PASSWORD_HASH || '').trim();
  const ownerPlain = (process.env.ADMIN_OWNER_INITIAL_PASSWORD || '').trim();
  const ownerPasswordConfigured = ownerHash
    ? ownerHash.startsWith('pbkdf2$')
      ? 'pbkdf2 hash'
      : ownerHash.startsWith('$2')
        ? 'bcrypt hash (does NOT verify on Workers — regenerate with `npm run hash-password`)'
        : 'UNRECOGNIZED format (regenerate with `npm run hash-password`)'
    : ownerPlain
      ? 'plaintext'
      : 'none — logins always 401; `wrangler secret put ADMIN_OWNER_PASSWORD_HASH`';

  return NextResponse.json({
    ok: true,
    storage: remote ? 'r2' : 'filesystem',
    storageProbe,
    jwtSecretConfigured: !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
    ownerEmailConfigured: !!(process.env.ADMIN_OWNER_EMAIL || '').trim(),
    ownerPasswordConfigured,
    build: 'admin-auth-diag-4-cloudflare',
  });
}

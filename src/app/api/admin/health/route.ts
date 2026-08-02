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

  return NextResponse.json({
    ok: true,
    storage: remote ? 'r2' : 'filesystem',
    storageProbe,
    jwtSecretConfigured: !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
    ownerEmailConfigured: !!process.env.ADMIN_OWNER_EMAIL,
    build: 'storage-diag-3-cloudflare',
  });
}

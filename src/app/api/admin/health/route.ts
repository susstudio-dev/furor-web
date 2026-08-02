import { NextResponse } from 'next/server';
import { isRemoteStorage, listKeys } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Public, no SECRETS. Definitively answers "is storage wired correctly".
export async function GET() {
  const remote = await isRemoteStorage();

  let storageProbe = 'skipped (filesystem)';
  if (remote) {
    try {
      const items = await listKeys('');
      storageProbe = `ok (${items.length} object(s) visible)`;
    } catch (err) {
      storageProbe = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
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

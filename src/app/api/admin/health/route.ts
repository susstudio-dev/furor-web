import { NextResponse } from 'next/server';
import { isProdStorage } from '@/lib/storage';

// Public, no secrets. Tells us, for the *running deployment*, whether the
// storage layer exists and whether Vercel Blob is actually wired in. This is
// the fastest way to confirm "is the latest code deployed and is Blob active".
export async function GET() {
  return NextResponse.json({
    ok: true,
    // 'blob' = BLOB_READ_WRITE_TOKEN is present in this runtime (saving will persist)
    // 'filesystem' = no token (saving fails on Vercel's read-only FS)
    storage: isProdStorage ? 'blob' : 'filesystem',
    onVercel: !!process.env.VERCEL,
    node: process.version,
    // Bump this string whenever you want to confirm a fresh deploy shipped.
    build: 'storage-diag-1',
  });
}

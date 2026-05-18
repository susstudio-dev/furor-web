import { NextResponse } from 'next/server';
import { isProdStorage } from '@/lib/storage';

// Public, no SECRETS. Definitively answers "is Blob wired correctly".
// Vercel Blob token format: vercel_blob_rw_<STOREID>_<SECRET>
//  - <STOREID> is NOT secret (it's shown in the Vercel dashboard) -> safe to show
//  - <SECRET> is never returned
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || '';
  // Parse just the store-id segment (e.g. "store_abc123") for comparison.
  let tokenStoreId: string | null = null;
  const m = token.match(/^vercel_blob_rw_([^_]+)_/);
  if (m) tokenStoreId = m[1];

  let blobProbe: string = 'skipped (no token)';
  if (token) {
    try {
      const { list } = await import('@vercel/blob');
      const res = await list({ limit: 1 });
      blobProbe = `ok (${res.blobs.length} blob(s) visible)`;
    } catch (err) {
      blobProbe = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({
    ok: true,
    storage: isProdStorage ? 'blob' : 'filesystem',
    onVercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || null, // production | preview | development
    tokenPresent: !!token,
    tokenStoreId, // compare this to the store ID in your Vercel dashboard
    blobProbe, // 'ok ...' = working;  'FAILED: ...' = the real error
    node: process.version,
    build: 'storage-diag-2',
  });
}

import { NextResponse } from 'next/server';
import { readBinary } from '@/lib/storage';

// Serves admin-uploaded images from R2 in production. In dev, files live in
// public/uploads/ and Next's static layer answers first — this route only
// runs for misses. Filenames are server-generated UUIDs, so responses are
// immutable-cacheable forever.

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  // Server-generated names are `<uuid>.<ext>` — anything else is not ours.
  if (!/^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(file)) {
    return new NextResponse('Not found', { status: 404 });
  }
  const hit = await readBinary(file);
  if (!hit) return new NextResponse('Not found', { status: 404 });
  // Never trust stored metadata at serve time: anything outside the image
  // allowlist is downloaded, not rendered — even if a non-image ever reached
  // the bucket, it cannot execute in this origin.
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
  const safeType = IMAGE_TYPES.has(hit.contentType) ? hit.contentType : 'application/octet-stream';
  return new NextResponse(hit.body as BodyInit, {
    headers: {
      'content-type': safeType,
      ...(safeType === 'application/octet-stream'
        ? { 'content-disposition': 'attachment' }
        : {}),
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
    },
  });
}

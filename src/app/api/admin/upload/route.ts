import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveMutationSubject } from '@/lib/subject';
import { audit } from '@/lib/audit';
import { StorageUnavailableError, writeBinary } from '@/lib/storage';
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
import { oversizeError, readImageSize } from '@/lib/image-dimensions';

const MAX_BYTES = 8 * 1024 * 1024;
// Explicit type→extension map (never derive the extension from the MIME
// string — it feeds a storage key).
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

// The multipart Content-Type is client-controlled; verify the actual bytes.
function sniffImageType(bytes: Uint8Array): string | null {
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...bytes.subarray(start, start + len));
  if (bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (bytes.length > 12 && ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

export async function POST(req: Request) {
  // Store-backed, fresh, temp-password-refusing — this route writes bytes
  // that are served from the public origin, so it must honor revocation like
  // every other admin write (it previously trusted the bare JWT, which kept a
  // DISABLED account uploading for the full 14-day token life).
  const gate = await resolveMutationSubject();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const session = gate.subject;
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  // Reject oversized requests BEFORE buffering the multipart body — a huge
  // body would otherwise be materialized in memory first (128 MB isolate).
  if (!contentLengthWithin(req, MAX_BYTES + 64 * 1024)) {
    return NextResponse.json({ error: 'Max 8 MB per image' }, { status: 413 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Max 8 MB per image' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const bytes = new Uint8Array(buf);
  const sniffed = sniffImageType(bytes);
  if (!sniffed || !(sniffed in EXT)) {
    return NextResponse.json(
      { error: 'Unsupported type (JPEG, PNG, WebP or AVIF only)' },
      { status: 400 },
    );
  }
  // Backstop for the admin UI's client-side resize (image-downscale.ts). A
  // browser without OffscreenCanvas, or a direct POST, would otherwise store a
  // 4000px master that every visitor then downloads in full — which is exactly
  // how /instructors reached 6.9 MB. Header parse only: no decode, no CPU.
  const oversize = oversizeError(readImageSize(bytes));
  if (oversize) return NextResponse.json({ error: oversize }, { status: 400 });

  const filename = `${randomUUID()}.${EXT[sniffed]}`;
  try {
    // The sniffed type — never the client-declared one — becomes the stored
    // Content-Type, so what the browser renders is what the bytes really are.
    const url = await writeBinary(`uploads/${filename}`, buf, sniffed);
    await audit({ actor: session.email, action: 'upload_image', detail: filename });
    return NextResponse.json({ url });
  } catch (err: unknown) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('admin upload error:', err);
    return NextResponse.json({ error: 'Upload failed — see server logs' }, { status: 500 });
  }
}

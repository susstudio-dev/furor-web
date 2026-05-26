import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { StorageUnavailableError, writeBinary } from '@/lib/storage';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Max 8 MB per image' }, { status: 400 });
  const type = file.type;
  if (!ALLOWED.has(type)) return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });

  const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
  const filename = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const url = await writeBinary(`uploads/${filename}`, buf, type);
    await audit({ actor: session.email, action: 'upload_image', detail: filename });
    return NextResponse.json({ url });
  } catch (err: unknown) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('admin upload error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    if (/private store|public access/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Your Vercel Blob store is private. This app needs a PUBLIC Blob store (uploaded images are shown on the public site). Recreate the store with public access, connect it, then redeploy.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}

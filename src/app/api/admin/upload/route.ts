import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { writeBinary } from '@/lib/storage';

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
  const url = await writeBinary(`uploads/${filename}`, buf, type);
  await audit({ actor: session.email, action: 'upload_image', detail: filename });
  return NextResponse.json({ url });
}

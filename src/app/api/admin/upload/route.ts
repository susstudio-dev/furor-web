import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const PUBLIC_DIR = path.join(process.cwd(), 'public', 'uploads');

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
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(PUBLIC_DIR, filename), buf);
  const url = `/uploads/${filename}`;
  await audit({ actor: session.email, action: 'upload_image', detail: filename });
  return NextResponse.json({ url });
}

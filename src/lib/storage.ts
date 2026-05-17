import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';

// Unified storage. In dev (no BLOB_READ_WRITE_TOKEN) everything lives on the
// local filesystem exactly as before. In production on Vercel (token present)
// JSON docs, version snapshots and uploaded images live in Vercel Blob, since
// Vercel's runtime filesystem is read-only.

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLIC_UPLOADS = path.join(process.cwd(), 'public', 'uploads');

// ---- JSON / text documents -------------------------------------------------

export async function readText(key: string): Promise<string | null> {
  if (useBlob) {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: key, limit: 1 });
    const hit = blobs.find((b) => b.pathname === key);
    if (!hit) return null;
    const res = await fetch(hit.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.text();
  }
  try {
    return await fs.readFile(path.join(DATA_DIR, key), 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeText(key: string, value: string): Promise<void> {
  if (useBlob) {
    const { put } = await import('@vercel/blob');
    await put(key, value, {
      access: 'public',
      contentType: 'application/json; charset=utf-8',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return;
  }
  const full = path.join(DATA_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, value, 'utf8');
}

export async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await readText(key);
  return raw == null ? null : (JSON.parse(raw) as T);
}

export async function writeJSON(key: string, data: unknown): Promise<void> {
  await writeText(key, JSON.stringify(data, null, 2));
}

// ---- listing / deletion (version snapshots) --------------------------------

export interface StoredItem {
  key: string;
  uploadedAt: number;
}

export async function listKeys(prefix: string): Promise<StoredItem[]> {
  if (useBlob) {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix });
    return blobs.map((b) => ({ key: b.pathname, uploadedAt: new Date(b.uploadedAt).getTime() }));
  }
  const dir = path.join(DATA_DIR, prefix);
  try {
    const files = await fs.readdir(dir);
    const out: StoredItem[] = [];
    for (const f of files) {
      const st = await fs.stat(path.join(dir, f));
      out.push({ key: `${prefix}${f}`, uploadedAt: st.mtimeMs });
    }
    return out;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw err;
  }
}

export async function deleteKey(key: string): Promise<void> {
  if (useBlob) {
    const { list, del } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: key, limit: 1 });
    const hit = blobs.find((b) => b.pathname === key);
    if (hit) await del(hit.url);
    return;
  }
  try {
    await fs.unlink(path.join(DATA_DIR, key));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
  }
}

// ---- binary uploads (images) ----------------------------------------------

export async function writeBinary(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  if (useBlob) {
    const { put } = await import('@vercel/blob');
    const { url } = await put(key, bytes, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return url;
  }
  const full = path.join(PUBLIC_UPLOADS, path.basename(key));
  await fs.mkdir(PUBLIC_UPLOADS, { recursive: true });
  await fs.writeFile(full, bytes);
  return `/uploads/${path.basename(key)}`;
}

export const isProdStorage = useBlob;

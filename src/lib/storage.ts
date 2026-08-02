import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';

// Unified storage. In dev (`next dev`, plain Node) everything lives on the
// local filesystem exactly as before. In production on Cloudflare Workers the
// CONTENT_BUCKET R2 binding (see wrangler.jsonc) holds JSON docs, version
// snapshots and uploaded images — the Workers runtime has no writable disk.
// R2 is strongly consistent, so reads immediately see the latest write.

const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLIC_UPLOADS = path.join(process.cwd(), 'public', 'uploads');

// Minimal structural types for the R2 binding — avoids depending on
// @cloudflare/workers-types (whose globals can clash with DOM lib types).
interface R2ObjectBody {
  key: string;
  uploaded: string | Date;
  httpMetadata?: { contentType?: string };
  body: ReadableStream;
  text(): Promise<string>;
}
interface R2ListResult {
  objects: { key: string; uploaded: string | Date }[];
  truncated: boolean;
  cursor?: string;
}
export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}

// Thrown when a write is attempted with no persistent store available
// (running on Cloudflare without the R2 binding configured).
export class StorageUnavailableError extends Error {
  constructor() {
    super(
      'Saving needs the R2 bucket binding. Check wrangler.jsonc: r2_buckets must bind CONTENT_BUCKET to your bucket (create it with `wrangler r2 bucket create furor-content`), then redeploy.',
    );
    this.name = 'StorageUnavailableError';
  }
}

// Resolve the R2 bucket for this request, or null when running on the local
// filesystem. Three situations:
//  - `next dev` / plain Node (NODE_ENV !== production)      → null (fs)
//  - `next build` prerendering (no Cloudflare context)      → null (fs/seed)
//  - Workers runtime (OpenNext)                             → the binding
// `inWorkerRuntime` distinguishes "no binding because we're not on Cloudflare"
// from "on Cloudflare but misconfigured" — the latter must fail loudly on
// writes instead of silently attempting fs writes that cannot persist.
async function resolveBucket(): Promise<{ bucket: R2BucketLike | null; inWorkerRuntime: boolean }> {
  if (process.env.NODE_ENV !== 'production') return { bucket: null, inWorkerRuntime: false };
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    const bucket = (ctx.env as { CONTENT_BUCKET?: R2BucketLike }).CONTENT_BUCKET ?? null;
    return { bucket, inWorkerRuntime: true };
  } catch {
    // Not running inside the OpenNext worker (e.g. build-time prerender).
    return { bucket: null, inWorkerRuntime: false };
  }
}

/** True when a remote (R2) store backs this request — i.e. prod on Workers. */
export async function isRemoteStorage(): Promise<boolean> {
  const { bucket } = await resolveBucket();
  return bucket != null;
}

// ---- JSON / text documents -------------------------------------------------

export async function readText(key: string): Promise<string | null> {
  const { bucket } = await resolveBucket();
  if (bucket) {
    const obj = await bucket.get(key);
    return obj == null ? null : obj.text();
  }
  try {
    return await fs.readFile(path.join(DATA_DIR, key), 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeText(key: string, value: string): Promise<void> {
  const { bucket, inWorkerRuntime } = await resolveBucket();
  if (bucket) {
    await bucket.put(key, value, {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
    return;
  }
  if (inWorkerRuntime) throw new StorageUnavailableError();
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
  const { bucket } = await resolveBucket();
  if (bucket) {
    const out: StoredItem[] = [];
    let cursor: string | undefined;
    do {
      const res = await bucket.list({ prefix, limit: 1000, cursor });
      for (const o of res.objects) {
        out.push({ key: o.key, uploadedAt: new Date(o.uploaded).getTime() });
      }
      cursor = res.truncated ? res.cursor : undefined;
    } while (cursor);
    return out;
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
  const { bucket } = await resolveBucket();
  if (bucket) {
    await bucket.delete(key);
    return;
  }
  try {
    await fs.unlink(path.join(DATA_DIR, key));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
  }
}

// ---- binary uploads (images) ----------------------------------------------

// Uploads always resolve to a RELATIVE URL (/uploads/<name>) so stored content
// stays portable across hosts. In dev the file lands in public/uploads (served
// statically); in prod it lands in R2 and src/app/uploads/[file]/route.ts
// streams it back out.
export async function writeBinary(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const name = path.basename(key);
  const { bucket, inWorkerRuntime } = await resolveBucket();
  if (bucket) {
    await bucket.put(`uploads/${name}`, bytes, { httpMetadata: { contentType } });
    return `/uploads/${name}`;
  }
  if (inWorkerRuntime) throw new StorageUnavailableError();
  await fs.mkdir(PUBLIC_UPLOADS, { recursive: true });
  await fs.writeFile(path.join(PUBLIC_UPLOADS, name), bytes);
  return `/uploads/${name}`;
}

/** Read an uploaded image for serving. Null when it doesn't exist. */
export async function readBinary(
  name: string,
): Promise<{ body: ReadableStream | Uint8Array; contentType: string } | null> {
  const { bucket } = await resolveBucket();
  if (bucket) {
    const obj = await bucket.get(`uploads/${name}`);
    if (obj == null) return null;
    return {
      body: obj.body,
      contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
    };
  }
  try {
    const buf = await fs.readFile(path.join(PUBLIC_UPLOADS, name));
    const ext = path.extname(name).slice(1).toLowerCase();
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      avif: 'image/avif',
    };
    return { body: new Uint8Array(buf), contentType: types[ext] || 'application/octet-stream' };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
    throw err;
  }
}

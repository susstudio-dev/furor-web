import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { SiteContentSchema, type SiteContent } from './content-schema';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_PATH = path.join(DATA_DIR, 'site-content.json');
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');
const RETENTION = 30;

export class ContentValidationError extends Error {
  constructor(public issues: unknown) {
    super('Content failed schema validation');
  }
}

async function snapshotCurrent(actor: string) {
  try {
    const current = await fs.readFile(LOCAL_PATH, 'utf8');
    await fs.mkdir(VERSIONS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeActor = actor.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
    const filename = `site-content-${stamp}-by-${safeActor}.json`;
    await fs.writeFile(path.join(VERSIONS_DIR, filename), current, 'utf8');

    // prune
    const files = (await fs.readdir(VERSIONS_DIR)).filter((f) => f.endsWith('.json')).sort();
    while (files.length > RETENTION) {
      const oldest = files.shift();
      if (oldest) await fs.unlink(path.join(VERSIONS_DIR, oldest));
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') throw err;
  }
}

export async function saveContent(next: unknown, actor: string): Promise<SiteContent> {
  const parsed = SiteContentSchema.safeParse(next);
  if (!parsed.success) throw new ContentValidationError(parsed.error.issues);

  await snapshotCurrent(actor);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOCAL_PATH, JSON.stringify(parsed.data, null, 2), 'utf8');
  return parsed.data;
}

export async function listVersions(): Promise<string[]> {
  try {
    const files = await fs.readdir(VERSIONS_DIR);
    return files.filter((f) => f.endsWith('.json')).sort().reverse();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw err;
  }
}

export async function restoreVersion(filename: string, actor: string): Promise<SiteContent> {
  const safe = path.basename(filename);
  const full = path.join(VERSIONS_DIR, safe);
  const raw = await fs.readFile(full, 'utf8');
  const parsed = SiteContentSchema.parse(JSON.parse(raw));
  await snapshotCurrent(actor);
  await fs.writeFile(LOCAL_PATH, JSON.stringify(parsed, null, 2), 'utf8');
  return parsed;
}

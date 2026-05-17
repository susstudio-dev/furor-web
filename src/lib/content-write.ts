import 'server-only';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { CONTENT_KEY } from './content';
import { deleteKey, listKeys, readText, writeText } from './storage';

const VERSIONS_PREFIX = 'versions/';
const RETENTION = 30;

export class ContentValidationError extends Error {
  constructor(public issues: unknown) {
    super('Content failed schema validation');
  }
}

async function snapshotCurrent(actor: string) {
  const current = await readText(CONTENT_KEY);
  if (current == null) return; // nothing to snapshot yet

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeActor = actor.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
  await writeText(`${VERSIONS_PREFIX}site-content-${stamp}-by-${safeActor}.json`, current);

  // prune oldest beyond retention
  const versions = (await listKeys(VERSIONS_PREFIX))
    .map((v) => v.key)
    .sort();
  while (versions.length > RETENTION) {
    const oldest = versions.shift();
    if (oldest) await deleteKey(oldest);
  }
}

export async function saveContent(next: unknown, actor: string): Promise<SiteContent> {
  const parsed = SiteContentSchema.safeParse(next);
  if (!parsed.success) throw new ContentValidationError(parsed.error.issues);

  await snapshotCurrent(actor);
  await writeText(CONTENT_KEY, JSON.stringify(parsed.data, null, 2));
  return parsed.data;
}

export async function listVersions(): Promise<string[]> {
  const items = await listKeys(VERSIONS_PREFIX);
  return items
    .map((i) => i.key.slice(VERSIONS_PREFIX.length))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
}

export async function restoreVersion(filename: string, actor: string): Promise<SiteContent> {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const raw = await readText(`${VERSIONS_PREFIX}${safe}`);
  if (raw == null) throw new Error('Version not found');
  const parsed = SiteContentSchema.parse(JSON.parse(raw));
  await snapshotCurrent(actor);
  await writeText(CONTENT_KEY, JSON.stringify(parsed, null, 2));
  return parsed;
}

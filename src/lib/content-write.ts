import 'server-only';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { CONTENT_KEY, mergeWithSeed } from './content';
import { deleteKey, listKeys, readText, writeText } from './storage';
import seedContent from '@/data/site-content.seed.json';

const VERSIONS_PREFIX = 'versions/';
const RETENTION = 30;

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

/**
 * Snapshots the bytes that were just replaced, AFTER a successful write.
 *
 * Snapshotting before the write burns a retention slot on every failed
 * compare-and-swap, and an unchanged save would evict real history for a copy
 * of itself. Both matter now that several people can save concurrently.
 *
 * `previous` is the document as it was read for this save; `written` is what
 * replaced it. Best-effort: a snapshot failure must never fail the save that
 * already succeeded.
 */
export async function snapshotAfterWrite(
  previous: string,
  written: string,
  actor: string,
): Promise<void> {
  if (previous === written) return; // no-op save: nothing worth keeping
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeActor = actor.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
    // A random suffix keeps two saves in the same millisecond by the same
    // actor from colliding on the key and silently overwriting each other.
    const rand = Math.random().toString(36).slice(2, 8);
    await writeText(`${VERSIONS_PREFIX}site-content-${stamp}-by-${safeActor}-${rand}.json`, previous);

    const versions = (await listKeys(VERSIONS_PREFIX)).map((v) => v.key).sort();
    while (versions.length > RETENTION) {
      const oldest = versions.shift();
      if (oldest) await deleteKey(oldest);
    }
  } catch {
    /* snapshotting must never break a save that already landed */
  }
}

// NB: there is deliberately no `saveContent(wholeDocument)` helper any more.
// Content writes go through the save route's pipeline (expand → authorize →
// validate → integrity → compare-and-swap); an unauthorized whole-document
// write function sitting here is how that pipeline would quietly get bypassed.

export async function listVersions(): Promise<string[]> {
  const items = await listKeys(VERSIONS_PREFIX);
  return items
    .map((i) => i.key.slice(VERSIONS_PREFIX.length))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
}

export async function restoreVersion(filename: string, actor: string): Promise<SiteContent> {
  if (!/^[a-zA-Z0-9._-]+\.json$/.test(filename)) throw new Error('Invalid version filename');
  const raw = await readText(`${VERSIONS_PREFIX}${filename}`);
  if (raw == null) throw new Error('Version not found');
  // Merge through the seed like getContent() does — a snapshot taken before a
  // schema addition must stay restorable, not rot into a ZodError.
  const parsed = SiteContentSchema.parse(mergeWithSeed(JSON.parse(raw), seedContent));
  await snapshotCurrent(actor);
  await writeText(CONTENT_KEY, JSON.stringify(parsed, null, 2));
  return parsed;
}

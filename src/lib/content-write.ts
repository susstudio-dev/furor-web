import 'server-only';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { CONTENT_KEY, mergeWithSeed } from './content';
import {
  deleteKey,
  listKeys,
  readDocWithVersion,
  readText,
  writeDocIfMatch,
  writeText,
} from './storage';
import { newLineage, versionToken } from './storage-version-core';
import { applyAndAuthorize } from './save-pipeline';
import { diffToOps } from './diff-ops';
import type { Subject } from './authz';
import seedContent from '@/data/site-content.seed.json';

const VERSIONS_PREFIX = 'versions/';
const RETENTION = 30;

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

export type RestoreResult =
  | { status: 'ok'; next: SiteContent; version: string }
  | { status: 'denied'; denied: { path: string; reason: string }[] }
  | { status: 'invalid'; issues: { path: (string | number)[]; message: string }[] }
  | { status: 'conflict' }
  | { status: 'missing' };

/**
 * Restores a snapshot by expressing it as a set of ops and running them
 * through the SAME authorization pipeline as an ordinary save.
 *
 * Restoring used to be a whole-document write on its own route, which made
 * the claim that the pipeline is a single choke point simply false: anyone who
 * could restore could revert path sets they were explicitly denied — theme,
 * site settings — or reinstate a malicious payment link that had been cleaned
 * up. Expressed as ops, a restore is authorized leaf by leaf, and per-path
 * restore falls out for free.
 */
export async function restoreVersion(
  filename: string,
  subject: Subject,
): Promise<RestoreResult> {
  if (!/^[a-zA-Z0-9._-]+\.json$/.test(filename)) throw new Error('Invalid version filename');
  const raw = await readText(`${VERSIONS_PREFIX}${filename}`);
  if (raw == null) return { status: 'missing' };

  const current = await readDocWithVersion(CONTENT_KEY);
  if (current == null) return { status: 'missing' };
  const published = SiteContentSchema.parse(mergeWithSeed(JSON.parse(current.text), seedContent));

  // Merge the snapshot against a DEFAULTS-ONLY floor, never the shipped seed:
  // `sync-seed` bakes a developer's live content into the seed, so seeding a
  // pre-migration snapshot would silently publish their local promos/theme.
  const snapshot = SiteContentSchema.parse(mergeWithSeed(JSON.parse(raw), defaultsFloor()));

  const ops = diffToOps(published, snapshot);
  if (ops.length === 0) {
    return { status: 'ok', next: published, version: versionToken(current.version) };
  }

  const result = applyAndAuthorize(published, subject, ops);
  if (result.status === 'denied') return { status: 'denied', denied: result.denied };
  if (result.status === 'invalid') return { status: 'invalid', issues: result.issues };

  const text = JSON.stringify(result.next, null, 2);
  // A NEW lineage: every open tab and stored version token from before the
  // restore must fail loudly rather than apply to content it never saw.
  const written = await writeDocIfMatch(CONTENT_KEY, text, current.version, {
    lineage: newLineage(),
  });
  if (written === null) return { status: 'conflict' };

  await snapshotAfterWrite(current.text, text, subject.email);
  return { status: 'ok', next: result.next, version: versionToken(written) };
}

/** A document containing only schema defaults — the safe merge floor for an
 *  old snapshot, as opposed to the content-bearing seed. */
function defaultsFloor(): unknown {
  return SiteContentSchema.parse({
    version: 1,
    site: {
      title: '',
      tagline: '',
      whatsappNumber: '0000000000',
      instagramHandle: 'x',
      socials: {},
    },
    hero: { headline: '-', subHeadline: '-' },
  });
}

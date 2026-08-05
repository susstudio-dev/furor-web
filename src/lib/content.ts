import 'server-only';
import { cache } from 'react';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { mergeWithSeed } from './content-merge';
import { readDocWithVersion, type DocVersion } from './storage';
import { versionToken } from './storage-version-core';
import seedContent from '@/data/site-content.seed.json';

export const CONTENT_KEY = 'site-content.json';

// The merge itself lives in content-merge.ts so it can be unit-tested — this
// module imports `server-only`, which throws outside a server bundle.
// Re-exported so existing call sites keep importing it from here.
export { mergeWithSeed };

// Cross-request TTL cache (per Worker isolate / per Node process). Public
// pages render per-request on Cloudflare (see connection() in the root
// layout), so this bounds R2 reads to ~2/min per isolate while keeping admin
// edits visible within CACHE_TTL_MS everywhere (and instantly in the isolate
// that saved — see bustContentCache()).
const CACHE_TTL_MS = 30_000;
let cached: { raw: string | null; version: DocVersion | null; at: number } | null = null;

export function bustContentCache(): void {
  cached = null;
}

async function readContentRaw(): Promise<string | null> {
  if (process.env.NODE_ENV === 'production' && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.raw;
  }
  const doc = await readDocWithVersion(CONTENT_KEY);
  cached = { raw: doc?.text ?? null, version: doc?.version ?? null, at: Date.now() };
  return cached.raw;
}

/**
 * One read, one result: the content AND the version token that describes it.
 *
 * These must never be derived from separate calls. `cached` is module-level
 * (shared across requests) while React `cache()` memoises per request, so a
 * concurrent save that busts and repopulates the module slot can hand a later
 * `getContentVersionToken()` a NEWER version than the content this request
 * already memoised — a newer token paired with older content is precisely the
 * silent clobber the conflict check exists to prevent.
 *
 * `fromSeed` marks the fallbacks (read failure, corrupt bytes, empty store).
 * Those requests have no honest base version, so they expose NO token, and the
 * save route refuses a submission that carries none. Otherwise an R2 blip would
 * render every editor from the bundled seed and the next Save would write the
 * seed over the real site.
 */
interface LoadedContent {
  content: SiteContent;
  version: DocVersion | null;
  fromSeed: boolean;
}

const loadContent = cache(async (): Promise<LoadedContent> => {
  const seedResult = (): LoadedContent => ({
    content: SiteContentSchema.parse(seedContent),
    version: null,
    fromSeed: true,
  });

  let raw: string | null = null;
  let readErr: unknown;
  // Retry a throwing read a few times with short backoff before giving up. A
  // single R2/network blip must not surface the seed: combined with per-request
  // rendering this means a momentary hiccup almost never reaches the user, and
  // when it does it affects one request and self-heals — a throw never
  // populates the TTL cache, so the next request re-reads for real.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      raw = await readContentRaw();
      readErr = undefined;
      break;
    } catch (err) {
      readErr = err;
      // No backoff after the final attempt — it would only delay the seed.
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  // Captured in the same tick as the raw bytes above.
  const version = cached?.version ?? null;

  if (readErr !== undefined) {
    // Sustained read failure (not a one-off blip). Serve the in-memory seed for
    // THIS request only — never persist it. A temporary read failure must not
    // be allowed to clobber real stored content with the default.
    return seedResult();
  }
  if (raw != null) {
    try {
      // Strip BOM if present — Windows PowerShell / some editors add U+FEFF.
      const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
      const parsed = JSON.parse(cleaned);
      return {
        content: SiteContentSchema.parse(mergeWithSeed(parsed, seedContent)),
        version,
        fromSeed: false,
      };
    } catch {
      // Stored doc is corrupt/unparseable. Serve the seed in-memory but DO NOT
      // overwrite the stored bytes — the real content stays recoverable.
      return seedResult();
    }
  }
  // Genuinely empty store (first run, before any admin save). Serve the seed.
  // We deliberately do NOT write it back: the first real save creates the doc,
  // and writing the seed here is exactly what used to let a spurious "empty"
  // read replace a real save with the default.
  return seedResult();
});

// Reads the live content from storage (filesystem in dev, R2 in prod).
// A failed read must NEVER crash the request: we just serve the bundled seed.
export async function getContent(): Promise<SiteContent> {
  return (await loadContent()).content;
}

/**
 * The version token for the content this request is rendering, or null when
 * there is no honest one (seed fallback, or a document that does not exist).
 * A null token makes the save route refuse the save rather than fail open.
 */
export async function getContentVersionToken(): Promise<string | null> {
  const loaded = await loadContent();
  return loaded.fromSeed || !loaded.version ? null : versionToken(loaded.version);
}

// Re-exports so existing call sites don't break.
export {
  visibleBatches,
  batchesForStyle,
  batchesForBranch,
  nextBatchPerStyle,
  styleBySlug,
  studioBySlug,
  batchStyleLabel,
} from './content-helpers';
export { formatBatchDate, formatInr, todayIso } from './format';

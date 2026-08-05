import 'server-only';
import { cache } from 'react';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { mergeWithSeed } from './content-merge';
import { readText } from './storage';
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
let cached: { raw: string | null; at: number } | null = null;

export function bustContentCache(): void {
  cached = null;
}

async function readContentRaw(): Promise<string | null> {
  if (process.env.NODE_ENV === 'production' && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.raw;
  }
  const raw = await readText(CONTENT_KEY);
  cached = { raw, at: Date.now() };
  return raw;
}

// Reads the live content from storage (filesystem in dev, R2 in prod).
// A failed read must NEVER crash the request: we just serve the bundled
// seed. Wrapped in React cache() => one read per request.
export const getContent = cache(async (): Promise<SiteContent> => {
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
  if (readErr !== undefined) {
    // Sustained read failure (not a one-off blip). Serve the in-memory seed for
    // THIS request only — never persist it. A temporary read failure must not
    // be allowed to clobber real stored content with the default.
    return SiteContentSchema.parse(seedContent);
  }
  if (raw != null) {
    try {
      // Strip BOM if present — Windows PowerShell / some editors add U+FEFF.
      const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
      const parsed = JSON.parse(cleaned);
      return SiteContentSchema.parse(mergeWithSeed(parsed, seedContent));
    } catch {
      // Stored doc is corrupt/unparseable. Serve the seed in-memory but DO NOT
      // overwrite the stored bytes — the real content stays recoverable.
      return SiteContentSchema.parse(seedContent);
    }
  }
  // Genuinely empty store (first run, before any admin save). Serve the seed.
  // We deliberately do NOT write it back: the first real save creates the doc,
  // and writing the seed here is exactly what used to let a spurious "empty"
  // read replace a real save with the default.
  return SiteContentSchema.parse(seedContent);
});

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

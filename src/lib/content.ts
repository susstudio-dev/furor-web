import 'server-only';
import { cache } from 'react';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { readText, writeText } from './storage';
import seedContent from '@/data/site-content.seed.json';

export const CONTENT_KEY = 'site-content.json';

// Deep merge: saved values win, seed fills in anything missing. Arrays are
// taken whole from saved (we never want to splice in seed items behind the
// admin's back) — only missing top-level/nested object keys fall back to seed.
// This protects against schema additions making old saves render blank.
function mergeWithSeed(saved: unknown, seed: unknown): unknown {
  if (Array.isArray(saved)) return saved;
  if (
    saved === null ||
    saved === undefined ||
    typeof saved !== 'object' ||
    typeof seed !== 'object' ||
    seed === null
  ) {
    return saved ?? seed;
  }
  const out: Record<string, unknown> = { ...(seed as Record<string, unknown>) };
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    out[k] = mergeWithSeed(v, (seed as Record<string, unknown>)[k]);
  }
  return out;
}

// Reads the live content from storage (filesystem in dev, Vercel Blob in
// prod). On first ever run the bundled seed is written through so subsequent
// admin edits persist. Wrapped in React cache() => one read per request.
export const getContent = cache(async (): Promise<SiteContent> => {
  const raw = await readText(CONTENT_KEY);
  if (raw != null) {
    // Strip BOM if present — Windows PowerShell / some editors add U+FEFF.
    const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const parsed = JSON.parse(cleaned);
    return SiteContentSchema.parse(mergeWithSeed(parsed, seedContent));
  }
  const seeded = SiteContentSchema.parse(seedContent);
  await writeText(CONTENT_KEY, JSON.stringify(seeded, null, 2));
  return seeded;
});

// Re-exports so existing call sites don't break.
export {
  visibleBatches,
  batchesForStyle,
  batchesForBranch,
  nextBatchPerStyle,
  styleBySlug,
  studioBySlug,
} from './content-helpers';
export { formatBatchDate, formatInr, todayIso } from './format';

import 'server-only';
import { cache } from 'react';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { readText, writeText } from './storage';
import seedContent from '@/data/site-content.seed.json';

export const CONTENT_KEY = 'site-content.json';

// Reads the live content from storage (filesystem in dev, Vercel Blob in
// prod). On first ever run the bundled seed is written through so subsequent
// admin edits persist. Wrapped in React cache() => one read per request.
export const getContent = cache(async (): Promise<SiteContent> => {
  const raw = await readText(CONTENT_KEY);
  if (raw != null) {
    return SiteContentSchema.parse(JSON.parse(raw));
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

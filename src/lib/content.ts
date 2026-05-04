import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { cache } from 'react';
import { SiteContentSchema, type SiteContent } from './content-schema';

const LOCAL_PATH = path.join(process.cwd(), 'data', 'site-content.json');
const SEED_PATH = path.join(process.cwd(), 'src', 'data', 'site-content.seed.json');

async function readLocal(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(LOCAL_PATH, 'utf8');
    return SiteContentSchema.parse(JSON.parse(raw));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      const seed = await fs.readFile(SEED_PATH, 'utf8');
      const parsed = SiteContentSchema.parse(JSON.parse(seed));
      await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
      await fs.writeFile(LOCAL_PATH, JSON.stringify(parsed, null, 2), 'utf8');
      return parsed;
    }
    throw err;
  }
}

// Production: would read from Vercel Blob via the BLOB_READ_WRITE_TOKEN.
// Stubbed for now — deferred to deployment phase. The shape is identical.
async function readBlob(): Promise<SiteContent> {
  // TODO(prod): fetch the latest site-content.json blob via @vercel/blob and parse.
  return readLocal();
}

export const getContent = cache(async (): Promise<SiteContent> => {
  if (process.env.BLOB_READ_WRITE_TOKEN) return readBlob();
  return readLocal();
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

import 'server-only';
import { revalidatePath } from 'next/cache';
import type { SiteContent } from './content-schema';
import { publicPathsFor } from './public-urls';

// Shared by the save and restore routes. Public pages render per-request on
// Cloudflare (see connection() in the root layout), so freshness doesn't
// depend on these calls there — they matter in dev and on any host with ISR.
// Wrapped so a runtime without tag-cache machinery can never turn a
// successful save into a 500.
export function revalidatePublicPages(content: SiteContent): void {
  try {
    revalidatePath('/', 'layout');
    for (const p of publicPathsFor(content)) revalidatePath(p);
  } catch (err) {
    console.warn('revalidatePath failed (non-fatal):', err);
  }
}

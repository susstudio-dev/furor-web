import 'server-only';
import { revalidatePath } from 'next/cache';
import type { SiteContent } from './content-schema';

// Shared by the save and restore routes. Public pages render per-request on
// Cloudflare (see connection() in the root layout), so freshness doesn't
// depend on these calls there — they matter in dev and on any host with ISR.
// Wrapped so a runtime without tag-cache machinery can never turn a
// successful save into a 500.
export function revalidatePublicPages(content: SiteContent): void {
  try {
    revalidatePath('/', 'layout');
    for (const p of [
      '/',
      '/about',
      '/faqs',
      '/contact',
      '/instructors',
      '/stories',
      '/dance-styles',
      '/batches',
      '/privacy',
      '/terms',
      '/sitemap.xml',
    ]) {
      revalidatePath(p);
    }
    for (const s of content.danceStyles) revalidatePath(`/dance-styles/${s.slug}`);
    for (const s of content.stories) revalidatePath(`/stories/${s.slug}`);
    for (const p of content.customPages) revalidatePath(`/p/${p.slug}`);
  } catch (err) {
    console.warn('revalidatePath failed (non-fatal):', err);
  }
}

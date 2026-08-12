import type { SiteContent } from './content-schema';

// One list, two consumers: revalidatePath() in dev and on any ISR host, and
// the Cloudflare edge purge after a published save. They must not drift — a
// path that is cached but never purged serves a 60s-stale page after an edit.

const STATIC_PATHS = [
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
] as const;

export function publicPathsFor(content: SiteContent): string[] {
  const seen = new Set<string>(STATIC_PATHS);
  for (const s of content.danceStyles) seen.add(`/dance-styles/${s.slug}`);
  for (const s of content.stories) seen.add(`/stories/${s.slug}`);
  for (const p of content.customPages) seen.add(`/p/${p.slug}`);
  return [...seen];
}

export function absoluteUrls(paths: string[], origin: string): string[] {
  const base = origin.replace(/\/$/, '');
  return paths.map((p) => `${base}${p}`);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

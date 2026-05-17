import type { MetadataRoute } from 'next';
import { getContent } from '@/lib/content';

const BASE = 'https://www.dancehyderabad.com';

// Built from the seed JSON at build time — safe to fully prerender.
export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const c = await getContent();
  const now = new Date();
  const fixed = ['', '/dance-styles', '/batches', '/instructors', '/about', '/stories', '/faqs', '/contact', '/privacy', '/terms'].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
  }));
  const styles = c.danceStyles.map((s) => ({ url: `${BASE}/dance-styles/${s.slug}`, lastModified: now }));
  const stories = c.stories.map((s) => ({ url: `${BASE}/stories/${s.slug}`, lastModified: new Date(s.publishedAt) }));
  return [...fixed, ...styles, ...stories];
}

import type { MetadataRoute } from 'next';
import { getContent } from '@/lib/content';

const BASE = 'https://www.dancehyderabad.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const c = await getContent();
  const now = new Date();
  const fixed = ['', '/dance-styles', '/batches', '/studios', '/about', '/stories'].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
  }));
  const styles = c.danceStyles.map((s) => ({ url: `${BASE}/dance-styles/${s.slug}`, lastModified: now }));
  const studios = c.studios.map((s) => ({ url: `${BASE}/studios/${s.slug}`, lastModified: now }));
  const stories = c.stories.map((s) => ({ url: `${BASE}/stories/${s.slug}`, lastModified: new Date(s.publishedAt) }));
  return [...fixed, ...styles, ...studios, ...stories];
}

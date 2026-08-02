import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { getContent } from '@/lib/content';

const BASE = 'https://www.dancehyderabad.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // On Workers, render per-request so admin-published stories/custom pages
  // appear without a redeploy. The GH Pages export stays build-time static
  // (the mirror is noindexed anyway).
  if (process.env.GH_PAGES !== 'true') await connection();
  const c = await getContent();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/dance-styles`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/batches`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/instructors`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/stories`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/faqs`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
  const styles: MetadataRoute.Sitemap = c.danceStyles.map((s) => ({
    url: `${BASE}/dance-styles/${s.slug}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));
  const stories: MetadataRoute.Sitemap = c.stories.map((s) => ({
    url: `${BASE}/stories/${s.slug}`,
    lastModified: new Date(s.publishedAt),
    changeFrequency: 'yearly',
    priority: 0.4,
  }));
  const custom: MetadataRoute.Sitemap = c.customPages
    .filter((p) => p.published)
    .map((p) => ({ url: `${BASE}/p/${p.slug}`, changeFrequency: 'monthly', priority: 0.5 }));
  return [...fixed, ...styles, ...stories, ...custom];
}

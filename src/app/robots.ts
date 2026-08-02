import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

// The GitHub Pages mirror is a read-only duplicate of the real site — it must
// never be indexed (duplicate content). The env is inlined at build time.
const isMirror = process.env.GH_PAGES === 'true';

export default function robots(): MetadataRoute.Robots {
  if (isMirror) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: 'https://www.dancehyderabad.com/sitemap.xml',
  };
}

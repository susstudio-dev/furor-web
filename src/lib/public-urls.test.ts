import { describe, expect, it } from 'vitest';
import { absoluteUrls, chunk, publicPathsFor } from './public-urls';
import type { SiteContent } from './content-schema';

const doc = () =>
  ({
    danceStyles: [{ slug: 'salsa' }, { slug: 'bachata' }],
    stories: [{ slug: 'first-night' }],
    customPages: [{ slug: 'latinl1july2026' }],
  }) as unknown as SiteContent;

describe('publicPathsFor', () => {
  it('includes every static public route', () => {
    const paths = publicPathsFor(doc());
    for (const p of ['/', '/about', '/batches', '/contact', '/faqs', '/instructors', '/sitemap.xml']) {
      expect(paths).toContain(p);
    }
  });

  it('includes one path per dance style, story and custom page', () => {
    const paths = publicPathsFor(doc());
    expect(paths).toContain('/dance-styles/salsa');
    expect(paths).toContain('/dance-styles/bachata');
    expect(paths).toContain('/stories/first-night');
    expect(paths).toContain('/p/latinl1july2026');
  });

  it('never repeats a path', () => {
    // A duplicate costs a wasted revalidatePath and a wasted purge slot —
    // Cloudflare's purge API takes 30 URLs per request.
    const paths = publicPathsFor(doc());
    expect(paths.length).toBe(new Set(paths).size);
  });
});

describe('absoluteUrls', () => {
  it('prefixes the origin without producing a double slash', () => {
    expect(absoluteUrls(['/', '/batches'], 'https://www.dancehyderabad.com/')).toEqual([
      'https://www.dancehyderabad.com/',
      'https://www.dancehyderabad.com/batches',
    ]);
  });
});

describe('chunk', () => {
  it('splits into batches of at most n, keeping order', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns an empty list for an empty input', () => {
    expect(chunk([], 30)).toEqual([]);
  });
});

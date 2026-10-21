import { describe, expect, it } from 'vitest';
import { heroPoster, srcSetFor, variantsFor, type VariantManifest } from './image-variants';
import seedContent from '@/data/site-content.seed.json';

const fixture: VariantManifest = {
  '/photos/A.jpg': {
    heroPortrait: [
      { width: 750, height: 1380, avif: '/img/a-hp-750-aa.avif', webp: '/img/a-hp-750-aa.webp', jpg: '/img/a-hp-750-aa.jpg' },
      { width: 1125, height: 2070, avif: '/img/a-hp-1125-aa.avif', webp: '/img/a-hp-1125-aa.webp', jpg: '/img/a-hp-1125-aa.jpg' },
    ],
    heroLandscape: [
      { width: 1080, height: 721, avif: '/img/a-hl-1080-aa.avif', webp: '/img/a-hl-1080-aa.webp', jpg: '/img/a-hl-1080-aa.jpg' },
    ],
  },
  '/photos/B.jpg': {
    card: [
      { width: 750, height: 938, avif: '/img/b-card-750-bb.avif', webp: '/img/b-card-750-bb.webp', jpg: '/img/b-card-750-bb.jpg' },
    ],
  },
};

describe('variantsFor', () => {
  it('returns the renditions recorded for a source and kind', () => {
    expect(variantsFor('/photos/A.jpg', 'heroPortrait', fixture).map((f) => f.width)).toEqual([
      750, 1125,
    ]);
  });

  it('returns an empty list for a source the manifest has never seen', () => {
    expect(variantsFor('/uploads/never-built.png', 'avatar', fixture)).toEqual([]);
  });

  it('returns an empty list for a kind that source has no renditions for', () => {
    expect(variantsFor('/photos/B.jpg', 'heroPortrait', fixture)).toEqual([]);
  });
});

describe('srcSetFor', () => {
  it('joins width descriptors in manifest order', () => {
    expect(srcSetFor(variantsFor('/photos/A.jpg', 'heroPortrait', fixture), 'avif')).toBe(
      '/img/a-hp-750-aa.avif 750w, /img/a-hp-1125-aa.avif 1125w',
    );
  });

  it('returns an empty string when there are no renditions', () => {
    expect(srcSetFor([], 'webp')).toBe('');
  });
});

describe('heroPoster', () => {
  it('builds the portrait and landscape source sets the <picture> needs', () => {
    expect(heroPoster('/photos/A.jpg', fixture)).toEqual({
      portrait: {
        avif: '/img/a-hp-750-aa.avif 750w, /img/a-hp-1125-aa.avif 1125w',
        webp: '/img/a-hp-750-aa.webp 750w, /img/a-hp-1125-aa.webp 1125w',
        jpg: '/img/a-hp-750-aa.jpg 750w, /img/a-hp-1125-aa.jpg 1125w',
        jpgSrc: '/img/a-hp-750-aa.jpg',
      },
      landscape: {
        avif: '/img/a-hl-1080-aa.avif 1080w',
        webp: '/img/a-hl-1080-aa.webp 1080w',
        jpg: '/img/a-hl-1080-aa.jpg 1080w',
      },
    });
  });

  it('returns null when a poster has no built crops, so the caller can fall back', () => {
    // The real case: an admin uploads a new hero photo and nobody re-runs
    // `npm run build:images`. Hero must render the raw upload, not nothing.
    expect(heroPoster('/uploads/brand-new.jpg', fixture)).toBe(null);
  });
});

describe('the shipped manifest', () => {
  it('still covers the seed hero poster in both crops', () => {
    // Guard, not coverage: this is the test that fails when someone changes
    // the hero photo without re-running the image pipeline.
    const src = seedContent.hero.posterImage;
    expect(variantsFor(src, 'heroPortrait').length).toBe(2);
    expect(variantsFor(src, 'heroLandscape').length).toBe(1);
  });
});

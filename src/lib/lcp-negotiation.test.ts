import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { IMAGE_VARIANTS, heroPoster } from './image-variants';
import {
  DEVICE_PROFILES,
  assertPreloadPlacement,
  buildHeroPosterFromManifest,
  defaultSupportsType,
  effectiveDisplayWidthPx,
  heroPictureSources,
  matchesMediaCondition,
  negotiateHeroLcp,
  parseSrcSet,
  selectPictureSource,
  selectSrcSetCandidate,
  type HeroPosterLike,
  type RawVariantManifest,
} from './lcp-negotiation';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

describe('parseSrcSet', () => {
  test('parses one or more url/width descriptor pairs', () => {
    expect(parseSrcSet('/a.avif 750w, /b.avif 1125w')).toEqual([
      { url: '/a.avif', width: 750 },
      { url: '/b.avif', width: 1125 },
    ]);
  });

  test('parses a single candidate with no trailing comma', () => {
    expect(parseSrcSet('/only.avif 1080w')).toEqual([{ url: '/only.avif', width: 1080 }]);
  });

  test('throws on a malformed entry', () => {
    expect(() => parseSrcSet('/no-width-descriptor')).toThrow();
  });
});

describe('selectSrcSetCandidate', () => {
  const candidates = [
    { url: '/750.avif', width: 750 },
    { url: '/1125.avif', width: 1125 },
  ];

  test('picks the smallest candidate whose width is >= target (exact match)', () => {
    expect(selectSrcSetCandidate(candidates, 750)).toEqual({ url: '/750.avif', width: 750 });
  });

  test('picks the smallest candidate strictly larger than a sub-target request', () => {
    expect(selectSrcSetCandidate(candidates, 800)).toEqual({ url: '/1125.avif', width: 1125 });
  });

  test('falls back to the largest candidate when none is big enough (DPR-3 case)', () => {
    // 390 CSS px * DPR 3 = 1170 target px; neither 750 nor 1125 clears it.
    expect(selectSrcSetCandidate(candidates, 1170)).toEqual({ url: '/1125.avif', width: 1125 });
  });

  test('a single candidate always wins regardless of target', () => {
    expect(selectSrcSetCandidate([{ url: '/only.jpg', width: 400 }], 5000)).toEqual({
      url: '/only.jpg',
      width: 400,
    });
  });

  test('throws on an empty candidate list', () => {
    expect(() => selectSrcSetCandidate([], 100)).toThrow();
  });
});

describe('matchesMediaCondition', () => {
  test('no condition always matches', () => {
    expect(matchesMediaCondition(undefined, 375)).toBe(true);
  });

  test('min-width matches at and above the breakpoint, not below', () => {
    expect(matchesMediaCondition('(min-width: 640px)', 640)).toBe(true);
    expect(matchesMediaCondition('(min-width: 640px)', 1024)).toBe(true);
    expect(matchesMediaCondition('(min-width: 640px)', 375)).toBe(false);
  });

  test('max-width matches at and below the breakpoint, not above', () => {
    expect(matchesMediaCondition('(max-width: 639px)', 639)).toBe(true);
    expect(matchesMediaCondition('(max-width: 639px)', 640)).toBe(false);
  });

  test('throws on an unsupported condition form', () => {
    expect(() => matchesMediaCondition('(orientation: landscape)', 375)).toThrow();
  });
});

describe('effectiveDisplayWidthPx', () => {
  test('a bare "100vw" is the full viewport width', () => {
    expect(effectiveDisplayWidthPx('100vw', 375)).toBe(375);
    expect(effectiveDisplayWidthPx('100vw', 390)).toBe(390);
  });

  test('a bare px length ignores the viewport', () => {
    expect(effectiveDisplayWidthPx('480px', 375)).toBe(480);
  });

  test('evaluates a media-conditioned list left to right, first match wins', () => {
    const sizes = '(min-width: 640px) 480px, 100vw';
    expect(effectiveDisplayWidthPx(sizes, 1024)).toBe(480);
    expect(effectiveDisplayWidthPx(sizes, 375)).toBe(375);
  });
});

describe('selectPictureSource', () => {
  const sources = [
    { media: '(min-width: 640px)', type: 'image/avif', srcset: '/land.avif 1080w', sizes: '100vw' },
    { media: '(min-width: 640px)', type: undefined, srcset: '/land.jpg 1080w', sizes: '100vw' },
    { media: undefined, type: 'image/avif', srcset: '/port-750.avif 750w, /port-1125.avif 1125w', sizes: '100vw' },
    { media: undefined, type: undefined, srcset: '/port.jpg 750w', sizes: '100vw' },
  ];

  test('a narrow viewport skips the media-scoped desktop sources', () => {
    const { source, candidate } = selectPictureSource(sources, { name: 'phone', widthCss: 375, dpr: 2 });
    expect(source.srcset).toContain('/port-750.avif');
    expect(candidate.url).toBe('/port-750.avif');
  });

  test('a wide viewport takes the first matching desktop source (avif)', () => {
    const { candidate } = selectPictureSource(sources, { name: 'desktop', widthCss: 1024, dpr: 1 });
    expect(candidate.url).toBe('/land.avif');
  });

  test('an AVIF-incapable browser falls through to the untyped JPEG source', () => {
    const { candidate } = selectPictureSource(sources, { name: 'desktop', widthCss: 1024, dpr: 1 }, (t) => t === undefined);
    expect(candidate.url).toBe('/land.jpg');
  });

  test('defaultSupportsType accepts only AVIF and the untyped fallback', () => {
    expect(defaultSupportsType('image/avif')).toBe(true);
    expect(defaultSupportsType(undefined)).toBe(true);
    expect(defaultSupportsType('image/webp')).toBe(false);
  });

  test('throws if nothing matches (no universal fallback present)', () => {
    expect(() =>
      selectPictureSource(
        [{ media: '(min-width: 999999px)', type: undefined, srcset: '/x.jpg 100w', sizes: '100vw' }],
        { name: 'phone', widthCss: 375, dpr: 2 },
      ),
    ).toThrow();
  });
});

describe('heroPictureSources — structural cross-check against Hero.tsx', () => {
  const fixture: HeroPosterLike = {
    portrait: { avif: 'PORTRAIT_AVIF', webp: 'PORTRAIT_WEBP', jpg: 'PORTRAIT_JPG', jpgSrc: 'PORTRAIT_JPGSRC' },
    landscape: { avif: 'LANDSCAPE_AVIF', webp: 'LANDSCAPE_WEBP', jpg: 'LANDSCAPE_JPG' },
  };

  test('matches the resolver-declared shape exactly (order, media, type, sizes)', () => {
    expect(heroPictureSources(fixture)).toEqual([
      { media: '(min-width: 640px)', type: 'image/avif', srcset: 'LANDSCAPE_AVIF', sizes: '100vw' },
      { media: '(min-width: 640px)', type: 'image/webp', srcset: 'LANDSCAPE_WEBP', sizes: '100vw' },
      { media: '(min-width: 640px)', type: undefined, srcset: 'LANDSCAPE_JPG', sizes: '100vw' },
      { media: undefined, type: 'image/avif', srcset: 'PORTRAIT_AVIF', sizes: '100vw' },
      { media: undefined, type: 'image/webp', srcset: 'PORTRAIT_WEBP', sizes: '100vw' },
      { media: undefined, type: undefined, srcset: 'PORTRAIT_JPG', sizes: '100vw' },
    ]);
  });

  // This is the "resolver output and emitted markup agree" claim, made
  // checkable: parse Hero.tsx's *actual* <picture> JSX text (not a
  // hand-copied guess of it) and assert its <source>/<img> sequence — order,
  // media, type, sizes, and which `poster.*` field each srcSet expression
  // reads — matches what heroPictureSources() declares. A reorder, a
  // media/type edit, or a source bound to the wrong poster field in
  // Hero.tsx breaks this test without needing a running browser.
  test('Hero.tsx literal <picture> JSX matches heroPictureSources() field-for-field', () => {
    const heroSrc = readFileSync(resolve(ROOT, 'src/components/Hero.tsx'), 'utf8');
    const pictureBlock = heroSrc.slice(heroSrc.indexOf('<picture>'), heroSrc.indexOf('</picture>'));

    const exprToMarker: Record<string, string> = {
      'poster.landscape.avif': 'LANDSCAPE_AVIF',
      'poster.landscape.webp': 'LANDSCAPE_WEBP',
      'poster.landscape.jpg': 'LANDSCAPE_JPG',
      'poster.portrait.avif': 'PORTRAIT_AVIF',
      'poster.portrait.webp': 'PORTRAIT_WEBP',
      'poster.portrait.jpg': 'PORTRAIT_JPG',
    };

    const sourceTagPattern = /<source\b([^>]*)\/>/g;
    const parsed: { media?: string; type?: string; srcset: string; sizes: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = sourceTagPattern.exec(pictureBlock))) {
      const attrs = m[1];
      const media = attrs.match(/media="([^"]*)"/)?.[1];
      const type = attrs.match(/type="([^"]*)"/)?.[1];
      const srcSetExpr = attrs.match(/srcSet=\{([^}]*)\}/)?.[1]?.trim();
      const sizes = attrs.match(/sizes="([^"]*)"/)?.[1];
      if (!srcSetExpr || !sizes) throw new Error(`Could not parse <source ${attrs}>`);
      const marker = exprToMarker[srcSetExpr];
      if (!marker) throw new Error(`Unknown poster field expression in Hero.tsx: "${srcSetExpr}"`);
      parsed.push({ media, type, srcset: marker, sizes });
    }

    // The trailing <img> fallback, up to its self-closing `/>`.
    const imgBlock = pictureBlock.slice(pictureBlock.indexOf('<img'), pictureBlock.indexOf('/>', pictureBlock.indexOf('<img')) + 2);
    const imgSrcSetExpr = imgBlock.match(/srcSet=\{([^}]*)\}/)?.[1]?.trim();
    const imgSizes = imgBlock.match(/sizes="([^"]*)"/)?.[1];
    if (!imgSrcSetExpr || !imgSizes) throw new Error('Could not parse the fallback <img> tag');
    const imgMarker = exprToMarker[imgSrcSetExpr];
    if (!imgMarker) throw new Error(`Unknown poster field expression on <img>: "${imgSrcSetExpr}"`);
    parsed.push({ media: undefined, type: undefined, srcset: imgMarker, sizes: imgSizes });

    expect(parsed).toEqual(heroPictureSources(fixture));
  });
});

describe('negotiateHeroLcp — against the real committed manifest', () => {
  const poster = heroPoster('/photos/DSC_0166.jpg');
  if (!poster) throw new Error('Expected /photos/DSC_0166.jpg to have pre-built hero variants');

  test('375×667 @DPR2 selects the 750w AVIF portrait crop', () => {
    const result = negotiateHeroLcp(poster, DEVICE_PROFILES[0]);
    expect(result.width).toBe(750);
    expect(result.url).toContain('hero-portrait-750');
    expect(result.url).toMatch(/\.avif$/);
  });

  test('390×844 @DPR3 selects the 1125w AVIF portrait crop (no candidate meets 1170px target)', () => {
    const result = negotiateHeroLcp(poster, DEVICE_PROFILES[1]);
    expect(result.width).toBe(1125);
    expect(result.url).toContain('hero-portrait-1125');
    expect(result.url).toMatch(/\.avif$/);
  });

  test('the selected files measure the exact bytes PRODUCT.md now budgets against', () => {
    const dpr2 = negotiateHeroLcp(poster, DEVICE_PROFILES[0]);
    const dpr3 = negotiateHeroLcp(poster, DEVICE_PROFILES[1]);
    const bytes = (url: string) => statSync(resolve(ROOT, 'public', url.replace(/^\//, ''))).size;
    expect(bytes(dpr2.url)).toBe(36741);
    expect(bytes(dpr3.url)).toBe(54341);
  });
});

describe('assertPreloadPlacement — text-fixture edge cases', () => {
  test('passes when both preload tags sit before </head>', () => {
    const html =
      '<html><head>' +
      '<link rel="preload" as="image" href="/a.jpg"/>' +
      '<link rel="preload" as="image" href="/b.jpg"/>' +
      '</head><body>hi</body></html>';
    const result = assertPreloadPlacement(html);
    expect(result.ok).toBe(true);
    expect(result.preloadCount).toBe(2);
    expect(result.issues).toEqual([]);
  });

  test('fails when a preload tag sits after </head>', () => {
    const html =
      '<html><head></head><body>hi<link rel="preload" as="image" href="/a.jpg"/></body></html>';
    const result = assertPreloadPlacement(html);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatch(/AFTER <\/head>/);
  });

  test('ignores non-preload and non-image <link> tags', () => {
    const html =
      '<html><head>' +
      '<link rel="stylesheet" href="/x.css"/>' +
      '<link rel="preload" as="font" href="/f.woff2"/>' +
      '</head><body><link rel="preload" as="image" href="/late.jpg"/></body></html>';
    const result = assertPreloadPlacement(html);
    // Only the `as="image"` preload counts, and it is the late one.
    expect(result.preloadCount).toBe(1);
    expect(result.ok).toBe(false);
  });

  test('fails with no </head> at all', () => {
    const result = assertPreloadPlacement('<body>no head here</body>');
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatch(/No <\/head>/);
  });

  test('fails with no preload tags at all', () => {
    const result = assertPreloadPlacement('<html><head></head><body>hi</body></html>');
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatch(/No rel="preload"/);
  });
});

describe('assertPreloadPlacement — closing the loop against real react-dom SSR output', () => {
  // Mirrors page.tsx's actual pattern exactly: two preload <link>s rendered
  // as early siblings of the page's returned tree, which Next's root layout
  // places inside <body> alongside everything else. Whether they end up
  // textually inside <head>...</head> in the *served* HTML depends entirely
  // on react-dom's server "Resource" hoisting, not on their JSX position —
  // exercising the actual react-dom/server engine here (no jsdom, no RTL,
  // no dev server) is what makes this a real "served markup" check.
  function renderPreloadFixture(withHref: boolean): string {
    const attrs = (media: string, href: string) => ({
      rel: 'preload',
      as: 'image',
      type: 'image/avif',
      media,
      ...(withHref ? { href } : {}),
      imageSrcSet: `${href.replace(/\.jpg$/, '.avif')} 750w`,
      imageSizes: '100vw',
      fetchPriority: 'high',
    });
    const tree = createElement(
      'html',
      null,
      createElement('head', null),
      createElement(
        'body',
        null,
        createElement('link', attrs('(max-width: 639px)', '/img/dsc-0166-hero-portrait-750-fa34ce37.jpg')),
        createElement('link', attrs('(min-width: 640px)', '/img/dsc-0166-hero-landscape-1080-fa34ce37.jpg')),
        createElement('div', null, 'rest of the page'),
      ),
    );
    return renderToStaticMarkup(tree);
  }

  test('with a real string href, react-dom hoists both preloads into <head> — the shipped fix', () => {
    const html = renderPreloadFixture(true);
    const result = assertPreloadPlacement(html);
    expect(result.preloadCount).toBe(2);
    expect(result.ok).toBe(true);
  });

  test('without href, react-dom does NOT hoist them — reproduces the historical Task 6 bug', () => {
    const html = renderPreloadFixture(false);
    const result = assertPreloadPlacement(html);
    expect(result.preloadCount).toBe(2);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBe(2);
  });
});

describe('buildHeroPosterFromManifest — parity with the real heroPoster()', () => {
  // scripts/audit-image-weight.mjs cannot import image-variants.ts (its
  // `@/data/...` alias only resolves through a bundler), so it re-implements
  // heroPoster() against a plain manifest object. This pins that duplicate
  // to produce byte-identical output to the real function for the real,
  // committed manifest — any future edit to heroPoster()'s algorithm that
  // isn't mirrored here fails this test instead of silently diverging.
  test('matches heroPoster() exactly for /photos/DSC_0166.jpg', () => {
    const real = heroPoster('/photos/DSC_0166.jpg');
    const reimplemented = buildHeroPosterFromManifest(
      IMAGE_VARIANTS as unknown as RawVariantManifest,
      '/photos/DSC_0166.jpg',
    );
    expect(reimplemented).toEqual(real);
  });

  test('returns null for a src with no pre-built hero variants, matching heroPoster()', () => {
    const real = heroPoster('/uploads/anything.jpg');
    const reimplemented = buildHeroPosterFromManifest(
      IMAGE_VARIANTS as unknown as RawVariantManifest,
      '/uploads/anything.jpg',
    );
    expect(reimplemented).toEqual(real);
    expect(reimplemented).toBeNull();
  });
});

test('the fixture-manifest file this module depends on for real-data tests exists on disk', () => {
  expect(existsSync(resolve(ROOT, 'src/data/image-variants.json'))).toBe(true);
});

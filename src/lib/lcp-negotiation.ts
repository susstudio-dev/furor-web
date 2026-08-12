// Reproduces, in pure functions, the browser algorithm that resolves a
// <picture>'s <source>/<img> candidates against a real viewport — the piece
// `scripts/audit-image-weight.mjs` was missing before Task 16. That script
// used to read `hero.posterImage` straight off the content document and
// measure the 2000x1335 master on disk, which is what a browser fetched
// before Task 6's hand-written <picture> shipped, and NEVER what it fetches
// now — so the meter could not observe the pipeline's own success.
//
// This module is deliberately dependency-free (no `@/`-aliased imports, no
// react, no fs) so `scripts/audit-image-weight.mjs` — a plain Node ESM file
// that has no TypeScript loader configured (Node 20, the version CI pins in
// .github/workflows/quality.yml, cannot import a .ts file directly) — can
// load it at runtime via esbuild's synchronous `transformSync` (esbuild is
// already an installed dependency, pulled in transitively by vitest; no new
// package was added for this). Keeping this file free of unresolvable
// specifiers is what makes that transform-then-`import()` trick work without
// a bundler. `src/lib/image-variants.ts` itself is untouched — Task 6's
// verified `heroPoster()`/`variantsFor()` keep serving the real app exactly
// as before.

/** One entry of a parsed `srcset` attribute: a URL and its `w`-descriptor. */
export interface SrcSetCandidate {
  url: string;
  width: number;
}

/** Parses the same `"url1 w1w, url2 w2w"` format `srcSetFor()` emits. */
export function parseSrcSet(srcset: string): SrcSetCandidate[] {
  return srcset
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const parts = entry.split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1];
      const widthMatch = descriptor?.match(/^(\d+)w$/);
      if (!url || !widthMatch) {
        throw new Error(`Malformed srcset candidate (expected "<url> <N>w"): "${entry}"`);
      }
      return { url, width: Number(widthMatch[1]) };
    });
}

/**
 * The HTML spec's selection rule: the smallest candidate whose width is at
 * least `targetPx` (display width in CSS px times DPR); if none is that
 * large, the largest available candidate (a browser never fetches nothing).
 */
export function selectSrcSetCandidate(
  candidates: SrcSetCandidate[],
  targetPx: number,
): SrcSetCandidate {
  if (candidates.length === 0) throw new Error('selectSrcSetCandidate: empty candidate list');
  const sorted = [...candidates].sort((a, b) => a.width - b.width);
  return sorted.find((c) => c.width >= targetPx) ?? sorted[sorted.length - 1];
}

function parseLength(raw: string, viewportWidthCss: number): number {
  const vw = raw.match(/^([\d.]+)vw$/);
  if (vw) return (parseFloat(vw[1]) / 100) * viewportWidthCss;
  const px = raw.match(/^([\d.]+)px$/);
  if (px) return parseFloat(px[1]);
  throw new Error(`Unsupported sizes length: "${raw}"`);
}

/**
 * Evaluates one `<source media="…">` / `<picture>` media condition. Only
 * `min-width`/`max-width` in px are supported — the only forms Hero.tsx's
 * hand-written `<picture>` uses (`(min-width: 640px)` on the landscape
 * sources, no media at all on the portrait/mobile ones).
 */
export function matchesMediaCondition(
  condition: string | undefined,
  viewportWidthCss: number,
): boolean {
  if (!condition) return true;
  const min = condition.match(/min-width:\s*([\d.]+)px/);
  const max = condition.match(/max-width:\s*([\d.]+)px/);
  if (!min && !max) throw new Error(`Unsupported media condition: "${condition}"`);
  let ok = true;
  if (min) ok = ok && viewportWidthCss >= parseFloat(min[1]);
  if (max) ok = ok && viewportWidthCss <= parseFloat(max[1]);
  return ok;
}

/**
 * The CSS px width an image will render at, per the `sizes` attribute, for a
 * given viewport. Supports a bare length ("100vw", "480px") and the full
 * comma-separated "<media-condition> <length>[, …], <fallback-length>" list
 * grammar, evaluated left to right per spec (first matching entry wins).
 */
export function effectiveDisplayWidthPx(sizes: string, viewportWidthCss: number): number {
  const entries = sizes
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const entry of entries) {
    const m = entry.match(/^(\(.*\))\s+(.+)$/);
    if (m) {
      if (matchesMediaCondition(m[1], viewportWidthCss)) return parseLength(m[2], viewportWidthCss);
    } else {
      return parseLength(entry, viewportWidthCss);
    }
  }
  return viewportWidthCss;
}

/** A device this audit measures against. */
export interface DeviceProfile {
  name: string;
  widthCss: number;
  dpr: number;
}

// The brief's minimum pair: a common small-phone size and the sharpest
// mainstream phone class (390 CSS px @ DPR 3 — the iPhone 14/15/16 family).
export const DEVICE_PROFILES: DeviceProfile[] = [
  { name: '375×667 @DPR2', widthCss: 375, dpr: 2 },
  { name: '390×844 @DPR3', widthCss: 390, dpr: 3 },
];

/** One `<source>` (or the trailing `<img>`, which has no `media`/`type`). */
export interface PictureSourceSpec {
  media?: string;
  /** `undefined` on the trailing `<img>` fallback — always "supported". */
  type?: string;
  srcset: string;
  sizes: string;
}

/** Whether a browser capable only of AVIF (+ the untyped JPEG fallback). */
export function defaultSupportsType(type: string | undefined): boolean {
  return type === undefined || type === 'image/avif';
}

/**
 * Walks a `<picture>`'s sources in DOM order and applies a browser's real
 * selection algorithm: first source whose `media` matches the viewport and
 * whose `type` is supported, then the srcset/sizes candidate selection
 * within it. Throws if nothing matches — a `<picture>` is malformed if its
 * final entry (the `<img>` stand-in) can ever fail to match.
 */
export function selectPictureSource(
  sources: PictureSourceSpec[],
  profile: DeviceProfile,
  supportsType: (type: string | undefined) => boolean = defaultSupportsType,
): { source: PictureSourceSpec; candidate: SrcSetCandidate } {
  for (const source of sources) {
    if (!matchesMediaCondition(source.media, profile.widthCss)) continue;
    if (!supportsType(source.type)) continue;
    const displayWidth = effectiveDisplayWidthPx(source.sizes, profile.widthCss);
    const candidate = selectSrcSetCandidate(parseSrcSet(source.srcset), displayWidth * profile.dpr);
    return { source, candidate };
  }
  throw new Error(
    'selectPictureSource: no source matched — the final entry must have no media/type to act as a universal fallback',
  );
}

/** Structurally the same shape `image-variants.ts`'s `HeroPoster` returns. */
export interface HeroPosterLike {
  portrait: { avif: string; webp: string; jpg: string; jpgSrc: string };
  landscape: { avif: string; webp: string; jpg: string };
}

/** Structurally the same shape as `image-variants.ts`'s `VariantFile`. */
export interface VariantFileLike {
  width: number;
  avif: string;
  webp: string;
  jpg: string;
}

/** Structurally the same shape as the committed `image-variants.json`. */
export type RawVariantManifest = Record<string, Record<string, VariantFileLike[] | undefined>>;

function srcSetForLike(files: VariantFileLike[], format: 'avif' | 'webp' | 'jpg'): string {
  return files.map((f) => `${f[format]} ${f.width}w`).join(', ');
}

/**
 * Re-implements `image-variants.ts`'s `heroPoster()` against a plain manifest
 * object instead of the `@/data/image-variants.json` import that function
 * relies on. That import uses a TypeScript path alias (`@/*`) which only
 * resolves through Next's/vitest's bundler — `scripts/audit-image-weight.mjs`
 * runs as plain Node ESM with no bundler, so it cannot load `image-variants.ts`
 * directly (see this file's top-of-file comment). `lcp-negotiation.test.ts`
 * asserts this returns byte-identical output to the real `heroPoster()` for
 * the real manifest, so the two cannot silently drift apart.
 */
export function buildHeroPosterFromManifest(
  manifest: RawVariantManifest,
  src: string,
): HeroPosterLike | null {
  const portrait = manifest[src]?.heroPortrait ?? [];
  const landscape = manifest[src]?.heroLandscape ?? [];
  if (portrait.length === 0 || landscape.length === 0) return null;
  return {
    portrait: {
      avif: srcSetForLike(portrait, 'avif'),
      webp: srcSetForLike(portrait, 'webp'),
      jpg: srcSetForLike(portrait, 'jpg'),
      jpgSrc: portrait[0].jpg,
    },
    landscape: {
      avif: srcSetForLike(landscape, 'avif'),
      webp: srcSetForLike(landscape, 'webp'),
      jpg: srcSetForLike(landscape, 'jpg'),
    },
  };
}

/**
 * The exact 5 `<source>` + 1 `<img>` sequence `Hero.tsx` hand-writes: the
 * media-scoped desktop/landscape group (avif, webp, jpg) first, then the
 * unscoped mobile/portrait group (avif, webp), then the portrait JPEG as the
 * `<img>` fallback. `lcp-negotiation.test.ts` cross-checks this order and
 * these exact media/type/sizes values against `Hero.tsx`'s literal source
 * text, so the two cannot silently drift apart.
 */
export function heroPictureSources(poster: HeroPosterLike): PictureSourceSpec[] {
  return [
    { media: '(min-width: 640px)', type: 'image/avif', srcset: poster.landscape.avif, sizes: '100vw' },
    { media: '(min-width: 640px)', type: 'image/webp', srcset: poster.landscape.webp, sizes: '100vw' },
    { media: '(min-width: 640px)', type: undefined, srcset: poster.landscape.jpg, sizes: '100vw' },
    { media: undefined, type: 'image/avif', srcset: poster.portrait.avif, sizes: '100vw' },
    { media: undefined, type: 'image/webp', srcset: poster.portrait.webp, sizes: '100vw' },
    { media: undefined, type: undefined, srcset: poster.portrait.jpg, sizes: '100vw' },
  ];
}

/** What a browser actually fetches for the hero LCP element, per profile. */
export function negotiateHeroLcp(
  poster: HeroPosterLike,
  profile: DeviceProfile,
  supportsType: (type: string | undefined) => boolean = defaultSupportsType,
): { url: string; width: number } {
  const { candidate } = selectPictureSource(heroPictureSources(poster), profile, supportsType);
  return { url: candidate.url, width: candidate.width };
}

export interface PreloadPlacementResult {
  ok: boolean;
  issues: string[];
  preloadCount: number;
}

/**
 * The only reliable placement check: raw served-HTML text offsets. A live
 * browser's DOM (`document.head.querySelectorAll(...)`) cannot be trusted
 * for this — React's client resource management moves recognized
 * `<link>`/`<meta>`/`<title>` elements into `<head>` on hydration regardless
 * of where they sit in the tree, which would mask a server-render placement
 * bug like Task 6's (a preload `<link>` missing a real string `href` never
 * got hoisted by react-dom's *server* renderer and rendered inertly wherever
 * its JSX sat — see `lcp-negotiation.test.ts` for the reproduction).
 */
export function assertPreloadPlacement(html: string): PreloadPlacementResult {
  const issues: string[] = [];
  const headCloseMatch = /<\/head>/i.exec(html);
  if (!headCloseMatch) {
    return { ok: false, issues: ['No </head> tag found in the served markup.'], preloadCount: 0 };
  }
  const headCloseIndex = headCloseMatch.index;
  const linkTagPattern = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  let preloadCount = 0;
  while ((match = linkTagPattern.exec(html))) {
    const tag = match[0];
    if (!/\brel="preload"/i.test(tag) || !/\bas="image"/i.test(tag)) continue;
    preloadCount++;
    if (match.index > headCloseIndex) {
      issues.push(
        `preload <link as="image"> at offset ${match.index} appears AFTER </head> (offset ${headCloseIndex}) — inert in <body>: ${tag}`,
      );
    }
  }
  if (preloadCount === 0) issues.push('No rel="preload" as="image" <link> tags found in the markup.');
  return { ok: issues.length === 0, issues, preloadCount };
}

/** @type {import('next').NextConfig} */

import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Windows + OneDrive workaround.
// OneDrive intercepts readlink() on files it has synced and returns EINVAL,
// which crashes `next dev` and `next build` when they touch `.next/...`.
// Fix: on OneDrive paths (only — not on Vercel/CI), redirect `.next` via a
// Windows directory junction to a folder outside OneDrive. Next happily
// writes to ".next"; the OS transparently puts the bytes at the target,
// which OneDrive never sees.
const cwd = process.cwd();
const isOnOneDrive = /onedrive/i.test(cwd);
const isVercel = !!process.env.VERCEL;
if (isOnOneDrive && !isVercel && process.platform === 'win32') {
  const externalDir = path.join(os.tmpdir(), 'next-cache-' + path.basename(cwd));
  const nextDir = path.resolve(cwd, '.next');
  const projectNodeModules = path.resolve(cwd, 'node_modules');
  const externalNodeModulesJunction = path.join(externalDir, 'node_modules');
  try {
    if (!existsSync(externalDir)) mkdirSync(externalDir, { recursive: true });

    // Junction project's node_modules into the external cache root so that
    // when chunks compiled to <external>/server/app/page.js try to require
    // 'next/...', Node's upward walk finds <external>/node_modules → real
    // node_modules via the junction. Without this, requires fail with
    // MODULE_NOT_FOUND because the temp dir has no node_modules tree.
    if (existsSync(projectNodeModules) && !existsSync(externalNodeModulesJunction)) {
      try {
        symlinkSync(projectNodeModules, externalNodeModulesJunction, 'junction');
      } catch {
        // ignore — the next.config will still try the .next junction below
      }
    }

    let needSymlink = true;
    if (existsSync(nextDir)) {
      const st = lstatSync(nextDir);
      if (st.isSymbolicLink()) {
        // Already a junction — leave it alone, it will reuse the external dir.
        needSymlink = false;
      } else if (st.isDirectory()) {
        // Stale real .next directory left over from before the workaround —
        // remove it so we can replace with a junction.
        rmSync(nextDir, { recursive: true, force: true });
      }
    }
    if (needSymlink) {
      symlinkSync(externalDir, nextDir, 'junction');
      // eslint-disable-next-line no-console
      console.log(`[next.config] .next → ${externalDir} (OneDrive workaround)`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[next.config] Could not set up .next junction: ${err.message}`);
  }
}

// Content-Security-Policy notes:
// - Next injects inline bootstrap <script>s, so script-src needs
//   'unsafe-inline' unless we plumb nonces through middleware on every route
//   (real CPU cost on the Workers free plan). Everything else is locked down.
// - frame-src must allow the Google Maps embeds on / and /contact.
// - googletagmanager/google-analytics cover the GA4 loader (Analytics.tsx).
// - static.cloudflareinsights.com / cloudflareinsights.com cover the Web
//   Analytics beacon Cloudflare auto-injects into every HTML response at the
//   edge; it never appears in our source. Without these the console shows a
//   blocked beacon.min.js on every page.
// Dev-only allowance so impeccable live mode can load. Guarded by NODE_ENV.
const __impeccableLiveDev =
  process.env.NODE_ENV === 'development' ? ' http://localhost:8400' : '';
// React Fast Refresh compiles modules with eval(). Without this the dev server
// serves a page whose bundle dies on CSP, so hydration never runs and every
// <Reveal> stays at opacity:0 — i.e. `next dev` renders a near-blank site.
// Dev only; the production CSP stays eval-free.
const __devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${__devEval} https://www.googletagmanager.com https://static.cloudflareinsights.com${__impeccableLiveDev}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://cloudflareinsights.com${__impeccableLiveDev}`,
  "media-src 'self' https:",
  'frame-src https://www.google.com https://maps.google.com',
  'upgrade-insecure-requests',
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  // Next 15.2+ streams <title>/<meta>/<link rel=canonical> into the BODY for
  // any user agent it believes runs JavaScript, and only blocks on metadata
  // for the short built-in "HTML-limited bots" list (Twitterbot, Slackbot…).
  // Googlebot renders JS so it copes, but every other crawler — Bingbot,
  // Screaming Frog, Ahrefs, most AI crawlers — reads raw HTML and sees a page
  // with no title, no description and no canonical in <head>. A crawl of this
  // site flagged exactly that on the pages that happened to lose the race.
  // Matching every UA makes metadata blocking (i.e. always inside <head>).
  // The cost here is nil: layout.tsx already awaits connection() + getContent()
  // before it can render anything, so the shell could never flush earlier.
  htmlLimitedBots: /.*/,
  // Dev server compiles into its own directory so a concurrent
  // `next build` / `opennextjs-cloudflare build` (which writes production
  // output to `.next`) can never clobber the running dev server's chunks.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  // No image optimizer on the Cloudflare free plan — serve images as-is.
  // (Remote hero/gallery images are already CDN-optimized; local photos are
  // pre-sized. The old *.public.blob.vercel-storage.com URLs keep rendering
  // via plain <img>/unoptimized <Image> until content is re-uploaded.)
  images: { unoptimized: true },
  // The OpenNext routing layer applies these on Cloudflare Workers.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // Public routes only, and only for a visitor holding neither the admin
      // nor the preview cookie — those two variants must never enter a shared
      // cache. /admin and /api keep no-store via the rules above; the negative
      // lookahead keeps this rule off them entirely.
      //
      // DEPLOY STEP, not optional: Cloudflare does not cache HTML by default,
      // so this header does nothing until a zone Cache Rule marks matching
      // requests "Eligible for cache" — hostname = www.dancehyderabad.com AND
      // URI path not starting with /admin or /api, respecting origin
      // cache-control. Without that rule this change is inert but harmless.
      {
        // Segment-anchored: (?!admin|...) alone is a string-prefix check, not
        // a path-segment check — it would (a) wrongly exclude a real public
        // route like /adminfoo (false match on the substring "admin") and
        // (b) do nothing to stop a hypothetical deeper /foo/admin/bar from
        // matching (the lookahead only ever inspects the very start of the
        // string). Requiring a `/` or end-of-string after each name makes
        // this an actual segment boundary, so the exclusion keeps holding if
        // either assumption above ever changes.
        source: '/((?!admin(?:/|$)|api(?:/|$)|uploads(?:/|$)).*)',
        missing: [
          { type: 'cookie', key: 'furor_admin' },
          { type: 'cookie', key: 'furor_preview' },
        ],
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
          },
        ],
      },
      // Served uploads are opaque image bytes — lock them down harder
      // than the site CSP (later matching rules win per header key).
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'" }],
      },
      // Admin site-preview drawer: an admin session makes the public site
      // frameable BY ITSELF ONLY, so /admin can show it in an iframe. This is
      // not a hole — 'self' still bars every other origin from framing us, so
      // exploiting it would need an attacker page on our own origin, which
      // already implies an XSS foothold that defeats the CSP outright.
      // BOTH sides of the embed need relaxing: frame-ancestors 'self' lets the
      // framed site render inside us, and frame-src 'self' lets the admin page
      // (the framing side) load a same-origin iframe at all — without it the
      // browser blocks the load and the preview drawer / split review render
      // an empty frame. The base CSP keeps frame-src Google-only on purpose.
      // Placement is load-bearing twice over, because later matching rules win
      // per header key: AFTER '/:path*' so it overrides DENY, and BEFORE the
      // furor_preview rule below so a draft preview's stricter no-store +
      // noindex still wins when someone holds both cookies. Vary: Cookie keeps
      // a cache from handing the frameable variant to a public visitor.
      {
        source: '/:path*',
        has: [{ type: 'cookie', key: 'furor_admin' }],
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value: CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'").replace(
              'frame-src',
              "frame-src 'self'"
            ),
          },
          // Next's own Vary tokens are repeated here on purpose. A rule in this
          // block REPLACES a header by key rather than appending to it, so
          // `Vary: Cookie` alone silently dropped
          // `rsc, next-router-state-tree, next-router-prefetch,
          // next-router-segment-prefetch` — which is what keeps an RSC payload
          // and the HTML for the same URL from being treated as one cacheable
          // response. Verified by diffing the built worker's headers with and
          // without the cookie.
          {
            key: 'Vary',
            value:
              'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Cookie',
          },
        ],
      },
      // Draft preview: while the (signed, 15-minute) furor_preview cookie is
      // present, the public site becomes frameable BY ITSELF ONLY — the admin
      // split-view review iframe needs it, and only our own authenticated
      // preview endpoint can set that cookie, so an attacker page cannot make
      // the site frameable for an ordinary visitor. Preview responses vary by
      // cookie and must never be cached or indexed. Placement matters: this
      // rule sits AFTER '/:path*' because later matching rules win per header
      // key under the OpenNext routing layer.
      {
        // Public routes only: matching '/:path*' here would overwrite the
        // /uploads lockdown above (later rules win per header key) and flip
        // the framing headers on the whole admin and API surface — none of
        // which the split view ever frames.
        source: '/((?!admin|api|uploads).*)',
        has: [{ type: 'cookie', key: 'furor_preview' }],
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'") },
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Vary', value: 'Cookie' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ];
  },
};

export default nextConfig;

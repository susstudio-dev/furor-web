/** @type {import('next').NextConfig} */

import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// When GH_PAGES=true (CI only) we build a static export of the PUBLIC site for
// GitHub Pages. Admin panel / API / middleware are stripped by the workflow
// before this runs, since they need a server runtime.
const isPages = process.env.GH_PAGES === 'true';

// Project page is served from https://<user>.github.io/furor-web/
const REPO = 'furor-web';

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
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "media-src 'self' https:",
  'frame-src https://www.google.com https://maps.google.com',
  'upgrade-insecure-requests',
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  // Dev server compiles into its own directory so a concurrent
  // `next build` / `opennextjs-cloudflare build` (which writes production
  // output to `.next`) can never clobber the running dev server's chunks.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  // No image optimizer on the Cloudflare free plan — serve images as-is.
  // (Remote hero/gallery images are already CDN-optimized; local photos are
  // pre-sized. The old *.public.blob.vercel-storage.com URLs keep rendering
  // via plain <img>/unoptimized <Image> until content is re-uploaded.)
  images: { unoptimized: true },
  ...(isPages
    ? {
        output: 'export',
        basePath: `/${REPO}`,
        assetPrefix: `/${REPO}/`,
        trailingSlash: true,
      }
    : {
        // headers() is a no-op under `output: 'export'`; the OpenNext routing
        // layer applies these on Cloudflare Workers.
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
          ];
        },
      }),
};

export default nextConfig;

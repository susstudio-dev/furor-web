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

const nextConfig = {
  reactStrictMode: true,
  ...(isPages
    ? {
        output: 'export',
        basePath: `/${REPO}`,
        assetPrefix: `/${REPO}/`,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        images: {
          formats: ['image/avif', 'image/webp'],
          remotePatterns: [
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'https', hostname: 'res.cloudinary.com' },
            { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
          ],
        },
      }),
};

export default nextConfig;

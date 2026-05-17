// In the GitHub Pages build the site is served from a sub-path
// (https://<user>.github.io/furor-web/). next/image in `unoptimized`
// static-export mode does NOT prepend basePath to local <img src>, so
// `/photos/x.jpg` 404s. Prefix local asset paths ourselves.
//
// NEXT_PUBLIC_BASE_PATH is set only by the Pages workflow; empty everywhere
// else, so normal dev / server / Vercel builds are unaffected.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBase(path: string): string {
  if (!path) return path;
  // Only prefix root-relative local assets, and never double-prefix.
  if (!path.startsWith('/')) return path;
  if (BASE && path.startsWith(BASE + '/')) return path;
  return `${BASE}${path}`;
}

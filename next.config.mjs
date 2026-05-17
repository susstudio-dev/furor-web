/** @type {import('next').NextConfig} */

// When GH_PAGES=true (CI only) we build a static export of the PUBLIC site for
// GitHub Pages. Admin panel / API / middleware are stripped by the workflow
// before this runs, since they need a server runtime.
const isPages = process.env.GH_PAGES === 'true';

// Project page is served from https://<user>.github.io/furor-web/
const REPO = 'furor-web';

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

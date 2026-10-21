import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

// Set only by the GH Pages workflow — the mirror serves under /furor-web.
const BASE = '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Furor — Dance Hyderabad',
    short_name: 'Furor',
    description:
      'Salsa, Bachata and West Coast Swing classes in Jubilee Hills, Hyderabad.',
    start_url: `${BASE}/`,
    display: 'standalone',
    background_color: '#f7f3ec',
    theme_color: '#f7f3ec',
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      {
        src: `${BASE}/icons/icon-512-maskable.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

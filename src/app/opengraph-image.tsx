import { ImageResponse } from 'next/og';
import { getContent } from '@/lib/content';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Furor — Dance Hyderabad';
export const runtime = 'nodejs';

export default async function OG() {
  const c = await getContent();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background:
            'radial-gradient(800px 600px at 80% -10%, rgba(255,138,76,0.45), transparent 60%), linear-gradient(135deg, #0b0709, #1d1015)',
          color: '#f6efe7',
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 44,
              color: '#ff8a4c',
              border: '4px solid #ff8a4c',
              borderRadius: 12,
            }}
          >
            F
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Furor</div>
            <div style={{ fontSize: 14, letterSpacing: 4, opacity: 0.7 }}>DANCE HYDERABAD</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>
            {c.hero.headline}
          </div>
          <div style={{ marginTop: 24, fontSize: 28, opacity: 0.8, maxWidth: 900 }}>{c.site.tagline}</div>
        </div>
      </div>
    ),
    size,
  );
}

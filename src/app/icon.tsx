import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b0709, #1d1015)',
          color: '#ff8a4c',
          fontSize: 50,
          fontWeight: 900,
          letterSpacing: -3,
          fontFamily: 'system-ui',
        }}
      >
        F
        {/* Gold partner-dot mirroring the brand mark */}
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: '#e6a73a',
          }}
        />
      </div>
    ),
    size,
  );
}

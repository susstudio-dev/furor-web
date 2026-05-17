// Per-style rhythm signature SVGs.
// Salsa: 8-beat clave 3-2 (beats 1, 1.5, 2.5  &  3.5, 4.5)
// Bachata: 1-2-3-tap  (3 strong beats then a hip-tap accent on 4)
// WCS: anchor (slow elastic oscillation)

interface Props {
  style: 'salsa' | 'bachata' | 'west-coast-swing' | string;
  className?: string;
  /** When true, animates continuously; when false, animates once per pointer event. */
  loop?: boolean;
  width?: number;
}

export function RhythmSignature({ style, className, loop = false, width = 200 }: Props) {
  const id = `rs-${style}-${loop ? 'loop' : 'once'}`;
  const groupClass = loop ? 'rs-loop' : 'rs-once';

  return (
    <span className={`inline-block align-middle ${className ?? ''}`} aria-hidden>
      <svg viewBox="0 0 200 40" width={width} height={width * 0.2} role="img">
        <style>
          {`
            @media (prefers-reduced-motion: no-preference) {
              .${id} .rs-dot { transform-origin: center; }
              .${id}.rs-loop .rs-dot { animation: rsPulse 1.6s ease-in-out infinite; }
              .${id}.rs-once .rs-dot { animation: rsPulseOnce 1.4s ease-in-out 1; }
              .${id} .rs-dot:nth-child(1) { animation-delay: 0s; }
              .${id} .rs-dot:nth-child(2) { animation-delay: .12s; }
              .${id} .rs-dot:nth-child(3) { animation-delay: .24s; }
              .${id} .rs-dot:nth-child(4) { animation-delay: .36s; }
              .${id} .rs-dot:nth-child(5) { animation-delay: .48s; }
              .${id} .rs-tap { animation: rsTap 1.4s ease-in-out infinite; }
              .${id} .rs-anchor { animation: rsAnchor 2.4s cubic-bezier(.4,0,.2,1) infinite; transform-origin: 100px 20px; }
              @keyframes rsPulse { 0%,100% { transform: scale(1); opacity: .5 } 30% { transform: scale(1.25); opacity: 1 } }
              @keyframes rsPulseOnce { 0% { transform: scale(.9); opacity: .4 } 60% { transform: scale(1.3); opacity: 1 } 100% { transform: scale(1); opacity: .8 } }
              @keyframes rsTap { 0%,40%,100% { transform: scaleX(1) } 50% { transform: scaleX(1.6) } }
              @keyframes rsAnchor { 0%,100% { transform: translateX(0) } 50% { transform: translateX(8px) } }
            }
          `}
        </style>
        <g className={`${id} ${groupClass}`}>
          {style === 'salsa' ? (
            // 8-beat baseline + 5 clave hits at beats 1, 2.5, 4, 6, 7
            <>
              <line x1="6" y1="20" x2="194" y2="20" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
              {[10, 56, 94, 134, 158].map((cx, i) => (
                <circle key={i} className="rs-dot" cx={cx} cy="20" r="6.5" fill="#ff8a4c" />
              ))}
            </>
          ) : null}
          {style === 'bachata' ? (
            // 4-beat: 3 dots + hip-tap on 4
            <>
              <line x1="6" y1="20" x2="194" y2="20" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
              {[24, 72, 120].map((cx, i) => (
                <circle key={i} className="rs-dot" cx={cx} cy="20" r="6" fill="#ff8a4c" />
              ))}
              <rect className="rs-tap" x="156" y="14" width="22" height="12" rx="6" fill="#e6a73a" />
            </>
          ) : null}
          {style === 'west-coast-swing' ? (
            // Elastic anchor — single big dot oscillating along the line
            <>
              <line x1="6" y1="20" x2="194" y2="20" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
              {[40, 100, 160].map((cx, i) => (
                <circle key={i} cx={cx} cy="20" r="3.5" fill="currentColor" opacity="0.35" />
              ))}
              <g className="rs-anchor">
                <circle cx="100" cy="20" r="9" fill="#ff8a4c" />
                <circle cx="100" cy="20" r="14" fill="none" stroke="#ff8a4c" strokeOpacity="0.4" strokeWidth="1.5" />
              </g>
            </>
          ) : null}
        </g>
      </svg>
    </span>
  );
}

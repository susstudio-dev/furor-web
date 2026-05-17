// Deterministic generative SVG cover, brand palette only, zero network.
// Identical seed → identical render. Different seeds → distinct compositions.

// Theme-aware via CSS variables (defined in globals.css for light & dark),
// so generated covers blend with whichever theme is active.
const PALETTE = {
  ink950: 'var(--art-bg-b)',
  ink800: 'var(--art-bg-a)',
  ember500: 'var(--art-accent)',
  ember700: 'var(--art-accent-2)',
  gold500: 'var(--art-gold)',
  cream: 'var(--art-fg)',
};

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let state = hash(seed);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

interface Props {
  seed: string;
  /** Hint label displayed at the bottom of the cover (e.g. "Salsa", "Jubilee Hills"). */
  label?: string;
  /** Variant index 0..3. If omitted, derived from seed. */
  variant?: 0 | 1 | 2 | 3;
  className?: string;
}

export function PlaceholderArt({ seed, label, variant, className }: Props) {
  const r = rng(seed);
  const v = variant ?? (Math.floor(r() * 4) as 0 | 1 | 2 | 3);
  const accent = r() > 0.5 ? PALETTE.ember500 : PALETTE.gold500;
  const accent2 = r() > 0.5 ? PALETTE.ember700 : PALETTE.ember500;
  const tilt = (r() - 0.5) * 14; // -7..+7 deg
  const shapeId = `pa-${hash(seed).toString(36)}`;

  return (
    <svg
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
      className={className ?? 'w-full h-full'}
      role="img"
      aria-label={label ? `${label} cover art` : 'Cover art'}
    >
      <defs>
        <linearGradient id={`${shapeId}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={PALETTE.ink800} />
          <stop offset="100%" stopColor={PALETTE.ink950} />
        </linearGradient>
        <linearGradient id={`${shapeId}-acc`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={accent2} />
        </linearGradient>
        <radialGradient id={`${shapeId}-glow`} cx="0.5" cy="0.5" r="0.7">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="800" height="1000" fill={`url(#${shapeId}-bg)`} />

      {v === 0 ? (
        // Layered arcs
        <g transform={`rotate(${tilt} 400 500)`}>
          <ellipse cx="400" cy="900" rx="700" ry="500" fill={`url(#${shapeId}-glow)`} />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M ${-100 + i * 60} ${700 - i * 90} Q 400 ${300 - i * 60} ${900 - i * 60} ${720 - i * 90}`}
              stroke={i === 1 ? accent : PALETTE.cream}
              strokeOpacity={i === 1 ? 0.95 : 0.12 - i * 0.02}
              strokeWidth={i === 1 ? 14 : 2}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </g>
      ) : null}

      {v === 1 ? (
        // Kinetic stripes
        <g transform={`rotate(${tilt + 6} 400 500)`}>
          <ellipse cx="400" cy="500" rx="700" ry="500" fill={`url(#${shapeId}-glow)`} />
          {Array.from({ length: 9 }).map((_, i) => {
            const y = 80 + i * 100;
            const w = 720 - Math.abs(i - 4) * 80;
            const isAcc = i === 3 || i === 5;
            return (
              <rect
                key={i}
                x={(800 - w) / 2}
                y={y}
                width={w}
                height={isAcc ? 26 : 6}
                rx={3}
                fill={isAcc ? accent : PALETTE.cream}
                opacity={isAcc ? 1 : 0.18}
              />
            );
          })}
        </g>
      ) : null}

      {v === 2 ? (
        // Orb + cross-fade discs
        <g>
          <ellipse cx="400" cy="500" rx="700" ry="500" fill={`url(#${shapeId}-glow)`} />
          <circle cx="280" cy="380" r="220" fill={`url(#${shapeId}-acc)`} opacity="0.85" />
          <circle cx="520" cy="620" r="180" fill={PALETTE.cream} opacity="0.07" />
          <circle cx="520" cy="620" r="180" fill="none" stroke={PALETTE.cream} strokeOpacity="0.35" strokeWidth="1.5" />
          <circle cx="280" cy="380" r="220" fill="none" stroke={PALETTE.ink950} strokeOpacity="0.5" strokeWidth="2" />
        </g>
      ) : null}

      {v === 3 ? (
        // Type-block — bold initial of label
        <g>
          <ellipse cx="400" cy="900" rx="700" ry="450" fill={`url(#${shapeId}-glow)`} />
          <text
            x="400"
            y="640"
            textAnchor="middle"
            fontFamily="var(--font-display), system-ui, sans-serif"
            fontWeight="900"
            fontSize="780"
            fill={accent}
            opacity="0.85"
            letterSpacing="-40"
          >
            {(label?.[0] || seed[0] || 'F').toUpperCase()}
          </text>
          <line x1="80" y1="860" x2="720" y2="860" stroke={PALETTE.cream} strokeOpacity="0.35" strokeWidth="2" />
        </g>
      ) : null}

      {label ? (
        <text
          x="56"
          y="940"
          fontFamily="var(--font-display), system-ui, sans-serif"
          fontWeight="700"
          fontSize="36"
          fill={PALETTE.cream}
          opacity="0.9"
        >
          {label}
        </text>
      ) : null}
      <text
        x={744}
        y={940}
        textAnchor="end"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontWeight="500"
        fontSize="22"
        fill={PALETTE.cream}
        opacity="0.55"
        letterSpacing="2"
      >
        FUROR
      </text>
    </svg>
  );
}

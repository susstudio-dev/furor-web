// Furor brand mark v3 — solid geometric F with a forward lean.
//
// What changed from v2: dropped the three-ribbon stroke design (it read as a
// smudge at small sizes) in favour of a single solid filled glyph in one solid
// ember color. The whole F leans 8° forward via skewX — the dance step. A
// small offset gold square sits at the upper-right of the F: the partner. No
// gradients on the glyph. No animation by default. Reads as an F at 16px.

interface Props {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function BrandMark({
  size = 36,
  withWordmark = true,
  className,
  ariaLabel = 'Furor — Dance Hyderabad',
}: Props) {
  // Glyph viewBox is 64×64; wordmark sits to the right.
  const totalWidth = withWordmark ? 64 + 14 + 188 : 64;
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`} aria-label={ariaLabel}>
      <svg
        viewBox={`0 0 ${totalWidth} 64`}
        height={size}
        width={(size * totalWidth) / 64}
        role="img"
        aria-hidden
      >
        {/* The F glyph — solid, geometric, with an 8° forward lean (the step) */}
        <g transform="translate(8 0)">
          <g transform="skewX(-8)">
            {/* Solid filled F — single path, sharp edges */}
            <path
              d="M 12 8 H 50 V 18 H 24 V 28 H 44 V 38 H 24 V 56 H 12 Z"
              fill="#ff8a4c"
            />
          </g>
          {/* Gold accent — the partner, offset top-right */}
          <rect x="50" y="6" width="6" height="6" fill="#e6a73a" />
        </g>

        {withWordmark ? (
          <g transform="translate(78 0)">
            {/* "Furor" wordmark — display sans, tight tracking */}
            <text
              x="0"
              y="40"
              fontFamily="var(--font-display), system-ui, sans-serif"
              fontWeight="800"
              fontSize="34"
              letterSpacing="-1.4"
              fill="#f6efe7"
            >
              Furor
            </text>
            {/* Tagline — tracked uppercase, dot separator */}
            <text
              x="2"
              y="55"
              fontFamily="var(--font-sans), system-ui, sans-serif"
              fontWeight="500"
              fontSize="9.5"
              letterSpacing="3.2"
              fill="#f6efe7"
              opacity="0.6"
            >
              DANCE · HYDERABAD
            </text>
          </g>
        ) : null}
      </svg>
    </span>
  );
}

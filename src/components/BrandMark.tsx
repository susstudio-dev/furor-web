import Image from 'next/image';

interface Props {
  size?: number;
  /** Kept for API compatibility — the logo file already includes the wordmark. */
  withWordmark?: boolean;
  className?: string;
  ariaLabel?: string;
}

// Source PNG is ~340×110, ≈ 3.1:1.
const LOGO_RATIO = 340 / 110;

export function BrandMark({
  size = 36,
  className,
  ariaLabel = 'Furor — Dance Hyderabad',
}: Props) {
  const height = size;
  const width = Math.round(size * LOGO_RATIO);
  return (
    <span className={`brand-plate inline-flex items-center ${className ?? ''}`} aria-label={ariaLabel}>
      {/* No `priority`: it emits a preload that competes with the hero's own
          LCP preload for the first connection, for a 14,837 B logo that is
          never the LCP element (spec §7.3 M2). `loading="eager"` on its own
          (without `priority`) keeps it loading immediately — it's visible
          above the fold on first paint — without the head preload. */}
      <Image
        src="/logo-mark.png"
        alt={ariaLabel}
        width={width}
        height={height}
        loading="eager"
        className="h-auto w-auto"
        style={{ height, width: 'auto' }}
      />
    </span>
  );
}

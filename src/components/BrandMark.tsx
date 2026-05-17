import Image from 'next/image';
import { withBase } from '@/lib/base-path';

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
    <span className={`inline-flex items-center ${className ?? ''}`} aria-label={ariaLabel}>
      <Image
        src={withBase('/logo-mark.png')}
        alt={ariaLabel}
        width={width}
        height={height}
        priority
        className="h-auto w-auto"
        style={{ height, width: 'auto' }}
      />
    </span>
  );
}

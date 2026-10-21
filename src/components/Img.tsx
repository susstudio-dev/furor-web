'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PlaceholderArt } from './PlaceholderArt';

interface Props {
  src?: string | null;
  alt: string;
  /** Used to seed placeholder art when src is missing or fails to load. */
  seed: string;
  /** Optional label drawn on the placeholder (e.g. style/branch name). */
  label?: string;
  /** Force a specific placeholder variant (0..3). If omitted, derived from seed. */
  variant?: 0 | 1 | 2 | 3;
  /** Required when used with fill layout's parent — passes through. */
  fill?: boolean;
  // No `sizes`: next.config.mjs sets images.unoptimized, and Next's
  // generateImgAttrs returns before srcSet/sizes reach the element under that
  // flag. A `sizes` prop here is dead weight that reads like responsive
  // loading is happening when it is not (spec §7.1).
  priority?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function Img({
  src,
  alt,
  seed,
  label,
  variant,
  fill,
  priority,
  width,
  height,
  className,
}: Props) {
  const [failed, setFailed] = useState(false);
  const hasReal = typeof src === 'string' && src.length > 0 && !failed;

  if (hasReal) {
    return (
      <Image
        src={src!}
        alt={alt}
        fill={fill}
        priority={priority}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={`photo ${className ?? ''}`.trim()}
        onError={() => setFailed(true)}
      />
    );
  }
  return <PlaceholderArt seed={seed} label={label} variant={variant} className={className} />;
}

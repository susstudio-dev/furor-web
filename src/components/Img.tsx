'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PlaceholderArt } from './PlaceholderArt';
import { withBase } from '@/lib/base-path';

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
  sizes?: string;
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
  sizes,
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
        src={withBase(src!)}
        alt={alt}
        fill={fill}
        sizes={sizes}
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

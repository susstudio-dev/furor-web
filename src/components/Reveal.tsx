'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Choreographed scroll-reveal. Content doesn't just "appear" — it enters the
// way a dancer steps onto a count: a hair of anticipation, then a confident
// settle. Children can be staggered so a group reads as a phrase, not a snap.
//
// Pure CSS does the motion (see .reveal-* in globals.css); this only toggles a
// class when the element first crosses into view. ~1KB, no dependency.
// Fully inert under prefers-reduced-motion (the CSS no-ops the transform).

interface Props {
  children: ReactNode;
  /** ms before this block begins its entrance once in view */
  delay?: number;
  /** when true, each direct child enters in sequence (a danced phrase) */
  stagger?: boolean;
  /** ms between staggered children */
  step?: number;
  className?: string;
  /** entrance direction: 'up' (default) | 'left' | 'right' */
  from?: 'up' | 'left' | 'right';
}

export function Reveal({
  children,
  delay = 0,
  stagger = false,
  step = 90,
  className,
  from = 'up',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // If IntersectionObserver is unavailable, just show it.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={from}
      data-stagger={stagger ? '' : undefined}
      className={`${shown ? 'is-in' : ''} ${className ?? ''}`}
      style={
        {
          '--reveal-delay': `${delay}ms`,
          '--reveal-step': `${step}ms`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

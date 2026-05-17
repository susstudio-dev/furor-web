'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Depth on scroll. The wrapped layer drifts at a fraction of the scroll
// speed so the page reads with foreground/background separation — modern,
// but not scroll-jacking: the page still scrolls 1:1, only this decorative
// layer lags. Transform-only (compositor-friendly), rAF-throttled, a single
// shared scroll listener, and only while the element is near the viewport.
// Fully inert under prefers-reduced-motion.

interface Props {
  children: ReactNode;
  /** how much the layer lags scroll. 0.1 = subtle, 0.35 = pronounced. */
  speed?: number;
  className?: string;
}

export function Parallax({ children, speed = 0.16, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;

    let active = false;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 when the element sits a screen below center, +1 a screen above.
      const center = r.top + r.height / 2;
      const prog = (center - vh / 2) / (vh / 2 + r.height / 2);
      el.style.transform = `translate3d(0, ${(-prog * speed * 100).toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (active && !raf) raf = requestAnimationFrame(update);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          active = e.isIntersecting;
          if (active && !raf) raf = requestAnimationFrame(update);
        }
      },
      { rootMargin: '160px 0px' },
    );
    io.observe(el);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

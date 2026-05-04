'use client';

import { useEffect, useRef, useState } from 'react';

export function LiveCounter({ value, label }: { value: number; label: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setN(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const dur = 1500;
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / dur);
              const eased = 1 - Math.pow(1 - t, 3);
              setN(Math.round(value * eased));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [value]);

  return (
    <section ref={ref} className="container-x py-20 sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <p
          className="display text-7xl font-extrabold tracking-tight sm:text-8xl"
          aria-live="polite"
        >
          <span className="bg-gradient-to-br from-ember-400 via-ember-500 to-gold-500 bg-clip-text text-transparent">
            {new Intl.NumberFormat('en-IN').format(n)}
          </span>
        </p>
        <p className="mt-4 text-lg text-cream/70">{label}</p>
      </div>
    </section>
  );
}

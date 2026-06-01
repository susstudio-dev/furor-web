'use client';

import { Img } from './Img';

interface Photo {
  src: string;
  alt: string;
}

// A continuously scrolling, infinitely-looping photo strip. The track holds the
// photos twice and slides by exactly one set (-50%), so the loop is seamless.
// Each item carries its own right margin (instead of a flex `gap`) so the half
// width lands on a clean boundary — no jump at the wrap. Pauses on hover and is
// fully still under prefers-reduced-motion.
export function PhotoCarousel({
  photos,
  /** seconds for one full loop — higher = slower */
  speed = 45,
}: {
  photos: Photo[];
  speed?: number;
}) {
  if (!photos.length) return null;
  const loop = [...photos, ...photos];

  return (
    <div className="marquee group relative overflow-hidden">
      <div className="marquee-track flex w-max" style={{ animationDuration: `${speed}s` }}>
        {loop.map((p, i) => (
          <div
            key={i}
            className="group/card relative mr-5 h-72 w-[20rem] shrink-0 overflow-hidden rounded-3xl border border-cream/10 shadow-lg shadow-ink-950/40 sm:h-[24rem] sm:w-[27rem] lg:h-[28rem] lg:w-[32rem]"
          >
            <Img
              src={p.src}
              alt={p.alt}
              seed={`carousel-${i}`}
              fill
              sizes="(min-width: 1024px) 512px, (min-width: 640px) 432px, 320px"
              className="object-cover object-center transition-transform duration-700 group-hover/card:scale-105"
            />
            {/* subtle bottom vignette for depth */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-950/50 to-transparent" />
          </div>
        ))}
      </div>

      <style>{`
        .marquee-track {
          animation-name: furor-marquee;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .marquee:hover .marquee-track { animation-play-state: paused; }
        @keyframes furor-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; }
        }
      `}</style>
    </div>
  );
}

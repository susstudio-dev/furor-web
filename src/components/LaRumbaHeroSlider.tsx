'use client';

import { useEffect, useRef, useState } from 'react';
import { Img } from './Img';
import { advanceIndex, SLIDE_HOLD_MS, type Slide } from '@/lib/hero-slides';

// The hero's cross-fading backdrop. The page's message — headline, facts line
// and CTA — deliberately lives OUTSIDE this component and never moves: a
// visitor who lands mid-rotation must still meet one headline and one ask.
// Rotating the offer is how carousels lose conversions.
//
// Mounted only when `needsSlider()` says so, so an untouched page ships none
// of this.
//
// Props are plain data, never a slice of SiteContent — a value import of the
// schema here would put zod in every route's bundle (client-bundle.test.ts).
export function LaRumbaHeroSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  // Auto-advance ends permanently on the first manual interaction. Something
  // that starts moving again under the visitor's cursor after they took
  // control is hostile.
  const [auto, setAuto] = useState(true);
  // Two INDEPENDENT reasons to hold: off-screen, and backgrounded tab. Kept as
  // separate flags rather than one, because a single flag forces each source to
  // guess the other's state — the version of this that asked
  // getBoundingClientRect() inside the visibilitychange handler would fight the
  // observer and settle on whichever fired last.
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  // A clip that will not load must not stall the slider forever; it falls
  // through to the normal timer.
  const [videoFailed, setVideoFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Under prefers-reduced-motion nothing advances on its own. The rest of this
  // codebase already honours the setting (the magnetic and spotlight effects
  // do); the slider matches rather than inventing its own policy.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Off-screen, nothing ticks and no clip plays.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Backgrounded, likewise. A muted clip looping in a tab nobody is looking at
  // is a real battery complaint, not a hypothetical one.
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const current = slides[index];
  const isVideo = current?.kind === 'video' && !videoFailed;

  // One predicate, three independent brakes. NOTE it does not include the
  // slide count: a lone video slide still has to play, it simply never
  // advances to anything.
  const canAuto = auto && inView && tabVisible && !reduced;

  // Image slides hold on a timer. Video slides do not — they advance from
  // their own `ended` event below, so a shot is never cut mid-movement.
  useEffect(() => {
    if (!canAuto || isVideo || slides.length <= 1) return;
    const t = setTimeout(() => setIndex((i) => advanceIndex(i, slides.length)), SLIDE_HOLD_MS);
    return () => clearTimeout(t);
  }, [canAuto, isVideo, index, slides.length]);

  // A new slide gets a clean slate: a clip that failed last time may simply
  // have been a flaky network, and one bad load must not permanently demote
  // every later video to the image timer.
  useEffect(() => {
    setVideoFailed(false);
    const v = videoRef.current;
    if (v) v.currentTime = 0;
  }, [index]);

  // Drive the active clip explicitly. The `autoplay` attribute alone would
  // also start slides that are off-screen, backgrounded, or not current.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (canAuto) {
      void v.play().catch(() => setVideoFailed(true));
    } else {
      v.pause();
    }
    // Cleanup captures THIS element, so when `index` moves on — after React has
    // already pointed videoRef at the new slide — the clip we actually started
    // is the one we stop. Without this the outgoing video plays on, invisible.
    return () => {
      v.pause();
    };
  }, [index, canAuto]);

  function goTo(i: number) {
    setAuto(false);
    setIndex(i);
  }

  return (
    <div ref={rootRef} className="absolute inset-0" aria-roledescription="carousel" aria-label="La Rumba photographs">
      {slides.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={i !== index}
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${slides.length}`}
        >
          {s.kind === 'image' ? (
            <Img
              src={s.src}
              alt={s.alt}
              seed={`la-rumba-hero-${i}`}
              fill
              // Only the first slide is the LCP candidate. Making them all
              // eager would fetch every photo before the page is usable.
              priority={i === 0}
              className="object-cover"
            />
          ) : (
            <video
              ref={i === index ? videoRef : undefined}
              muted
              playsInline
              // No `loop`: a looping clip never fires `ended`, so the slider
              // would stop on the first video forever.
              preload={i === index ? 'auto' : 'none'}
              poster={s.posterSrc || undefined}
              aria-label={s.posterAlt || undefined}
              className="h-full w-full object-cover"
              onEnded={() => {
                // Only the visible slide may advance the slider. A clip that is
                // no longer current must not move the page under the visitor.
                if (i !== index) return;
                setIndex((c) => advanceIndex(c, slides.length));
              }}
              onError={() => setVideoFailed(true)}
            >
              {s.webmUrl ? <source src={s.webmUrl} type="video/webm" /> : null}
              {s.mp4Url ? <source src={s.mp4Url} type="video/mp4" /> : null}
            </video>
          )}
        </div>
      ))}

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-5 z-10 flex items-center justify-center gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show slide ${i + 1} of ${slides.length}`}
              aria-current={i === index}
              // 44px target with a small visible dot inside it — the hit-area
              // size the rest of this codebase uses.
              className="inline-flex h-11 w-11 items-center justify-center"
            >
              <span
                className={`block h-2 w-2 rounded-full transition ${
                  i === index ? 'bg-cream' : 'bg-cream/40'
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

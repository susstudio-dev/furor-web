'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { EnquiryCTA } from './EnquiryCTA';
import { Img } from './Img';
import { CinematicHeadline } from './CinematicHeadline';

export function Hero({ content }: { content: SiteContent }) {
  const [allowVideo, setAllowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    const slow = conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';
    if (!reduced && !slow && (content.hero.videoMp4Url || content.hero.videoWebmUrl)) {
      setAllowVideo(true);
    }
  }, [content.hero.videoMp4Url, content.hero.videoWebmUrl]);

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="relative h-full w-full">
          <Img
            src={content.hero.posterImage}
            alt=""
            seed="hero"
            label=""
            fill
            priority
            sizes="100vw"
            // On portrait phones the subject sits hard right so it's not
            // permanently buried under the text block.
            className="object-cover object-[78%_38%] sm:object-[center_30%] animate-kenburns"
          />
          {allowVideo ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              poster={content.hero.posterImage}
            >
              {content.hero.videoWebmUrl ? <source src={content.hero.videoWebmUrl} type="video/webm" /> : null}
              {content.hero.videoMp4Url ? <source src={content.hero.videoMp4Url} type="video/mp4" /> : null}
            </video>
          ) : null}
          <div className="absolute inset-0 hero-scrim-x" />
          <div className="absolute inset-0 hero-scrim-y" />
          {/* film vignette — dark theme only (a dark vignette on the light
              theme just dirties the page edges) */}
          <div className="pointer-events-none absolute inset-0 hero-vignette" />
        </div>
      </div>
      {/* Follow-light: a warm pool that tracks the cursor across the hero
          like a moving stage light. Fine pointers only; never hides the
          cursor. The .lit class + position are set by HeroSpotlight. */}
      <div ref={spotRef} className="spotlight" aria-hidden />
      {/* NB: no max-w override here. Whatever width container-x defines IS the
          site grid — the header, the QuickEnroll card and every section below
          sit on it, so the headline has to as well or the hero reads as a
          different page.
          Bottom padding must exceed QuickEnroll's negative top margin (-mt-20 /
          sm:-mt-28) so the card overlaps empty space, not the scroll cue. */}
      {/* Top padding is deliberately shallow: every pixel here pushes the
          booking card further under the fold. The card's peek is the hero's
          real call to action, so the content block sits high and the reserved
          bottom padding (which the card overlaps) stays generous. */}
      {/* Bottom padding minus QuickEnroll's pull-up (-mt-24/-mt-32/-mt-36)
          leaves a constant 48px of clear air between the hero CTAs and the
          card edge at every breakpoint — enough for the card to peek without
          crowding the buttons above it. */}
      <div className="container-x relative z-10 pt-8 pb-36 sm:pt-10 sm:pb-44 lg:pt-12 lg:pb-48">
        {/* The count-in every dancer knows — 5, 6, 7, 8 — then the words move
            on 1. Pure CSS, on tempo; collapses to nothing on reduced motion. */}
        <p
          aria-hidden
          className="count-in display text-sm font-bold uppercase tracking-[0.4em] text-ember-400 mb-3"
        >
          <span>5</span>
          <span>6</span>
          <span>7</span>
          <span>8</span>
        </p>
        <p className="pill bg-ember-500/15 text-ember-400 hero-fade" style={{ animationDelay: '60ms' }}>
          India&apos;s largest Latin dance school
        </p>
        <h1 className="mt-5 display text-[2.4rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl max-w-[18ch] sm:max-w-4xl">
          <CinematicHeadline text={content.hero.headline} />
        </h1>
        <p
          className="mt-6 max-w-2xl text-lg text-cream/80 sm:text-xl hero-fade"
          style={{ animationDelay: '0.95s' }}
        >
          {content.hero.subHeadline}
        </p>
        <div
          className="mt-8 flex flex-wrap items-center gap-3 hero-fade"
          style={{ animationDelay: '1.15s' }}
        >
          <EnquiryCTA
            whatsappNumber={content.site.whatsappNumber}
            instagramHandle={content.site.instagramHandle}
            ctx={{ source: 'primary' }}
            variant="primary"
            label="Chat on WhatsApp"
            className="magnetic"
          />
          <Link href="/batches" className="btn-secondary magnetic">
            See batches
          </Link>
        </div>
        {/* No scroll cue here: the QuickEnroll card overlaps this space and its
            lit top edge + "Booking open" pulse already pull the eye down. A
            text link pointing at the card that covers it was two cues fighting
            for the same job — and the card won by sitting on top of it. */}
      </div>
      {/* Magnetic CTA: enabled by ScriptOnFinePointer mounted in app layout via children */}
      <MagneticInit />
      <HeroSpotlight target={spotRef} />
    </section>
  );
}

// Moves the warm follow-light with the cursor while it's over the hero.
// Fine pointers only (touch users get nothing extra — and no listener).
// rAF-throttled, passive, single listener; the cursor is never hidden.
function HeroSpotlight({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const el = target.current;
    if (!el) return;
    const section = el.closest('section');
    if (!section) return;

    let raf = 0;
    let nx = 50;
    let ny = 40;
    const apply = () => {
      raf = 0;
      el.style.setProperty('--sx', `${nx}%`);
      el.style.setProperty('--sy', `${ny}%`);
    };
    const onMove = (e: MouseEvent) => {
      const r = section.getBoundingClientRect();
      nx = ((e.clientX - r.left) / r.width) * 100;
      ny = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onEnter = () => el.classList.add('lit');
    const onLeave = () => el.classList.remove('lit');

    section.addEventListener('mousemove', onMove, { passive: true });
    section.addEventListener('mouseenter', onEnter);
    section.addEventListener('mouseleave', onLeave);
    return () => {
      section.removeEventListener('mousemove', onMove);
      section.removeEventListener('mouseenter', onEnter);
      section.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target]);
  return null;
}

function MagneticInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('.magnetic'));
    const onMove = (e: MouseEvent) => {
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const radius = 80;
        if (dist < radius) {
          const factor = (1 - dist / radius) * 0.25;
          el.style.transform = `translate(${dx * factor}px, ${dy * factor}px)`;
        } else {
          el.style.transform = '';
        }
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      for (const el of targets) el.style.transform = '';
    };
  }, []);
  return null;
}

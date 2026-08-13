'use client';

import { useEffect, useRef, useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { visibleBatches } from '@/lib/content-helpers';
import { formatInr } from '@/lib/format';
import { EnquiryCTA } from './EnquiryCTA';
import { Img } from './Img';
import { CinematicHeadline } from './CinematicHeadline';
import { bookLabel } from '@/lib/book-label';
import { label } from '@/lib/labels';
import { HERO_POSTER_ALT_DEFAULT } from '@/lib/hero-defaults';
import type { HeroPoster } from '@/lib/image-variants';

export function Hero({ content, poster }: { content: SiteContent; poster: HeroPoster | null }) {
  const [allowVideo, setAllowVideo] = useState(false);
  // The trial price comes from live batch data, never a hardcoded string —
  // if the studio changes the token in the admin, every button follows.
  const bookable = visibleBatches(content);
  const trialFrom = bookable.length
    ? Math.min(...bookable.map((b) => b.reservationInr))
    : null;
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
          {poster ? (
            <>
              {/* The LCP preload <link>s live in page.tsx, not here. This
                  component is 'use client', and a hand-written <link> only
                  hoists into <head> when it carries a real string `href`
                  (react-dom's SSR renderer checks `typeof props.href ===
                  'string'` before treating it as a Resource) — the earlier
                  imageSrcSet-only version of this tag rendered here had no
                  `href` and sat inert in <body>, after the element it was
                  meant to preload. page.tsx already computes `poster` to
                  pass down as a prop, so the two preload tags render there
                  instead, each with `href` set to the JPEG fallback URL. */}
              {/* Order is load-bearing: a browser takes the FIRST <source>
                  whose media and type it supports, and the <img> is the last
                  resort — so every <source> must precede it, media-constrained
                  ones first. The portrait crop exists because the render box is
                  375x690 CSS px (aspect 0.543) against a 1.498 source:
                  object-cover throws away 63.7% of the width, and a
                  purpose-built crop stops paying for pixels never on screen. */}
              <picture>
                <source media="(min-width: 640px)" type="image/avif" srcSet={poster.landscape.avif} sizes="100vw" />
                <source media="(min-width: 640px)" type="image/webp" srcSet={poster.landscape.webp} sizes="100vw" />
                <source media="(min-width: 640px)" srcSet={poster.landscape.jpg} sizes="100vw" />
                <source type="image/avif" srcSet={poster.portrait.avif} sizes="100vw" />
                <source type="image/webp" srcSet={poster.portrait.webp} sizes="100vw" />
                <img
                  src={poster.portrait.jpgSrc}
                  srcSet={poster.portrait.jpg}
                  sizes="100vw"
                  // Not decorative: this is the one photo that shows a visitor
                  // what a Furor night actually looks like, so it gets a real
                  // description rather than the alt="" that an audit flagged
                  // as missing text. Editable at /admin/hero; a blank field
                  // falls back to the shipped default rather than rendering
                  // alt="" — clearing the field must not silently turn this
                  // back into a decorative image. Reads the editable field,
                  // never a local constant only.
                  alt={content.hero.posterAlt.trim() !== '' ? content.hero.posterAlt : HERO_POSTER_ALT_DEFAULT}
                  fetchPriority="high"
                  decoding="async"
                  // No width/height: the parent is absolute inset-0 and CSS
                  // sizes both axes, so the intrinsic ratio never reaches
                  // layout and a landscape source cannot shift anything.
                  // On portrait phones the subject sits hard right so it is not
                  // permanently buried under the text block.
                  className="photo absolute inset-0 h-full w-full object-cover object-[78%_38%] sm:object-[center_30%] animate-kenburns"
                />
              </picture>
            </>
          ) : (
            // The poster was replaced in the admin and `npm run build:images`
            // has not been re-run. Serve the raw upload rather than nothing.
            <Img
              src={content.hero.posterImage}
              alt={content.hero.posterAlt.trim() !== '' ? content.hero.posterAlt : HERO_POSTER_ALT_DEFAULT}
              seed="hero"
              label=""
              fill
              priority
              className="object-cover object-[78%_38%] sm:object-[center_30%] animate-kenburns"
            />
          )}
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
      {/* Bottom padding minus QuickEnroll's pull-up (-mt-24/-mt-32/-mt-36).
          Deliberately NOT constant across breakpoints any more: at sm+ it
          still leaves 48px of clear air between the hero CTAs and the card
          edge, but on a phone the base pad drops to pb-28 so the clear air is
          16px and the board's top edge climbs 32px up a 667px viewport. The
          board is the conversion surface and it starts below the fold — 32px
          of card peeking beats 32px of empty space. */}
      <div className="container-x relative z-10 pt-8 pb-28 sm:pt-10 sm:pb-44 lg:pt-12 lg:pb-48">
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
          className="mt-4 max-w-2xl text-lg text-cream/80 sm:text-xl hero-fade"
          style={{ animationDelay: '0.95s' }}
        >
          {content.hero.subHeadline}
        </p>
        {/* One filled action per viewport (attention ratio): the paid trial is
            the primary, WhatsApp demotes to link weight beside it, and the old
            "See batches" button is gone — the booking board this button anchors
            to already links there. The .downbeat class fires the button's
            one-shot accent at the exact moment the count-in above resolves. */}
        <div className="mt-6 hero-fade" style={{ animationDelay: '1.15s' }}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href="#start-this-week" className="btn-primary magnetic downbeat">
              {bookLabel('Foundation', content.labels)}
              {trialFrom != null ? ` · ${formatInr(trialFrom)}` : ''}
            </a>
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary' }}
              variant="link"
              labels={content.labels}
              templates={content.site.whatsappTemplates}
              label={label(content.labels, 'ctaChatFirstWhatsapp')}
            />
          </div>
          {/* No refund promise here: the trial fee is non-refundable
              (owner, 2026-08-08). The reassurance is the small commitment
              itself — one class, not a package — not money back. */}
          <p className="mt-2.5 text-sm text-cream/65">
            One real class. No partner needed. You decide.
          </p>
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

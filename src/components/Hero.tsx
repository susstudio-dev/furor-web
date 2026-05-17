'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { EnquiryCTA } from './EnquiryCTA';
import { Img } from './Img';
import { Accentuate } from './Accentuate';

export function Hero({ content }: { content: SiteContent }) {
  const [allowVideo, setAllowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
            className="object-cover object-[center_30%] animate-kenburns"
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
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/45 to-transparent" />
        </div>
      </div>
      <div className="container-x py-24 sm:py-32 lg:py-40">
        <p className="pill bg-ember-500/15 text-ember-400">India's largest Latin dance school</p>
        <h1 className="mt-6 display text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl max-w-4xl">
          <Accentuate text={content.hero.headline} />
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-cream/80 sm:text-xl">{content.hero.subHeadline}</p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
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
      </div>
      {/* Magnetic CTA: enabled by ScriptOnFinePointer mounted in app layout via children */}
      <MagneticInit />
    </section>
  );
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

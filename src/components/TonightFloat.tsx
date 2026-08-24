'use client';

import { useEffect, useState } from 'react';
import { EnquiryCTA } from './EnquiryCTA';
import type { SiteContent } from '@/lib/content-schema';

// The weekly social (La Rumba), floating over the hero instead of owning a
// full-width section mid-page. The owner asked for exactly this: the social
// stays visible without adding a scroll-stop, and a visitor who isn't
// interested can close it.
//
// Dismissal is per-VISIT (sessionStorage), deliberately not per-browser: the
// social runs every Saturday, so a chip closed in June must not still be gone
// in August. The schema.org Event node is emitted separately in page.tsx, so
// closing (or never mounting) this chip costs nothing in search.
//
// Renders nothing until mounted: the server can't know this visit's dismissal
// state, and the hero's own choreography runs ~1.2s anyway — the chip fading
// in after it is sequencing, not lag.
// Desktop-only since 2026-08-24; phones meet La Rumba in the home RumbaBand.
const DISMISS_KEY = 'tonight-float-dismissed';

export function TonightFloat({ content }: { content: SiteContent }) {
  const t = content.tonight;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) !== '1') setVisible(true);
    } catch {
      // Storage blocked (private mode policies etc.) — show it; worst case a
      // dismissal doesn't stick for this visit.
      setVisible(true);
    }
  }, []);

  if (!t.enabled || !t.headline || !t.when || !visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Already hidden for this render; nothing more to do.
    }
  }

  // Desktop-only: below lg the chip landed on top of the hero badge and
  // headline on every phone — the primary audience. Mobile gets La Rumba
  // as the in-flow RumbaBand section instead (two front doors, spec §3.1).
  return (
    <div className="tonight-float hidden lg:block absolute right-6 top-6 z-20 w-[17rem]">
      <div className="relative overflow-clip rounded-2xl border border-ember-500/40 bg-ink-900/85 p-4 shadow-xl shadow-ink-950/40 backdrop-blur">
        <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-ember-500/25 blur-2xl" />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide this"
          className="absolute right-0.5 top-0.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-cream/50 transition hover:bg-cream/10 hover:text-cream"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-ember-400">
          <span className="relative flex h-2 w-2">
            <span className="beat-ring absolute inset-0 rounded-full bg-ember-500/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ember-500" />
          </span>
          Live · {t.when}
        </p>
        <p className="mt-1.5 pr-5 display text-base font-extrabold leading-snug">{t.headline}</p>
        <div className="mt-2.5">
          <EnquiryCTA
            whatsappNumber={content.site.whatsappNumber}
            ctx={{ source: 'primary', customNote: t.ctaContext }}
            variant="batch-row"
            labels={content.labels}
            templates={content.site.whatsappTemplates}
            label={t.ctaLabel || 'WhatsApp to RSVP'}
          />
        </div>
      </div>
    </div>
  );
}

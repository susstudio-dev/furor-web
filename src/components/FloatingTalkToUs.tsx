'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EnquiryCTA } from './EnquiryCTA';
import type { EnquiryContext } from '@/lib/enquiry';

export function FloatingTalkToUs({
  whatsappNumber,
  instagramHandle,
}: {
  whatsappNumber: string;
  instagramHandle: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Hide the floating button inside /admin. This must come AFTER every hook
  // call — an early return before a hook breaks the Rules of Hooks (the
  // hook order changes between admin and non-admin routes).
  if (pathname.startsWith('/admin')) return null;

  // Derive minimal context from the path; pages can override by placing inline EnquiryCTA buttons.
  const ctx: EnquiryContext = { source: 'floating' };

  return (
    <>
      {open ? (
        <button
          aria-label="Close"
          className="fixed inset-0 z-40 bg-ink-950/40"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {open ? (
          <div className="w-[min(20rem,calc(100vw-2.5rem))] rounded-3xl border border-cream/10 bg-ink-900/95 p-4 shadow-2xl backdrop-blur animate-fade-up">
            <p className="display text-sm uppercase tracking-widest text-cream/60">Talk to us</p>
            <p className="mt-1 text-cream/90 text-sm">
              We answer in minutes during studio hours.
            </p>
            <div className="mt-4 grid gap-2">
              <EnquiryCTA
                whatsappNumber={whatsappNumber}
                ctx={ctx}
                channel="whatsapp"
                variant="primary"
                label="Chat on WhatsApp"
                className="w-full"
              />
              <EnquiryCTA
                whatsappNumber={whatsappNumber}
                instagramHandle={instagramHandle}
                ctx={ctx}
                channel="instagram"
                variant="secondary"
                label="DM on Instagram"
                className="w-full"
              />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group relative flex h-10 min-w-[2.5rem] items-center justify-center gap-1.5 rounded-full bg-ember-500 px-3.5 text-cream text-sm font-semibold shadow-lg shadow-ember-500/20 transition hover:bg-ember-600 active:scale-95"
          aria-expanded={open}
          aria-label={open ? 'Close talk to us' : 'Open talk to us'}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-cream/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cream" />
          </span>
          <span className="hidden sm:inline">Talk to us</span>
        </button>
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EnquiryCTA } from './EnquiryCTA';
import type { EnquiryContext } from '@/lib/enquiry';
import { label, type Labels } from '@/lib/labels';

export function FloatingTalkToUs({
  whatsappNumber,
  instagramHandle,
  labels,
}: {
  whatsappNumber: string;
  instagramHandle: string;
  labels: Labels;
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
          aria-label={label(labels, 'ariaClose')}
          className="fixed inset-0 z-40 bg-ink-950/40"
          onClick={() => setOpen(false)}
        />
      ) : null}
      {/* On the home route the mobile StickyTrialBar owns the bottom edge —
          two floating elements stacking on a phone reads as broken. Hidden
          below sm there; everywhere else (and on desktop) unchanged. */}
      <div
        className={`fixed bottom-5 right-5 z-50 flex-col items-end gap-3 sm:bottom-6 sm:right-6 ${
          pathname === '/' ? 'hidden sm:flex' : 'flex'
        }`}
      >
        {open ? (
          <div className="w-[min(20rem,calc(100vw-2.5rem))] rounded-3xl border border-cream/10 bg-ink-900/95 p-4 shadow-2xl backdrop-blur animate-fade-up">
            <p className="display text-sm uppercase tracking-widest text-cream/60">
              {label(labels, 'ctaTalkToUs')}
            </p>
            <p className="mt-1 text-cream/90 text-sm">
              We answer in minutes during studio hours.
            </p>
            <div className="mt-4 grid gap-2">
              <EnquiryCTA
                whatsappNumber={whatsappNumber}
                ctx={ctx}
                channel="whatsapp"
                variant="primary"
                labels={labels}
                className="w-full"
              />
              <EnquiryCTA
                whatsappNumber={whatsappNumber}
                instagramHandle={instagramHandle}
                ctx={ctx}
                channel="instagram"
                variant="secondary"
                labels={labels}
                className="w-full"
              />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group relative flex h-11 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-full bg-ember-600 px-4 text-on-ember text-sm font-semibold shadow-lg shadow-ember-700/25 transition hover:bg-ember-700 active:scale-95"
          aria-expanded={open}
          aria-label={open ? label(labels, 'ariaCloseTalkToUs') : label(labels, 'ariaOpenTalkToUs')}
        >
          <span className="relative flex h-2 w-2">
            <span className="beat-ring absolute inset-0 rounded-full bg-on-ember/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-on-ember" />
          </span>
          <span className="hidden sm:inline">{label(labels, 'ctaTalkToUs')}</span>
        </button>
      </div>
    </>
  );
}

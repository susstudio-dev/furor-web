'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { publicPathForAdminPath } from '@/lib/admin-preview-path';

// A tab clinging to the right edge of every authenticated admin screen. Click
// it and the published public site slides in from the right, opened to the
// page that matches the editor you are on.
//
// It shows PUBLISHED content — not what you are currently typing. Unsaved
// edits live in localStorage (see autosave.ts) and saved ones become drafts,
// so neither reaches a server render. Draft review is a different screen
// (/admin/drafts/[id]/review), which overlays a specific draft.
//
// The iframe only works because next.config.mjs relaxes the framing headers to
// SAMEORIGIN / frame-ancestors 'self' when the furor_admin cookie is present.
// If that rule ever stops applying the frame goes blank, which is why "Open in
// new tab" is always in the header — the feature degrades to a link instead of
// an unexplained empty box.

export function SitePreviewDrawer() {
  const pathname = usePathname() || '/admin';
  const [open, setOpen] = useState(false);
  const target = publicPathForAdminPath(pathname);

  const close = useCallback(() => setOpen(false), []);

  // Escape closes, matching AdminNav's drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Don't let the editor scroll behind the drawer.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {/* z-[35] is deliberate: above SaveBar (sticky, z-30) so the handle is
          never buried, below AdminNav's mobile drawer (z-40) so the menu still
          covers it on a phone. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="View the live site"
        title="View the live site"
        className="fixed right-0 top-1/2 z-[35] flex -translate-y-1/2 items-center gap-2 rounded-l-xl border border-r-0 border-cream/15 bg-ink-900/95 py-4 pl-3 pr-2.5 text-cream/80 shadow-lg backdrop-blur transition hover:border-ember-400/50 hover:text-cream"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span className="hidden text-[10px] uppercase tracking-widest [writing-mode:vertical-rl] sm:inline">
          View site
        </span>
      </button>

      {/* Kept mounted so the slide is a pure CSS transition with no timers.
          `inert` when closed removes the whole subtree from focus and the
          accessibility tree, so nothing here is tabbable behind the editor. */}
      <div
        className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
        inert={!open}
      >
        <button
          type="button"
          aria-label="Close site preview"
          onClick={close}
          className={`absolute inset-0 bg-ink-950/70 transition-opacity duration-200 motion-reduce:transition-none ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          role="dialog"
          aria-modal={open}
          aria-label="Live site preview"
          className={`absolute inset-y-0 right-0 flex w-[min(35rem,100vw)] flex-col border-l border-cream/10 bg-ink-900 shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-cream/10 px-4 py-3">
            <span className="display text-xs uppercase tracking-widest text-cream/50">Live site</span>
            <code className="min-w-0 flex-1 truncate rounded bg-cream/5 px-2 py-1 text-xs text-cream/80">
              {target}
            </code>
            <a
              href={target}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs text-ember-400 transition hover:text-ember-300"
            >
              Open in new tab ↗
            </a>
            <button
              type="button"
              onClick={close}
              aria-label="Close site preview"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cream/15 text-cream/85 transition hover:border-cream/40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* Mounted only while open: nothing loads in the background, and
              every reopen is a fresh fetch rather than a stale render. */}
          <div className="min-h-0 flex-1 bg-ink-950">
            {open ? (
              <iframe
                src={target}
                title="Live site preview"
                className="h-full w-full border-0"
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The admin navigation. Desktop keeps the fixed sidebar; below lg it becomes
// a hamburger + slide-over drawer — previously the full ~25-row nav rendered
// ABOVE the content on every phone screen, so reaching any editor meant
// scrolling past the entire menu first.

export interface AdminNavItem {
  label: string;
  href: string;
  groupHeader?: boolean;
}

export function AdminNav({ items, signedInAs }: { items: AdminNavItem[]; signedInAs: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/admin';

  // Close the drawer on navigation and on Escape.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nav = (
    <nav className="grid gap-1 px-3 pb-6">
      {items.map((n) => {
        if (n.groupHeader) {
          if (n.href === '#') {
            return (
              <p key={n.label} className="mt-3 px-3 py-1 text-[10px] uppercase tracking-widest text-cream/40">
                {n.label}
              </p>
            );
          }
          return (
            <Link
              key={n.href}
              href={n.href}
              className="mt-3 rounded-xl px-3 py-2 text-[10px] uppercase tracking-widest text-cream/50 hover:text-ember-400"
            >
              {n.label}
            </Link>
          );
        }
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={`min-h-[44px] content-center whitespace-pre rounded-xl px-3 py-2 text-sm transition ${
              active
                ? 'bg-ember-500/15 text-ember-400'
                : 'text-cream/80 hover:bg-cream/5 hover:text-cream'
            }`}
          >
            {n.label}
          </Link>
        );
      })}
      <form action="/api/admin/logout" method="post" className="mt-4 px-3">
        <button className="min-h-[44px] text-xs text-cream/50 hover:text-cream/80">Sign out</button>
      </form>
      <Link href="/" className="mt-2 min-h-[44px] content-center px-3 text-xs text-cream/50 hover:text-cream/80">
        ← Back to public site
      </Link>
    </nav>
  );

  const brand = (
    <div className="p-5">
      <Link href="/admin" className="display text-lg font-extrabold">
        <span className="text-ember-500">Furor</span> admin
      </Link>
      <p className="mt-1 text-xs text-cream/50">{signedInAs}</p>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-cream/10 bg-ink-950/95 px-4 py-3 lg:hidden">
        <Link href="/admin" className="display font-extrabold">
          <span className="text-ember-500">Furor</span> admin
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
          className="grid h-11 w-11 place-items-center rounded-xl border border-cream/15 text-cream/85"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink-950/60" />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] overflow-y-auto border-r border-cream/10 bg-ink-900 pb-[env(safe-area-inset-bottom)]">
            {brand}
            {nav}
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:min-h-screen lg:w-64 lg:border-r border-cream/10 bg-ink-900/40">
        {brand}
        {nav}
      </aside>
    </>
  );
}

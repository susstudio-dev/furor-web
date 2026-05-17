'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { BrandMark } from './BrandMark';
import { ThemeToggle } from './ThemeToggle';

const NAV: { label: string; href: string; children?: { label: string; href: string }[] }[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Dance Styles', href: '/dance-styles' },
  { label: 'Instructors', href: '/instructors' },
  { label: 'Batches & Pricing', href: '/batches' },
  { label: 'Blog', href: '/stories' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Contact', href: '/contact' },
];

export function Header({ content }: { content: SiteContent }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navWithDropdowns = NAV.map((item) => {
    if (item.label === 'Dance Styles') {
      return {
        ...item,
        children: content.danceStyles
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((s) => ({ label: s.name, href: `/dance-styles/${s.slug}` })),
      };
    }
    return item;
  });

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${
        scrolled ? 'bg-ink-950/85 backdrop-blur border-b border-cream/10' : 'bg-transparent'
      }`}
    >
      <div className="container-x flex h-16 items-center gap-3">
        <Link href="/" aria-label="Furor — Dance Hyderabad home" className="shrink-0">
          <BrandMark size={52} />
        </Link>
        <nav
          className="hidden lg:flex flex-1 items-center justify-center gap-1"
          aria-label="Primary"
        >
          {navWithDropdowns.map((item) => (
            <div key={item.label} className="group relative">
              <Link href={item.href} className="btn-ghost">
                {item.label}
                {item.children ? <Caret /> : null}
              </Link>
              {item.children ? (
                <div className="invisible absolute left-1/2 top-full -translate-x-1/2 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                  <div className="min-w-[12rem] rounded-2xl border border-cream/10 bg-ink-900/95 p-2 shadow-xl backdrop-blur">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className="block rounded-xl px-3 py-2 text-sm text-cream/80 transition hover:bg-cream/5 hover:text-cream"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="ml-auto lg:ml-0 flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <button
            type="button"
            className="lg:hidden btn-ghost p-2"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <Burger open={open} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="lg:hidden border-t border-cream/10 bg-ink-950/95 backdrop-blur">
          <div className="container-x py-4 space-y-1">
            {navWithDropdowns.map((item) => (
              <div key={item.label} className="border-b border-cream/5 last:border-0">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-base font-medium text-cream"
                >
                  {item.label}
                </Link>
                {item.children ? (
                  <div className="pb-3 pl-4 space-y-1">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={() => setOpen(false)}
                        className="block py-1.5 text-sm text-cream/70"
                      >
                        — {c.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Caret() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="opacity-60">
      <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function Burger({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <line x1="3" y1={open ? 11 : 6} x2="19" y2={open ? 11 : 6} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ transformOrigin: 'center', transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 180ms' }} />
      <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity={open ? 0 : 1} style={{ transition: 'opacity 120ms' }} />
      <line x1="3" y1={open ? 11 : 16} x2="19" y2={open ? 11 : 16} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ transformOrigin: 'center', transform: open ? 'rotate(-45deg)' : 'none', transition: 'transform 180ms' }} />
    </svg>
  );
}

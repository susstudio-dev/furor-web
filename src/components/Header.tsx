'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { BrandMark } from './BrandMark';
import { ThemeToggle } from './ThemeToggle';
import { FacebookIcon, InstagramIcon, YouTubeIcon } from './SocialIcons';
import { NAV_ITEMS, navLabel, type NavItem } from '@/lib/nav';
import { label } from '@/lib/labels';

type NavWithChildren = NavItem & { children?: { label: string; href: string }[] };

interface SocialLink {
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function Header({ content }: { content: SiteContent }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The branch keys on the STABLE ID, not the rendered text. `item.label ===
  // 'Dance Styles'` was one rename in /admin/labels away from emptying this
  // dropdown with no error anywhere.
  const navWithDropdowns: NavWithChildren[] = NAV_ITEMS.map((item) => {
    if (item.id === 'dance-styles') {
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

  // Admin-created custom pages can opt into the main nav with showInNav.
  // They sit at the end of the primary nav so the existing IA stays the
  // anchor and new pages are additive.
  const customNavItems = content.customPages
    .filter((p) => p.published && p.showInNav)
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((p) => ({ label: p.navLabel || p.title, href: `/p/${p.slug}` }));

  // Each icon renders only when its URL is set — the stored YouTube URL is
  // unverified (spec decision #6), and an icon that 404s is worse than one
  // that is absent. Accessible names come from `labels`, never from a literal:
  // "every user-visible string editable" includes the ones only a screen
  // reader hears.
  const socials: SocialLink[] = [];
  if (content.site.socials.instagram) {
    socials.push({
      id: 'instagram',
      href: content.site.socials.instagram,
      label: label(content.labels, 'ariaSocialInstagram'),
      icon: <InstagramIcon />,
    });
  }
  if (content.site.socials.facebook) {
    socials.push({
      id: 'facebook',
      href: content.site.socials.facebook,
      label: label(content.labels, 'ariaSocialFacebook'),
      icon: <FacebookIcon />,
    });
  }
  if (content.site.socials.youtube) {
    socials.push({
      id: 'youtube',
      href: content.site.socials.youtube,
      label: label(content.labels, 'ariaSocialYoutube'),
      icon: <YouTubeIcon />,
    });
  }
  const iconClass =
    'inline-flex h-11 w-11 items-center justify-center rounded-full text-cream/80 transition hover:bg-cream/5 hover:text-cream';

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${
        scrolled ? 'bg-ink-950/85 backdrop-blur border-b border-cream/10' : 'bg-transparent'
      }`}
    >
      <div className="container-x flex h-16 items-center gap-3">
        <Link href="/" aria-label={label(content.labels, 'ariaHome')} className="shrink-0">
          <BrandMark size={52} />
        </Link>
        <nav
          className="hidden lg:flex flex-1 items-center justify-center gap-1"
          aria-label={label(content.labels, 'ariaPrimaryNav')}
        >
          {navWithDropdowns.map((item) => (
            <div key={item.id} className="group relative">
              <Link href={item.href} className="btn-ghost">
                {navLabel(item, content.labels)}
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
          {customNavItems.map((c) => (
            <Link key={c.href} href={c.href} className="btn-ghost">
              {c.label}
            </Link>
          ))}
        </nav>
        {/* Mobile budget, measured at 375px against 335px of container-x
            content width: BrandMark 156 + gap-3 12 + Instagram 44 + gap-2 8 +
            burger 44 = 264. Three 44px social targets would need 412 and turn
            the primary surface into a horizontally scrolling page (spec §6.1).
            Desktop has the room, so it keeps all three inline. */}
        <div className="ml-auto lg:ml-0 flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-1">
            {socials.map((s) => (
              <a
                key={s.id}
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                className={iconClass}
              >
                {s.icon}
              </a>
            ))}
          </div>
          {/* Wrapped rather than given `hidden lg:inline-flex` directly: the
              toggle's own class string already sets inline-flex, and which of
              two display utilities wins would depend on Tailwind's internal
              ordering. A wrapper makes it unambiguous. */}
          <span className="hidden lg:inline-flex">
            <ThemeToggle />
          </span>
          {/* Instagram alone below lg. It is the traffic source, and the one
              link a visitor who arrived from a Reel uses to check the school is
              real before paying. */}
          {content.site.socials.instagram ? (
            <a
              href={content.site.socials.instagram}
              aria-label={label(content.labels, 'ariaSocialInstagram')}
              target="_blank"
              rel="noopener noreferrer"
              className={`lg:hidden ${iconClass}`}
            >
              <InstagramIcon />
            </a>
          ) : null}
          {/* h-11 w-11 p-0: `p-0` is a utility and beats .btn-ghost's @apply'd
              px-4 py-2 (components layer). The burger was 38px — under the 44px
              touch minimum, and it is one of only two controls up here. */}
          <button
            type="button"
            className="lg:hidden btn-ghost h-11 w-11 p-0"
            aria-label={label(content.labels, 'ariaToggleMenu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{label(content.labels, 'ariaMenu')}</span>
            <Burger open={open} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="lg:hidden border-t border-cream/10 bg-ink-950/95 backdrop-blur">
          <div className="container-x py-4 space-y-1">
            {navWithDropdowns.map((item) => (
              <div key={item.id} className="border-b border-cream/5 last:border-0">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-base font-medium text-cream"
                >
                  {navLabel(item, content.labels)}
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
            {customNavItems.map((c) => (
              <div key={c.href} className="border-b border-cream/5 last:border-0">
                <Link
                  href={c.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-base font-medium text-cream"
                >
                  {c.label}
                </Link>
              </div>
            ))}
            {/* 3 x 44 + 2 x 12 = 156px inside a 335px drawer — 179px spare.
                ThemeToggle lives here rather than in the bar because
                layout.tsx already runs a pre-paint script honouring
                prefers-color-scheme, so a system-mode visitor is served
                correctly without ever opening this.
                Rendered unconditionally, not gated on socials.length: the
                theme toggle must stay reachable even when no social URL is
                set, and an empty flex row costs nothing. */}
            <div className="flex items-center gap-3 border-t border-cream/10 pt-4">
              {socials.map((s) => (
                <a
                  key={s.id}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 text-cream/80 transition hover:border-ember-500/60 hover:text-cream"
                >
                  {s.icon}
                </a>
              ))}
              {/* !h-11 !px-4: ThemeToggle's own h-9 is a mouse-target sized
                  for the desktop bar. This is the touch-primary drawer this
                  task moved it into, with 179px of spare room in the row —
                  the same "don't shrink targets" principle that kept the
                  header to one icon applies here too. `!` beats h-9 despite
                  identical specificity, since Tailwind's compiled important
                  utilities always win regardless of generation order. */}
              <span className="ml-auto">
                <ThemeToggle className="!h-11 !px-4" />
              </span>
            </div>
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

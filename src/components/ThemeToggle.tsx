'use client';

import { useEffect, useState } from 'react';

type Mode = 'system' | 'light' | 'dark';

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(mode: Mode) {
  const resolved = mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let stored = 'system' as Mode;
    try {
      const s = localStorage.getItem('theme');
      if (s === 'light' || s === 'dark' || s === 'system') stored = s;
    } catch {
      /* ignore */
    }
    setMode(stored);
    setMounted(true);

    // When in system mode, follow OS changes live.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const cur = (localStorage.getItem('theme') as Mode) || 'system';
      if (cur === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function cycle() {
    const order: Mode[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
  }

  const label =
    mode === 'system' ? 'Theme: System' : mode === 'light' ? 'Theme: Light' : 'Theme: Dark';
  const nextLabel =
    mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${label}. Click for ${nextLabel}.`}
      title={`${label} — click for ${nextLabel}`}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-cream/20 bg-cream/5 px-3 text-xs font-medium uppercase tracking-wide text-cream/80 transition hover:border-ember-500/60 hover:text-cream ${className ?? ''}`}
    >
      {!mounted ? (
        <span className="h-4 w-4" />
      ) : mode === 'system' ? (
        <Monitor />
      ) : mode === 'light' ? (
        <Sun />
      ) : (
        <Moon />
      )}
      <span className="hidden sm:inline">
        {mounted ? (mode === 'system' ? 'Auto' : mode === 'light' ? 'Light' : 'Dark') : ''}
      </span>
    </button>
  );
}

function Sun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}
function Moon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
function Monitor() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M9 21h6M12 17v4" />
    </svg>
  );
}

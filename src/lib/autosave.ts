'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Subtree-only localStorage autosave. The stash is keyed by section AND the
// content version it was edited against: restoring a stale stash over a
// newer published document is exactly the silent-revert this system refuses
// everywhere else, so a version mismatch OFFERS the stash instead of applying
// it, and a successful save clears it.

function versionNow(): string {
  if (typeof document === 'undefined') return '';
  return (
    document.querySelector('meta[name="furor-content-version"]')?.getAttribute('content') ?? ''
  );
}

interface Stash<T> {
  baseVersion: string;
  savedAt: string;
  value: T;
}

export function useAutosave<T>(sectionKey: string, value: T, dirty: boolean) {
  const storageKey = `furor:draft:${sectionKey}`;
  const [stash, setStash] = useState<Stash<T> | null>(null);
  const skip = useRef(false);

  // Offer an existing stash once, on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setStash(JSON.parse(raw) as Stash<T>);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Write the current value while dirty, debounced a beat.
  useEffect(() => {
    if (!dirty || skip.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ baseVersion: versionNow(), savedAt: new Date().toISOString(), value }),
        );
      } catch {
        /* quota/private mode — autosave is best-effort */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [storageKey, value, dirty]);

  const clear = useCallback(() => {
    skip.current = true;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setStash(null);
    // Allow future writes again once the current tick's cleanup ran.
    setTimeout(() => {
      skip.current = false;
    }, 0);
  }, [storageKey]);

  return {
    /** A stash exists from an earlier visit and hasn't been dismissed. */
    stash,
    /** True when the stash was taken against the version this page loaded. */
    stashMatchesVersion: stash !== null && stash.baseVersion === versionNow(),
    clear,
  };
}

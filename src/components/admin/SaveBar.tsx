'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearDraftRequest, requestDraftSave, type SaveOutcome } from '@/lib/admin-save';

export function SaveBar({
  onSave,
  dirty,
}: {
  onSave: () => Promise<void> | void;
  dirty: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const router = useRouter();

  // The whole document lives in this page's memory while dirty — a stray
  // navigation discarded it silently before this guard existed.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Safari still requires returnValue to be set.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // The save helper reports what actually happened (published vs draft)
  // without every editor threading a return value through.
  useEffect(() => {
    const onOutcome = (e: Event) => setOutcome((e as CustomEvent<SaveOutcome>).detail);
    window.addEventListener('furor:save-outcome', onOutcome);
    return () => window.removeEventListener('furor:save-outcome', onOutcome);
  }, []);

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      setOutcome(null);
      await onSave();
      setMsg('Saved ✓ Live now — refresh the public page to see it.');
      // Invalidate the Router Cache. Without this, another admin route visited
      // earlier stays cached with ITS old document while the shared version
      // token has moved on — going Back to it and saving would pair stale
      // content with a current token and silently revert this save.
      router.refresh();
    } catch (err: unknown) {
      setMsg((err as Error)?.message || 'Save failed');
    } finally {
      clearDraftRequest();
      setBusy(false);
    }
  }

  const shownMsg =
    outcome?.status === 'draft'
      ? 'Saved as a draft — a reviewer will publish it. See /admin/drafts.'
      : outcome?.status === 'unchanged'
        ? 'Nothing to save — no changes.'
        : msg;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 mt-8 -mx-6 sm:-mx-10 border-t border-cream/10 bg-ink-950/90 backdrop-blur p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3 justify-end flex-wrap">
      {shownMsg ? <p className="text-sm text-cream/70">{shownMsg}</p> : null}
      <button
        type="button"
        onClick={() => {
          requestDraftSave();
          void go();
        }}
        disabled={!dirty || busy}
        className={`rounded-full border px-4 py-2 text-sm transition ${
          dirty && !busy
            ? 'border-cream/25 text-cream/80 hover:border-gold-500/60 hover:text-cream'
            : 'border-cream/10 text-cream/30'
        }`}
        title="Store this change for a reviewer instead of publishing it now"
      >
        Save as draft
      </button>
      <button
        onClick={go}
        disabled={!dirty || busy}
        className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
          dirty && !busy ? 'bg-ember-500 text-cream hover:bg-ember-600' : 'bg-cream/10 text-cream/40'
        }`}
      >
        {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
      </button>
    </div>
  );
}

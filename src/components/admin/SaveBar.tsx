'use client';

import { useState } from 'react';

export function SaveBar({
  onSave,
  dirty,
}: {
  onSave: () => Promise<void> | void;
  dirty: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      await onSave();
      setMsg('Saved. Live in ~60s.');
    } catch (err: unknown) {
      setMsg((err as Error)?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 mt-8 -mx-6 sm:-mx-10 border-t border-cream/10 bg-ink-950/90 backdrop-blur p-4 flex items-center gap-3 justify-end">
      {msg ? <p className="text-sm text-cream/70">{msg}</p> : null}
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

'use client';

import { useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { saveSiteContent } from '@/lib/admin-save';

export function JsonEditor({ initial }: { initial: SiteContent }) {
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err: unknown) {
      setMsg('Invalid JSON: ' + (err as Error).message);
      setBusy(false);
      return;
    }
    // Goes through the shared helper so this screen carries the same version
    // envelope as the other nineteen editors. Posting a bare document here used
    // to skip the conflict check entirely, which made a single click of Save
    // revert whatever anyone else had saved — across the WHOLE document,
    // because this screen diffs every top-level key.
    try {
      await saveSiteContent(parsed);
      setMsg('Saved ✓ Live now — refresh the public page to see it.');
    } catch (err: unknown) {
      setMsg((err as Error)?.message || 'Save failed');
    }
    setBusy(false);
  }

  return (
    <div className="mt-6">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="w-full h-[60vh] rounded-2xl border border-cream/15 bg-ink-950 p-4 font-mono text-xs text-cream/90"
      />
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save'}
        </button>
        {msg ? <p className="text-sm text-cream/70">{msg}</p> : null}
      </div>
    </div>
  );
}

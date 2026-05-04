'use client';

import { useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';

export function JsonEditor({ initial }: { initial: SiteContent }) {
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [issues, setIssues] = useState<unknown>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    setIssues(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err: unknown) {
      setMsg('Invalid JSON: ' + (err as Error).message);
      setBusy(false);
      return;
    }
    const res = await fetch('/api/admin/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error || 'Save failed');
      setIssues(j.issues || null);
    } else {
      setMsg('Saved. Live in ~60s.');
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
      {issues ? (
        <pre className="mt-4 rounded-xl border border-ember-500/30 bg-ember-500/5 p-4 text-xs overflow-auto max-h-72">
          {JSON.stringify(issues, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

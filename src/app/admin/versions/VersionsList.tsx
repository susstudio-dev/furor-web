'use client';

import { useState } from 'react';

export function VersionsList({ versions }: { versions: string[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function restore(filename: string) {
    if (!window.confirm(`Restore ${filename}?\nThe current content becomes a new version entry.`)) return;
    setBusy(filename);
    setMsg(null);
    const res = await fetch('/api/admin/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || 'Restore failed');
    } else {
      setMsg('Restored. Reload to see the editor reflect the change.');
    }
  }

  if (versions.length === 0) {
    return <p className="mt-6 text-cream/60">No saved versions yet — they appear here after the first save.</p>;
  }
  return (
    <>
      <ul className="mt-6 grid gap-2">
        {versions.map((v) => {
          const m = v.match(/^site-content-(.+)-by-(.+)\.json$/);
          const ts = m?.[1].replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2})/, 'T$1:$2:$3');
          return (
            <li key={v} className="flex items-center justify-between gap-4 rounded-2xl border border-cream/10 bg-ink-900/40 p-4">
              <div>
                <p className="text-cream font-mono text-xs">{v}</p>
                <p className="text-cream/60 text-sm">
                  {ts ? new Date(ts).toLocaleString('en-IN') : v} · by {m?.[2]}
                </p>
              </div>
              <button onClick={() => restore(v)} disabled={busy === v} className="btn-secondary text-sm">
                {busy === v ? 'Restoring…' : 'Restore'}
              </button>
            </li>
          );
        })}
      </ul>
      {msg ? <p className="mt-4 text-sm text-cream/70">{msg}</p> : null}
    </>
  );
}

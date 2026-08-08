'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface DraftRow {
  id: string;
  note: string;
  authorEmail: string;
  /** LIVE leaf paths - what approving would apply now, and what gets echoed. */
  leafPaths: string[];
  createdAt: string;
  /** Set when the draft can no longer apply cleanly. */
  broken: string | null;
}

export function DraftsList({ drafts, canApprove }: { drafts: DraftRow[]; canApprove: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(draft: DraftRow, action: 'approve' | 'reject') {
    setBusy(draft.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The echo: the exact leaf list this screen displayed. The server
        // refuses an approval whose echo does not match the draft.
        body: JSON.stringify({ id: draft.id, action, leafPaths: draft.leafPaths }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error || `${action} failed`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function preview(draft: DraftRow) {
    setBusy(draft.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error || 'Could not start the preview');
        return;
      }
      window.open('/', '_blank', 'noopener');
    } finally {
      setBusy(null);
    }
  }

  if (drafts.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-cream/10 bg-ink-900/40 p-6 text-cream/70">
        Nothing waiting. Editors&rsquo; saves and anyone&rsquo;s &ldquo;Save as draft&rdquo; will
        show up here.
      </p>
    );
  }

  return (
    <div className="mt-8 grid gap-3">
      {error ? <p className="text-sm text-ember-400">{error}</p> : null}
      {drafts.map((d) => (
        <div key={d.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-cream">
                {d.authorEmail}
                <span className="ml-2 text-xs text-cream/50">
                  {new Date(d.createdAt).toLocaleString('en-IN')}
                </span>
                {d.broken ? (
                  <span className="pill ml-2 bg-gold-500/15 text-gold-400">needs a redo</span>
                ) : null}
              </p>
              {d.note ? <p className="mt-1 text-sm text-cream/75">{d.note}</p> : null}
              {/* The change list IS what gets echoed on approve — the approver
                  always sees exactly what they are signing. */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.leafPaths.map((p) => (
                  <code key={p} className="rounded bg-cream/5 px-1.5 py-0.5 text-xs text-cream/70">
                    {p}
                  </code>
                ))}
              </div>
            </div>
            {(
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy === d.id}
                  onClick={() => preview(d)}
                  className="pill bg-cream/5 text-cream/75 hover:bg-cream/10"
                >
                  Preview ↗
                </button>
                <Link href={`/admin/drafts/${d.id}/review`} className="pill bg-cream/5 text-cream/75 hover:bg-cream/10">
                  Review side-by-side
                </Link>
                {canApprove ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === d.id || d.broken != null}
                      onClick={() => act(d, 'approve')}
                      className="rounded-full bg-ember-600 px-4 py-1.5 text-sm font-semibold text-on-ember transition hover:bg-ember-700 disabled:opacity-50"
                    >
                      {busy === d.id ? 'Working…' : 'Approve & publish'}
                    </button>
                    <button
                      type="button"
                      disabled={busy === d.id}
                      onClick={() => act(d, 'reject')}
                      className="pill bg-cream/5 text-cream/70 hover:bg-cream/10"
                    >
                      Reject
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
          {d.broken ? <p className="mt-2 text-xs text-gold-400">{d.broken}</p> : null}
        </div>
      ))}
    </div>
  );
}

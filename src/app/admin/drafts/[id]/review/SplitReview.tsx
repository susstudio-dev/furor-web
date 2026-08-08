'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DraftInfo {
  id: string;
  note: string;
  authorEmail: string;
  status: string;
  leafPaths: string[];
  createdAt: string;
}

export function SplitReview({ draft, canApprove }: { draft: DraftInfo; canApprove: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState('/');

  // The iframe can only render once the preview cookie exists — it both
  // selects the draft overlay and flips the framing headers to SAMEORIGIN.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draftId: draft.id }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) setError(j.error || 'Could not start the preview');
          return;
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setError('Could not start the preview');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.id]);

  async function act(action: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: draft.id, action, leafPaths: draft.leafPaths }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error || `${action} failed`);
        return;
      }
      await fetch('/api/admin/preview', { method: 'DELETE' }).catch(() => undefined);
      router.push('/admin/drafts');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col lg:flex-row">
      {/* The change list — what an approval signs. */}
      <aside className="w-full shrink-0 border-b border-cream/10 p-6 lg:h-full lg:w-80 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link href="/admin/drafts" className="text-sm text-cream/60 hover:text-cream">
          ← All drafts
        </Link>
        <p className="mt-3 display text-xl font-bold">Draft by {draft.authorEmail}</p>
        <p className="mt-1 text-xs text-cream/50">{new Date(draft.createdAt).toLocaleString('en-IN')}</p>
        {draft.note ? <p className="mt-3 text-sm text-cream/80">{draft.note}</p> : null}
        <p className="mt-5 text-xs uppercase tracking-widest text-cream/60">Changes</p>
        <div className="mt-2 grid gap-1.5">
          {draft.leafPaths.map((p) => (
            <code key={p} className="rounded bg-cream/5 px-2 py-1 text-xs text-cream/75">
              {p}
            </code>
          ))}
        </div>
        {error ? <p className="mt-4 text-sm text-ember-400">{error}</p> : null}
        {canApprove ? (
          <div className="mt-6 grid gap-2">
            <button
              type="button"
              disabled={busy || !ready}
              onClick={() => act('approve')}
              className="rounded-full bg-ember-600 px-4 py-2.5 text-sm font-semibold text-on-ember transition hover:bg-ember-700 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Approve & publish'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act('reject')}
              className="rounded-full border border-cream/20 px-4 py-2 text-sm text-cream/75 transition hover:border-cream/40"
            >
              Reject
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex gap-3 text-xs">
          {(['/', '/batches', '/faqs'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFrame(p)}
              className={`underline-offset-4 ${frame === p ? 'text-cream underline' : 'text-cream/60 hover:text-cream'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </aside>

      {/* The real site, previewing the draft. */}
      <div className="min-h-[60vh] flex-1 bg-ink-950">
        {ready ? (
          <iframe
            src={frame}
            title="Draft preview"
            className="h-full min-h-[60vh] w-full border-0"
          />
        ) : (
          <div className="grid h-full min-h-[60vh] place-items-center text-cream/50">
            {error ?? 'Starting preview…'}
          </div>
        )}
      </div>
    </div>
  );
}

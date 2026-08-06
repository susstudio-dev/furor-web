'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MIN_LENGTH = 12; // matches the server and scripts/hash-password.mjs

export function ChangePasswordForm({ forced, breakGlass }: { forced: boolean; breakGlass: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (breakGlass) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-cream/10 bg-ink-900/60 p-8">
        <p className="display text-2xl font-extrabold">Owner account</p>
        <p className="mt-3 text-cream/75">
          This account&rsquo;s password lives in the deployment environment, not in the user
          store. Rotate it with{' '}
          <code className="text-cream/90">wrangler secret put ADMIN_OWNER_PASSWORD_HASH</code>{' '}
          (generate the value with <code className="text-cream/90">npm run hash-password</code>).
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('The two new passwords don’t match.');
      return;
    }
    if (next.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/me', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error || 'Could not change the password.');
        return;
      }
      router.push('/admin');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-3xl border border-cream/10 bg-ink-900/60 p-8"
    >
      <p className="display text-2xl font-extrabold">
        {forced ? 'Choose your password' : 'Change password'}
      </p>
      <p className="mt-1 text-sm text-cream/60">
        {forced
          ? 'Your invite came with a temporary password — replace it before you start editing.'
          : 'Changing it signs out your other sessions.'}
      </p>
      <div className="mt-6 grid gap-3">
        <label className="text-xs uppercase tracking-widest text-cream/60">
          {forced ? 'Temporary password' : 'Current password'}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-cream/15 bg-ink-950 px-4 py-3 text-cream focus:border-ember-500 outline-none"
          />
        </label>
        <label className="text-xs uppercase tracking-widest text-cream/60">
          New password
          <input
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-cream/15 bg-ink-950 px-4 py-3 text-cream focus:border-ember-500 outline-none"
          />
        </label>
        <label className="text-xs uppercase tracking-widest text-cream/60">
          New password, again
          <input
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-cream/15 bg-ink-950 px-4 py-3 text-cream focus:border-ember-500 outline-none"
          />
        </label>
      </div>
      {error ? <p className="mt-4 text-sm text-ember-400">{error}</p> : null}
      <button type="submit" disabled={busy} className="btn-primary mt-6 w-full justify-center">
        {busy ? 'Saving…' : forced ? 'Set password & continue' : 'Change password'}
      </button>
    </form>
  );
}

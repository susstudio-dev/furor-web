'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Sign-in failed');
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-3xl border border-cream/10 bg-ink-900/60 p-8 backdrop-blur">
        <p className="display text-2xl font-extrabold">
          <span className="text-ember-500">Furor</span> admin
        </p>
        <p className="mt-1 text-sm text-cream/60">Sign in to update the site.</p>
        <div className="mt-6 grid gap-3">
          <label className="text-xs uppercase tracking-widest text-cream/60">Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-cream/15 bg-ink-950 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-ember-500 outline-none"
            />
          </label>
          <label className="text-xs uppercase tracking-widest text-cream/60">Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-cream/15 bg-ink-950 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-ember-500 outline-none"
            />
          </label>
          {error ? <p className="text-sm text-ember-400">{error}</p> : null}
          <button disabled={busy} className="btn-primary mt-2 w-full">{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  );
}

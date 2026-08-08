'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLES, SECTION_PATHS } from '@/lib/roles';
import type { User } from '@/lib/users-schema';
import { EditorStyles, Field, MultiToggle, Select } from '@/components/admin/fields';

// Invite, re-role, and disable/enable studio accounts. Every rule this screen
// appears to enforce is actually enforced server-side in users-mutations.ts —
// the UI just avoids offering actions the API would refuse.

const SECTION_KEYS = Object.keys(SECTION_PATHS);
// Instructor and Author are hidden until the form can set the attributes
// their rules bind to (instructorId / story authorship) — inviting one today
// produces an account whose every action is refused and whose sidebar is
// empty. The API still refuses grants the actor cannot make.
const USABLE_ROLES = ROLES.filter((r) => r.id !== 'instructor' && r.id !== 'author');
const INVITABLE_ROLES = USABLE_ROLES;

export function UsersEditor({ users, selfId }: { users: User[]; selfId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The temp password is shown exactly once, here, after a successful invite.
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Invite form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('editor');
  const [sections, setSections] = useState<string[]>([]);

  async function call(body: Record<string, unknown>, method: 'POST' | 'PATCH') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        tempPassword?: string;
      };
      if (!res.ok) {
        setError(j.error || 'Request failed');
        return null;
      }
      router.refresh();
      return j;
    } finally {
      setBusy(false);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setIssued(null);
    setCopied(false);
    const j = await call(
      {
        email,
        name,
        roleIds: [roleId],
        ...(roleId === 'editor' ? { sections } : {}),
      },
      'POST',
    );
    if (j?.tempPassword) {
      setIssued({ email: email.trim().toLowerCase(), password: j.tempPassword });
      setName('');
      setEmail('');
      setSections([]);
    }
  }

  async function copyIssued() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(
        `Furor admin — sign in at https://www.dancehyderabad.com/admin\nEmail: ${issued.email}\nTemporary password: ${issued.password}\n(You'll be asked to choose your own password on first sign-in.)`,
      );
      setCopied(true);
    } catch {
      /* the password stays visible for manual copying */
    }
  }

  return (
    <div className="mt-8 grid gap-8">
      {/* ── Invite ─────────────────────────────────────────────────────── */}
      <form onSubmit={invite} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
        <p className="display text-lg font-bold">Invite someone</p>
        <p className="mt-1 text-sm text-cream/60">
          You&rsquo;ll get a temporary password to send them on WhatsApp — it&rsquo;s shown once.
          They choose their own on first sign-in.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Select
            label="Role"
            value={roleId}
            onChange={setRoleId}
            options={INVITABLE_ROLES.map((r) => ({ value: r.id, label: r.name }))}
            hint="What they can do. Editors are limited to the sections you pick."
          />
          {roleId === 'editor' ? (
            <MultiToggle
              label="Sections"
              values={sections}
              options={SECTION_KEYS.map((k) => ({ value: k, label: k }))}
              onChange={setSections}
              hint="Which parts of the site this editor may change."
            />
          ) : null}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Working…' : 'Create account'}
          </button>
          {error ? <p className="text-sm text-ember-400">{error}</p> : null}
        </div>

        {issued ? (
          <div className="mt-5 rounded-xl border border-ember-500/40 bg-ember-500/5 p-4">
            <p className="text-sm text-cream/85">
              Account created for <span className="font-semibold">{issued.email}</span>. This
              password is shown <span className="font-semibold">once</span>:
            </p>
            <p className="mt-2 select-all font-mono text-lg tracking-wider text-cream">
              {issued.password}
            </p>
            <button type="button" onClick={copyIssued} className="btn-secondary mt-3">
              {copied ? 'Copied ✓' : 'Copy invite message'}
            </button>
          </div>
        ) : null}
      </form>

      {/* ── Existing users ─────────────────────────────────────────────── */}
      <ul className="grid gap-2">
        {users.map((u) => (
          <UserRow key={u.id} user={u} self={u.id === selfId} busy={busy} onCall={call} />
        ))}
      </ul>
      <EditorStyles />
    </div>
  );
}

function UserRow({
  user,
  self,
  busy,
  onCall,
}: {
  user: User;
  self: boolean;
  busy: boolean;
  onCall: (body: Record<string, unknown>, method: 'POST' | 'PATCH') => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [roleId, setRoleId] = useState(user.roleIds[0] ?? 'viewer');
  const [sections, setSections] = useState<string[]>(user.attrs.sections ?? []);
  const disabled = user.status === 'disabled';

  async function saveRole() {
    await onCall(
      { id: user.id, roleIds: [roleId], ...(roleId === 'editor' ? { sections } : {}) },
      'PATCH',
    );
    setEditing(false);
  }

  return (
    <li className={`rounded-xl border border-cream/10 bg-ink-900/40 p-4 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-cream">
            {user.name || user.email}
            {self ? <span className="ml-2 text-xs text-cream/50">(you)</span> : null}
            {disabled ? <span className="ml-2 text-xs text-cream/40">· disabled</span> : null}
          </p>
          <p className="text-xs text-cream/50">
            {user.email}
            {user.attrs.sections?.length ? ` · ${user.attrs.sections.join(', ')}` : ''}
            {user.lastLoginAt
              ? ` · last signed in ${user.lastLoginAt.slice(0, 10)}`
              : ' · never signed in'}
            {user.mustChangePassword ? ' · temp password pending' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill bg-cream/10 text-cream/70">{user.roleIds.join(', ') || 'no role'}</span>
          {!self ? (
            <>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="pill bg-cream/5 text-cream/75 hover:bg-cream/10"
              >
                {editing ? 'Cancel' : 'Change role'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onCall({ id: user.id, status: disabled ? 'active' : 'disabled' }, 'PATCH')}
                className="pill bg-cream/5 text-cream/75 hover:bg-cream/10"
              >
                {disabled ? 'Re-enable' : 'Disable'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-4 border-t border-cream/10 pt-4 sm:grid-cols-2">
          <Select
            label="Role"
            value={roleId}
            onChange={setRoleId}
            options={USABLE_ROLES.map((r) => ({ value: r.id, label: r.name }))}
          />
          {roleId === 'editor' ? (
            <MultiToggle
              label="Sections"
              values={sections}
              options={Object.keys(SECTION_PATHS).map((k) => ({ value: k, label: k }))}
              onChange={setSections}
            />
          ) : null}
          <div>
            <button type="button" onClick={saveRole} disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save role'}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

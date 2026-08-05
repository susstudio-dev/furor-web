import { requireCapability } from '@/lib/guard';
import { readUserStore } from '@/lib/users';
import { ROLES, SECTION_PATHS } from '@/lib/roles';

export default async function Page() {
  const subject = await requireCapability('users.manage');
  const state = await readUserStore();

  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Users</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Who can edit</h1>

      {state == null ? (
        <p className="mt-6 rounded-xl border border-ember-500/40 bg-ember-500/5 p-4 text-cream/85">
          The user store could not be read. Everyone except the owner account configured in the
          environment is signed out until this is resolved — that is deliberate, so a storage
          problem can never be mistaken for “no restrictions”.
        </p>
      ) : (
        <ul className="mt-6 grid gap-2">
          <li className="rounded-xl border border-cream/10 bg-ink-900/40 p-4 flex items-center justify-between">
            <div>
              <p className="text-cream font-medium">{subject.email}</p>
              <p className="text-cream/50 text-xs">
                Owner account from the environment — cannot be deleted or demoted here.
              </p>
            </div>
            <span className="pill bg-cream/10 text-cream/70">owner</span>
          </li>

          {state.users.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-cream/10 bg-ink-900/40 p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-cream font-medium">
                  {u.name || u.email}{' '}
                  {u.status === 'disabled' ? (
                    <span className="text-cream/40 text-xs">· disabled</span>
                  ) : null}
                </p>
                <p className="text-cream/50 text-xs">
                  {u.email}
                  {u.attrs.sections?.length ? ` · ${u.attrs.sections.join(', ')}` : ''}
                  {u.lastLoginAt ? ` · last signed in ${u.lastLoginAt.slice(0, 10)}` : ' · never signed in'}
                </p>
              </div>
              <span className="pill bg-cream/10 text-cream/70">{u.roleIds.join(', ') || 'no role'}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 rounded-2xl border border-cream/10 bg-ink-900/40 p-5">
        <p className="display text-sm uppercase tracking-widest text-cream/60">Roles</p>
        <ul className="mt-3 grid gap-1 text-sm text-cream/75">
          {ROLES.map((r) => (
            <li key={r.id}>
              <span className="text-cream">{r.name}</span>
              {r.sectionScoped ? ' — only the sections assigned to that person' : ''}
              {r.capabilities.length ? ` — ${r.capabilities.join(', ')}` : ''}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-cream/50 text-xs">
          Sections an Editor can be given: {Object.keys(SECTION_PATHS).join(', ')}.
        </p>
      </div>
    </div>
  );
}

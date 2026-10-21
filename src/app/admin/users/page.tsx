import { requireCapability } from '@/lib/guard';
import { readUserStore } from '@/lib/users';
import { ROLES } from '@/lib/roles';
import { UsersEditor } from './UsersEditor';

export default async function Page() {
  const subject = await requireCapability('users.manage');
  const state = await readUserStore();

  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Users</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Who can edit</h1>

      <div className="mt-6 rounded-xl border border-cream/10 bg-ink-900/40 p-4 flex items-center justify-between">
        <div>
          <p className="text-cream font-medium">{subject.breakGlass ? subject.email : 'Owner (environment)'}</p>
          <p className="text-cream/50 text-xs">
            The owner account from the deployment environment — it cannot be deleted or demoted
            here, and it keeps working even if this user list is unavailable.
          </p>
        </div>
        <span className="pill bg-cream/10 text-cream/70">owner</span>
      </div>

      {state == null ? (
        <p className="mt-6 rounded-xl border border-ember-500/40 bg-ember-500/5 p-4 text-cream/85">
          The user store could not be read. Everyone except the environment owner is signed out
          until this is resolved — deliberately, so a storage problem can never be mistaken for
          &ldquo;no restrictions&rdquo;.
        </p>
      ) : (
        <UsersEditor users={state.users} selfId={subject.id} />
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
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getSession, listUsers } from '@/lib/auth';

export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  if (session.role !== 'owner') redirect('/admin');
  const users = await listUsers();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Users</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Who can edit</h1>
      <ul className="mt-6 grid gap-2">
        {users.map((u) => (
          <li key={u.email} className="rounded-xl border border-cream/10 bg-ink-900/40 p-4 flex items-center justify-between">
            <div>
              <p className="text-cream font-medium">{u.email}</p>
              <p className="text-cream/50 text-xs">Created {new Date(u.createdAt).toLocaleDateString('en-IN')}</p>
            </div>
            <span className="pill bg-cream/10 text-cream/70">{u.role}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-cream/60 text-sm">
        Inviting editors via the panel is on the v1.1 backlog. For now, an existing owner can add a record to <code className="text-cream/80">data/users.json</code> directly (with a bcrypt hash) or use the upcoming invite flow.
      </p>
    </div>
  );
}

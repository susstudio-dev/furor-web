import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { readAudit } from '@/lib/audit';

export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  if (session.role !== 'owner') redirect('/admin');
  const entries = await readAudit(200);
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Audit log</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Who changed what</h1>
      {entries.length === 0 ? (
        <p className="mt-6 text-cream/60">No activity yet.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {entries.map((e, i) => (
            <li key={i} className="rounded-xl border border-cream/10 bg-ink-900/40 p-3 text-sm">
              <span className="text-cream/40 font-mono">{new Date(e.ts).toLocaleString('en-IN')}</span>
              <span className="ml-3 text-ember-400">{e.action}</span>
              <span className="ml-3 text-cream">{e.actor}</span>
              {e.detail ? <span className="ml-3 text-cream/60">— {e.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

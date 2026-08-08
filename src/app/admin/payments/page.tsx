import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { readJSON } from '@/lib/storage';
import { requireCapability } from '@/lib/guard';

// Razorpay webhook ([/api/razorpay/webhook](src/app/api/razorpay/webhook/route.ts))
// persists every payment event here. This page surfaces them so failed /
// abandoned payments are visible — the customer's browser may never reach
// /welcome, but the webhook always fires.
export const dynamic = 'force-dynamic';

const EVENTS_KEY = 'payment-events.json';
const CAP = 1000;

interface PaymentEvent {
  ts: string;
  event: string;
  status: string;
  paymentId: string | null;
  amount: number | null; // paise
  email: string | null;
  contact: string | null;
  errorDescription: string | null;
}

function formatInr(paise: number | null): string {
  if (paise == null) return '—';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('fail') || s.includes('error')) return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (s.includes('captur') || s.includes('paid') || s.includes('success'))
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (s.includes('author')) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-cream/70 bg-cream/10 border-cream/20';
}

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireCapability('versions.restore');
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { filter } = await searchParams;
  const all = ((await readJSON<PaymentEvent[]>(EVENTS_KEY)) ?? []).slice().reverse();

  const filtered =
    filter === 'failed'
      ? all.filter((e) => /fail|error/i.test(e.status) || /fail|error/i.test(e.event))
      : filter === 'paid'
      ? all.filter((e) => /captur|paid|success/i.test(e.status))
      : all;

  const counts = {
    all: all.length,
    paid: all.filter((e) => /captur|paid|success/i.test(e.status)).length,
    failed: all.filter((e) => /fail|error/i.test(e.status) || /fail|error/i.test(e.event)).length,
  };

  const Tab = ({ k, label, n }: { k: string; label: string; n: number }) => {
    const active = (filter ?? 'all') === k;
    const href = k === 'all' ? '/admin/payments' : `/admin/payments?filter=${k}`;
    return (
      <a
        href={href}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          active
            ? 'border-ember-500/50 bg-ember-500/15 text-ember-300'
            : 'border-cream/10 text-cream/60 hover:border-cream/30 hover:text-cream'
        }`}
      >
        {label} <span className="ml-1 text-cream/40">· {n}</span>
      </a>
    );
  };

  return (
    <div className="p-6 sm:p-10 max-w-6xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Payments</p>
      <h1 className="mt-1 display text-3xl sm:text-4xl font-extrabold">Razorpay events</h1>
      <p className="mt-2 text-cream/60 text-sm">
        Server-to-server log of every payment outcome — including failed/abandoned ones the redirect-based
        confirmation can&apos;t see. Most recent {CAP} kept.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Tab k="all" label="All" n={counts.all} />
        <Tab k="paid" label="Paid" n={counts.paid} />
        <Tab k="failed" label="Failed" n={counts.failed} />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
          <p className="text-cream/70">No events yet.</p>
          <p className="mt-2 text-cream/50 text-sm">
            If you expect events here, check that <code className="text-ember-400">RAZORPAY_WEBHOOK_SECRET</code> is set
            on Vercel and the webhook URL in the Razorpay dashboard points to{' '}
            <code className="text-ember-400">/api/razorpay/webhook</code>.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-cream/10 bg-ink-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-cream/40">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Payment ID</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i} className="border-t border-cream/5 align-top">
                  <td className="px-4 py-3 text-cream/70 font-mono text-xs whitespace-nowrap">
                    {new Date(e.ts).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-cream/80">{e.event}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusTone(e.status)}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cream/80 whitespace-nowrap">{formatInr(e.amount)}</td>
                  <td className="px-4 py-3 text-cream/70">
                    {e.email || e.contact ? (
                      <div className="grid">
                        {e.email ? <span className="break-all">{e.email}</span> : null}
                        {e.contact ? <span className="text-cream/50 text-xs">{e.contact}</span> : null}
                      </div>
                    ) : (
                      <span className="text-cream/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-cream/60 font-mono text-xs break-all">{e.paymentId || '—'}</td>
                  <td className="px-4 py-3 text-cream/70 max-w-[20rem]">{e.errorDescription || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

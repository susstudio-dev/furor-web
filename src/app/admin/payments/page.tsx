import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { readJSON } from '@/lib/storage';
import { requireCapability } from '@/lib/guard';
import { paymentLogStaleness } from '@/lib/payment-log';

// Razorpay webhook ([/api/razorpay/webhook](src/app/api/razorpay/webhook/route.ts))
// persists every payment event. This page turns that log into a dashboard:
// revenue, conversion, why payments fail, and which failed payers are worth a
// follow-up call. The customer's browser may never reach /welcome, but the
// webhook always fires.
export const dynamic = 'force-dynamic';

const RANGES = [
  { k: '7', label: '7 days', days: 7 },
  { k: '30', label: '30 days', days: 30 },
  { k: '90', label: '90 days', days: 90 },
  { k: 'all', label: 'All time', days: null },
] as const;

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const inrCompact = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${Math.round(n)}`;
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);
const formatInr = (paise: number | null) => (paise == null ? '—' : inr(paise / 100));

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
  // The webhook can stop delivering without any error on OUR side — Razorpay
  // deactivates a webhook after 24h of failed deliveries and never re-enables
  // it by itself (it happened during the Vercel → Workers cutover). A stale
  // log must say so, or weeks of payments stay invisible in silence.
  const stale = paymentLogStaleness(all, new Date());

  const isPaid = (e: PaymentEvent) => /captur|paid|success/i.test(e.status);
  const isFailed = (e: PaymentEvent) => /fail|error/i.test(e.status) || /fail|error/i.test(e.event);
  const filtered = filter === 'failed' ? all.filter(isFailed) : filter === 'paid' ? all.filter(isPaid) : all;
  const counts = { all: all.length, paid: all.filter(isPaid).length, failed: all.filter(isFailed).length };
  const LOG_LIMIT = 100;

  const qs = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/admin/payments?${s}` : '/admin/payments';
  };

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'border-ember-500/50 bg-ember-500/15 text-ember-300'
        : 'border-cream/10 text-cream/60 hover:border-cream/30 hover:text-cream'
    }`;

  const revDelta = a.prev ? delta(a.revenue, a.prev.revenue) : null;
  const rateDelta = a.prev ? delta(a.successRate, a.prev.successRate) : null;
  const paidDelta = a.prev ? delta(a.paid, a.prev.paid) : null;

  return (
    <div className="p-6 sm:p-10 max-w-6xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Payments</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-3xl sm:text-4xl font-extrabold">Revenue &amp; insights</h1>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <a key={r.k} href={qs({ range: r.k === '30' ? undefined : r.k, filter })} className={pill(r.k === activeRange.k)}>
              {r.label}
            </a>
          ))}
        </div>
      </div>
      <p className="mt-2 text-cream/60 text-sm">
        Server-to-server log of every payment outcome — including failed/abandoned ones the redirect-based
        confirmation can&apos;t see. Most recent {CAP} kept.
      </p>

      {stale ? (
        <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <p className="font-semibold text-amber-300">
            {stale.days != null
              ? `No events for ${stale.days} days.`
              : 'The event log has no readable timestamps.'}
          </p>
          <p className="mt-2 text-sm text-cream/70">
            If you&apos;ve taken payments since, Razorpay has stopped delivering to this site. Razorpay
            deactivates a webhook after 24 hours of failed deliveries and{' '}
            <strong className="text-cream/90">never re-enables it by itself</strong>. Check{' '}
            <span className="text-cream/90">Razorpay Dashboard → Settings → Webhooks</span>: re-enable
            (or recreate) the webhook for{' '}
            <code className="text-ember-400">https://www.dancehyderabad.com/api/razorpay/webhook</code>, then
            set the same secret on the Worker with{' '}
            <code className="text-ember-400">wrangler secret put RAZORPAY_WEBHOOK_SECRET</code>.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Tab k="all" label="All" n={counts.all} />
        <Tab k="paid" label="Paid" n={counts.paid} />
        <Tab k="failed" label="Failed" n={counts.failed} />
      </div>

      {!a.hasData ? (
        <div className="mt-8 rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
          <p className="text-cream/70">No events yet.</p>
          <p className="mt-2 text-cream/50 text-sm">
            If you expect events here: the webhook in the Razorpay dashboard must point to{' '}
            <code className="text-ember-400">https://www.dancehyderabad.com/api/razorpay/webhook</code> and be{' '}
            <strong className="text-cream/80">active</strong> (Razorpay deactivates it after 24h of failed
            deliveries), and its secret must match the Worker&apos;s — set with{' '}
            <code className="text-ember-400">wrangler secret put RAZORPAY_WEBHOOK_SECRET</code>.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="Net revenue"
              value={inr(a.revenue)}
              change={revDelta}
              sub={a.refunded > 0 ? `${inr(a.refunded)} refunded` : `${a.paid} payments`}
            />
            <Kpi label="Paid bookings" value={String(a.paid)} change={paidDelta} sub={a.aov ? `avg ${inr(a.aov)}` : undefined} />
            <Kpi
              label="Success rate"
              value={pct(a.successRate)}
              change={rateDelta}
              sub={`${a.failed} failed`}
              tone={a.successRate != null && a.paid + a.failed >= 5 ? (a.successRate >= 0.85 ? 'good' : 'bad') : undefined}
            />
            <Kpi
              label="Money at risk"
              value={inr(a.lost.value)}
              sub={`${a.lost.count} lost lead${a.lost.count === 1 ? '' : 's'}`}
              tone={a.lost.count > 0 ? 'bad' : undefined}
            />
          </div>

          {/* Takeaways */}
          {insights.length ? (
            <div className="mt-4 rounded-2xl border border-ember-500/25 bg-ember-500/5 p-5">
              <h2 className="display text-sm font-bold uppercase tracking-widest text-ember-400">What stands out</h2>
              <ul className="mt-3 grid gap-2 text-sm text-cream/80">
                {insights.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-ember-400">→</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Trend */}
          <div className="mt-4">
            <Card title="Revenue by day" hint="Net of refunds, IST calendar days">
              <RevenueChart a={a} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Why payments fail" hint="Failed attempts grouped by Razorpay's reason">
              <HBars
                rows={a.reasons}
                valueOf={(b) => b.count}
                fmt={(b) => `${b.count} · ${inr(b.value)}`}
                barClass="bg-red-400/70"
                empty="No failed payments in this period 🎉"
              />
            </Card>
            <Card title="Payment methods" hint="Paid bookings per method, with failures alongside">
              <HBars
                rows={a.methods}
                valueOf={(b) => b.count + (b.extra ?? 0)}
                fmt={(b) => `${b.count} paid${b.extra ? ` · ${b.extra} failed` : ''} · ${inr(b.value)}`}
                empty="No payments yet."
              />
            </Card>
            <Card title="What people buy" hint="Paid bookings grouped by ticket price">
              <HBars
                rows={a.prices}
                valueOf={(b) => b.value}
                fmt={(b) => `${b.count} booking${b.count === 1 ? '' : 's'} · ${inr(b.value)}`}
                barClass="bg-emerald-400/70"
                empty="No paid bookings yet."
              />
            </Card>
            <Card title="When people pay" hint="Attempts by hour of day (IST) — green paid, red failed">
              <HourStrip a={a} />
            </Card>
          </div>

          {/* Follow-up list */}
          <div className="mt-4">
            <Card
              title={`Follow up (${a.lost.count})`}
              hint="People whose payment failed and who haven't paid since. A quick call or WhatsApp often wins these back."
            >
              {a.lost.leads.length === 0 ? (
                <p className="text-sm text-cream/40">Nobody is waiting on a follow-up in this period.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-widest text-cream/40">
                        <th className="px-2 py-2 font-medium">Last attempt</th>
                        <th className="px-2 py-2 font-medium">Contact</th>
                        <th className="px-2 py-2 font-medium">Amount</th>
                        <th className="px-2 py-2 font-medium">Tries</th>
                        <th className="px-2 py-2 font-medium">Why it failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.lost.leads.slice(0, 15).map((l) => (
                        <tr key={l.customer} className="border-t border-cream/5 align-top">
                          <td className="px-2 py-2 text-cream/70 font-mono text-xs whitespace-nowrap">
                            {new Date(l.ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                          <td className="px-2 py-2 text-cream/80">
                            <div className="grid">
                              {l.email ? <span className="break-all">{l.email}</span> : null}
                              {l.contact ? (
                                <a href={`tel:${l.contact}`} className="text-ember-400 text-xs">
                                  {l.contact}
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-cream/80 whitespace-nowrap">{inr(l.amount)}</td>
                          <td className="px-2 py-2 text-cream/60">{l.tries}</td>
                          <td className="px-2 py-2 text-cream/70 max-w-[18rem]">{l.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Raw event log */}
      <h2 className="mt-10 display text-lg font-bold">Event log</h2>
      <p className="mt-1 text-cream/50 text-xs">
        Raw webhook events, newest first (most recent {PAYMENT_EVENTS_CAP} kept). The dashboard above is built from
        this.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ['all', 'All', counts.all],
            ['paid', 'Paid', counts.paid],
            ['failed', 'Failed', counts.failed],
          ] as const
        ).map(([k, label, n]) => (
          <a
            key={k}
            href={qs({ range: activeRange.k === '30' ? undefined : activeRange.k, filter: k === 'all' ? undefined : k })}
            className={pill((filter ?? 'all') === k)}
          >
            {label} <span className="ml-1 text-cream/40">· {n}</span>
          </a>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-cream/10 bg-ink-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-cream/40">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Payment ID</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, LOG_LIMIT).map((e, i) => (
                <tr key={i} className="border-t border-cream/5 align-top">
                  <td className="px-4 py-3 text-cream/70 font-mono text-xs whitespace-nowrap">
                    {new Date(e.ts).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-cream/80">{e.event}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusTone(
                        e.status,
                      )}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cream/80 whitespace-nowrap">{formatInr(e.amount)}</td>
                  <td className="px-4 py-3 text-cream/70 whitespace-nowrap">
                    {e.method ? (
                      <>
                        {e.method}
                        {e.bank || e.wallet || e.cardNetwork ? (
                          <span className="block text-xs text-cream/45">{e.bank || e.wallet || e.cardNetwork}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-cream/30">—</span>
                    )}
                  </td>
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
          {filtered.length > LOG_LIMIT ? (
            <p className="border-t border-cream/5 px-4 py-3 text-xs text-cream/40">
              Showing the latest {LOG_LIMIT} of {filtered.length} events.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

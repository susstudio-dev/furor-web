import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { readJSON } from '@/lib/storage';
import { PAYMENT_EVENTS_CAP, PAYMENT_EVENTS_KEY, type PaymentEvent } from '@/lib/payment-events';
import { analyze, type Analytics, type Bucket } from '@/lib/payment-analytics';

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

function delta(cur: number | null, prev: number | null | undefined): { text: string; up: boolean } | null {
  if (cur == null || prev == null || prev === 0) return null;
  const d = ((cur - prev) / prev) * 100;
  if (Math.abs(d) < 1) return { text: 'flat vs prev.', up: true };
  return { text: `${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d))}% vs prev.`, up: d > 0 };
}

function Kpi({
  label,
  value,
  sub,
  change,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: { text: string; up: boolean } | null;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-4">
      <p className="text-[11px] uppercase tracking-widest text-cream/40">{label}</p>
      <p
        className={`mt-1 display text-2xl sm:text-3xl font-extrabold ${
          tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-emerald-400' : ''
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-cream/50">
        {change ? (
          <span className={change.up ? 'text-emerald-400' : 'text-red-400'}>{change.text}</span>
        ) : null}
        {change && sub ? ' · ' : ''}
        {sub}
      </p>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5">
      <h2 className="display text-sm font-bold uppercase tracking-widest text-cream/80">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-cream/45">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function HBars({
  rows,
  valueOf,
  fmt,
  barClass = 'bg-ember-500/70',
  empty,
}: {
  rows: Bucket[];
  valueOf: (b: Bucket) => number;
  fmt: (b: Bucket) => string;
  barClass?: string;
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-cream/40">{empty}</p>;
  const max = Math.max(...rows.map(valueOf), 1);
  return (
    <ul className="grid gap-3">
      {rows.slice(0, 6).map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-cream/80 truncate" title={r.label}>
              {r.label}
            </span>
            <span className="text-cream/60 whitespace-nowrap text-xs">{fmt(r)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-cream/5">
            <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${Math.max(3, (valueOf(r) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RevenueChart({ a }: { a: Analytics }) {
  const days = a.days;
  const max = Math.max(...days.map((d) => d.revenue), 1);
  // Thin out x labels so a 90-day chart stays readable.
  const step = Math.max(1, Math.ceil(days.length / 8));
  return (
    <div>
      <div className="flex h-44 items-end gap-[2px]">
        {days.map((d) => (
          <div
            key={d.key}
            className="group relative flex-1 h-full flex flex-col justify-end"
            title={`${d.label}: ${inr(d.revenue)} · ${d.paid} paid · ${d.failed} failed`}
          >
            <div
              className="w-full rounded-t-sm bg-ember-500/80 group-hover:bg-ember-400 transition-colors"
              style={{ height: `${d.revenue > 0 ? Math.max(2, (d.revenue / max) * 100) : 0}%` }}
            />
            {d.failed > 0 ? (
              <div className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-red-400" />
            ) : null}
            <div className={`mt-0.5 h-px w-full ${d.revenue > 0 ? 'bg-transparent' : 'bg-cream/10'}`} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px] text-[10px] text-cream/40">
        {days.map((d, i) => (
          <span key={d.key} className="flex-1 overflow-visible whitespace-nowrap">
            {i % step === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-cream/45">
        Peak {inr(max === 1 && !a.bestDay ? 0 : max)}
        {a.bestDay ? ` on ${a.bestDay.label}` : ''} · <span className="text-red-400">●</span> marks days with a failed payment
      </p>
    </div>
  );
}

function HourStrip({ a }: { a: Analytics }) {
  const max = Math.max(...a.hours.map((h) => h.paid + h.failed), 1);
  const label = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
  return (
    <div>
      <div className="flex h-20 items-end gap-[3px]">
        {a.hours.map((h) => {
          const total = h.paid + h.failed;
          return (
            <div
              key={h.hour}
              className="flex-1 h-full flex flex-col justify-end"
              title={`${label(h.hour)} IST: ${h.paid} paid, ${h.failed} failed`}
            >
              <div className="w-full rounded-t-sm overflow-hidden flex flex-col justify-end" style={{ height: `${(total / max) * 100}%` }}>
                <div className="bg-red-400/70" style={{ flex: h.failed }} />
                <div className="bg-emerald-400/70" style={{ flex: h.paid }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-cream/40">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
    </div>
  );
}

function insightsFor(a: Analytics): string[] {
  const out: string[] = [];
  const totalFailed = a.failed;

  if (a.successRate != null && a.paid + a.failed >= 5) {
    out.push(
      a.successRate >= 0.85
        ? `Checkout is healthy: ${pct(a.successRate)} of payment attempts succeed.`
        : `Only ${pct(a.successRate)} of payment attempts succeed — ${a.failed} failed out of ${a.paid + a.failed}. Worth investigating.`,
    );
  }
  if (a.reasons.length && totalFailed >= 2) {
    const r = a.reasons[0];
    out.push(`Top failure cause: “${r.label}” — ${r.count} of ${totalFailed} failures (${Math.round((r.count / totalFailed) * 100)}%).`);
  }
  const worst = a.methods
    .map((m) => ({ ...m, total: m.count + (m.extra ?? 0), fail: (m.extra ?? 0) / Math.max(1, m.count + (m.extra ?? 0)) }))
    .filter((m) => m.total >= 4 && m.label !== 'Unknown')
    .sort((x, y) => y.fail - x.fail)[0];
  if (worst && worst.fail >= 0.25) {
    out.push(`${worst.label} fails ${pct(worst.fail)} of the time (${worst.extra} of ${worst.total}) — the weakest payment method.`);
  }
  if (a.lost.count > 0) {
    out.push(`${a.lost.count} ${a.lost.count === 1 ? 'person' : 'people'} tried to pay, failed and never came back — ${inr(a.lost.value)} of lost bookings you can chase (see follow-up list).`);
  }
  if (a.recovered.count > 0) {
    out.push(`${a.recovered.count} failed ${a.recovered.count === 1 ? 'payer' : 'payers'} retried and paid — ${inr(a.recovered.value)} recovered.`);
  }
  if (a.authorizedStuck > 0) {
    out.push(`${a.authorizedStuck} payment${a.authorizedStuck === 1 ? ' was' : 's were'} authorized but never captured — Razorpay will auto-refund them. Check the capture setting.`);
  }
  const peak = [...a.hours].sort((x, y) => y.paid - x.paid)[0];
  if (peak && peak.paid >= 3) {
    out.push(`Most payments land around ${peak.hour % 12 === 0 ? 12 : peak.hour % 12}${peak.hour < 12 ? ' AM' : ' PM'} IST — a good time to post offers or reminders.`);
  }
  if (a.repeatCustomers > 0) {
    out.push(`${a.repeatCustomers} repeat customer${a.repeatCustomers === 1 ? '' : 's'} paid more than once.`);
  }
  return out;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; range?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { filter, range } = await searchParams;
  const activeRange = RANGES.find((r) => r.k === range) ?? RANGES[1];
  const events = (await readJSON<PaymentEvent[]>(PAYMENT_EVENTS_KEY)) ?? [];
  const a = analyze(events, activeRange.days);
  const insights = insightsFor(a);
  const all = events.slice().reverse();

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
        Built from Razorpay&apos;s server-to-server events, so failed and abandoned payments are included. Each
        payment is counted once, however many events Razorpay sent for it.
      </p>

      {!a.hasData ? (
        <div className="mt-8 rounded-2xl border border-cream/10 bg-ink-900/40 p-6">
          <p className="text-cream/70">No events yet.</p>
          <p className="mt-2 text-cream/50 text-sm">
            If you expect events here, check that <code className="text-ember-400">RAZORPAY_WEBHOOK_SECRET</code> is set
            on Vercel and the webhook URL in the Razorpay dashboard points to{' '}
            <code className="text-ember-400">/api/razorpay/webhook</code>.
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

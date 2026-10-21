import type { PaymentEvent } from './payment-events';

// Pure analytics over the webhook event log. Razorpay sends several events per
// real payment (authorized → captured, or failed, plus order/link echoes), so
// everything is computed per *attempt* (one per paymentId) in its final state,
// never per raw event — otherwise revenue and failure counts get inflated.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AttemptState = 'paid' | 'failed' | 'authorized';

export interface Attempt {
  id: string;
  state: AttemptState;
  ts: number; // time of the first event
  lastTs: number;
  amount: number; // paise
  email: string | null;
  contact: string | null;
  customer: string | null; // stable key: email, else phone
  method: string | null;
  reason: string | null; // human-readable failure reason
  errorCode: string | null;
  errorStep: string | null;
  refunded: number; // paise
}

export interface DayPoint {
  key: string; // YYYY-MM-DD (IST)
  label: string;
  revenue: number; // rupees
  paid: number;
  failed: number;
}

export interface Bucket {
  label: string;
  count: number;
  value: number; // rupees
  extra?: number;
}

export interface Lead {
  customer: string;
  email: string | null;
  contact: string | null;
  amount: number; // rupees, most recent failed
  reason: string | null;
  ts: number;
  tries: number;
}

export interface Analytics {
  rangeDays: number | null;
  hasData: boolean;
  revenue: number; // rupees, net of refunds
  gross: number;
  refunded: number;
  paid: number;
  failed: number;
  authorizedStuck: number;
  successRate: number | null; // 0..1
  aov: number | null;
  uniqueCustomers: number;
  repeatCustomers: number;
  prev: { revenue: number; paid: number; successRate: number | null } | null;
  days: DayPoint[];
  reasons: Bucket[];
  methods: Bucket[]; // count = paid, extra = failed
  prices: Bucket[];
  hours: { hour: number; paid: number; failed: number }[];
  recovered: { count: number; value: number };
  lost: { count: number; value: number; leads: Lead[] };
  bestDay: DayPoint | null;
}

const isPaidStatus = (s: string) => /captur|paid|success/i.test(s);
const isFailStatus = (s: string) => /fail|error/i.test(s);
const isAuthStatus = (s: string) => /author/i.test(s);

function istDayKey(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function istHour(ms: number): number {
  return new Date(ms + IST_OFFSET_MS).getUTCHours();
}

function dayLabel(key: string): string {
  const [, m, d] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d)} ${months[Number(m) - 1]}`;
}

const METHOD_NAMES: Record<string, string> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Netbanking',
  wallet: 'Wallet',
  emi: 'EMI',
  paylater: 'Pay later',
};

/** Collapse raw events into one record per payment attempt. */
export function buildAttempts(events: PaymentEvent[]): Attempt[] {
  // payment_link.* / order.* echo the same payment under a different entity id.
  // When real payment.* events exist, ignore the echoes so nothing double-counts.
  const hasPaymentEvents = events.some((e) => e.event.startsWith('payment.'));
  const map = new Map<string, Attempt>();
  const refunds = new Map<string, number>();

  events.forEach((e, i) => {
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) return;

    if (e.event.startsWith('refund.')) {
      if (e.paymentId && /processed|created/i.test(e.status + e.event) && e.amount) {
        // refund.created + refund.processed both fire — keep the larger, not the sum.
        refunds.set(e.paymentId, Math.max(refunds.get(e.paymentId) ?? 0, e.amount));
      }
      return;
    }
    if (hasPaymentEvents && !e.event.startsWith('payment.')) return;

    const id = e.paymentId ?? `evt-${i}`;
    const state: AttemptState | null = isPaidStatus(e.status)
      ? 'paid'
      : isFailStatus(e.status) || isFailStatus(e.event)
      ? 'failed'
      : isAuthStatus(e.status)
      ? 'authorized'
      : null;
    if (!state) return;

    const prev = map.get(id);
    const email = e.email?.trim().toLowerCase() || null;
    const contact = e.contact?.trim() || null;
    if (!prev) {
      map.set(id, {
        id,
        state,
        ts: t,
        lastTs: t,
        amount: e.amount ?? 0,
        email,
        contact,
        customer: email ?? contact,
        method: e.method ?? null,
        reason: e.errorDescription ?? e.errorReason ?? null,
        errorCode: e.errorCode ?? null,
        errorStep: e.errorStep ?? null,
        refunded: 0,
      });
      return;
    }
    // Precedence: paid beats everything; failed beats authorized.
    const rank = { authorized: 0, failed: 1, paid: 2 } as const;
    if (rank[state] >= rank[prev.state]) prev.state = state;
    prev.lastTs = Math.max(prev.lastTs, t);
    prev.ts = Math.min(prev.ts, t);
    prev.amount = Math.max(prev.amount, e.amount ?? 0);
    prev.email ??= email;
    prev.contact ??= contact;
    prev.customer ??= email ?? contact;
    prev.method ??= e.method ?? null;
    prev.reason ??= e.errorDescription ?? e.errorReason ?? null;
    prev.errorCode ??= e.errorCode ?? null;
    prev.errorStep ??= e.errorStep ?? null;
  });

  for (const [pid, amt] of refunds) {
    const a = map.get(pid);
    if (a && a.state === 'paid') a.refunded = Math.min(amt, a.amount || amt);
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts);
}

function bump(m: Map<string, Bucket>, label: string, value: number, extra = 0) {
  const b = m.get(label) ?? { label, count: 0, value: 0, extra: 0 };
  b.count += 1;
  b.value += value;
  b.extra = (b.extra ?? 0) + extra;
  m.set(label, b);
}

function summarize(list: Attempt[]) {
  let revenue = 0;
  let paid = 0;
  let failed = 0;
  for (const a of list) {
    if (a.state === 'paid') {
      paid++;
      revenue += (a.amount - a.refunded) / 100;
    } else if (a.state === 'failed') failed++;
  }
  return { revenue, paid, failed, successRate: paid + failed > 0 ? paid / (paid + failed) : null };
}

export function analyze(events: PaymentEvent[], rangeDays: number | null, now = Date.now()): Analytics {
  const everything = buildAttempts(events);

  // Day boundaries are IST midnights so "last 7 days" matches the owner's calendar.
  const todayStart = Date.parse(istDayKey(now) + 'T00:00:00Z') - IST_OFFSET_MS;
  const from = rangeDays ? todayStart - (rangeDays - 1) * DAY_MS : -Infinity;
  const attempts = everything.filter((a) => a.ts >= from);

  const prevAttempts = rangeDays
    ? everything.filter((a) => a.ts >= from - rangeDays * DAY_MS && a.ts < from)
    : null;

  const s = summarize(attempts);
  let gross = 0;
  let refunded = 0;
  let authorizedStuck = 0;
  const reasons = new Map<string, Bucket>();
  const methods = new Map<string, Bucket>();
  const prices = new Map<string, Bucket>();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, paid: 0, failed: 0 }));
  const dayMap = new Map<string, DayPoint>();

  const firstKey = rangeDays ? istDayKey(from) : attempts[0] ? istDayKey(attempts[0].ts) : istDayKey(now);
  for (let t = Date.parse(firstKey + 'T00:00:00Z'); t <= Date.parse(istDayKey(now) + 'T00:00:00Z'); t += DAY_MS) {
    const key = new Date(t).toISOString().slice(0, 10);
    dayMap.set(key, { key, label: dayLabel(key), revenue: 0, paid: 0, failed: 0 });
  }

  for (const a of attempts) {
    const day = dayMap.get(istDayKey(a.ts));
    const rupees = a.amount / 100;
    if (a.state === 'paid') {
      gross += rupees;
      refunded += a.refunded / 100;
      if (day) {
        day.paid++;
        day.revenue += (a.amount - a.refunded) / 100;
      }
      hours[istHour(a.ts)].paid++;
      bump(methods, METHOD_NAMES[a.method ?? ''] ?? a.method ?? 'Unknown', rupees);
      if (a.amount > 0) bump(prices, `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, rupees);
    } else if (a.state === 'failed') {
      if (day) day.failed++;
      hours[istHour(a.ts)].failed++;
      bump(reasons, a.reason ?? a.errorCode ?? 'No reason given', rupees);
      const m = methods.get(METHOD_NAMES[a.method ?? ''] ?? a.method ?? 'Unknown');
      if (m) m.extra = (m.extra ?? 0) + 1;
      else
        methods.set(METHOD_NAMES[a.method ?? ''] ?? a.method ?? 'Unknown', {
          label: METHOD_NAMES[a.method ?? ''] ?? a.method ?? 'Unknown',
          count: 0,
          value: 0,
          extra: 1,
        });
    } else if (now - a.lastTs > 60 * 60 * 1000) {
      authorizedStuck++; // authorized >1h ago and never captured → likely auto-refunded
    }
  }

  // Customers: who paid, who came back, and who failed without ever paying.
  const paidBy = new Map<string, number>();
  for (const a of everything) if (a.state === 'paid' && a.customer) paidBy.set(a.customer, (paidBy.get(a.customer) ?? 0) + 1);
  const periodCustomers = new Set<string>();
  for (const a of attempts) if (a.state === 'paid' && a.customer) periodCustomers.add(a.customer);
  const repeatCustomers = [...periodCustomers].filter((c) => (paidBy.get(c) ?? 0) > 1).length;

  const failedBy = new Map<string, Attempt[]>();
  for (const a of attempts) if (a.state === 'failed' && a.customer) failedBy.set(a.customer, [...(failedBy.get(a.customer) ?? []), a]);
  const recovered = { count: 0, value: 0 };
  const lost = { count: 0, value: 0, leads: [] as Lead[] };
  for (const [customer, fails] of failedBy) {
    const last = fails[fails.length - 1];
    const paidAfter = everything.find((p) => p.customer === customer && p.state === 'paid' && p.ts >= fails[0].ts);
    if (paidAfter) {
      recovered.count++;
      recovered.value += paidAfter.amount / 100;
    } else {
      lost.count++;
      lost.value += last.amount / 100;
      lost.leads.push({
        customer,
        email: last.email,
        contact: last.contact,
        amount: last.amount / 100,
        reason: last.reason,
        ts: last.lastTs,
        tries: fails.length,
      });
    }
  }
  lost.leads.sort((a, b) => b.ts - a.ts);

  const days = [...dayMap.values()];
  const bestDay = days.reduce<DayPoint | null>((best, d) => (d.revenue > (best?.revenue ?? 0) ? d : best), null);
  const sortDesc = (m: Map<string, Bucket>) => [...m.values()].sort((a, b) => b.count - a.count || b.value - a.value);

  return {
    rangeDays,
    hasData: everything.length > 0,
    revenue: s.revenue,
    gross,
    refunded,
    paid: s.paid,
    failed: s.failed,
    authorizedStuck,
    successRate: s.successRate,
    aov: s.paid ? s.revenue / s.paid : null,
    uniqueCustomers: periodCustomers.size,
    repeatCustomers,
    prev: prevAttempts ? summarize(prevAttempts) : null,
    days,
    reasons: sortDesc(reasons),
    methods: sortDesc(methods),
    prices: sortDesc(prices),
    hours,
    recovered,
    lost,
    bestDay,
  };
}

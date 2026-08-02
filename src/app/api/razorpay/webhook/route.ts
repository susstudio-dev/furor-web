import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { readJSON, writeJSON } from '@/lib/storage';

// Razorpay webhook receiver. Razorpay POSTs an event here for EVERY payment
// outcome — including `payment.failed` — server-to-server, so it does not
// depend on the customer's browser returning to /welcome (the redirect only
// fires on success). This is the only way to see failed/abandoned payments.
//
// Setup (Razorpay Dashboard → Settings → Webhooks → Add New Webhook):
//   • URL    : https://www.dancehyderabad.com/api/razorpay/webhook
//   • Secret : a strong random string you choose — also set it in Vercel as
//              RAZORPAY_WEBHOOK_SECRET (Production + Preview).
//   • Events : payment.captured + payment.failed (required). refund.* and
//              payment_link.* are optional — handled here too if you tick them.
//
// This route is server-only; the GitHub Pages static mirror strips src/app/api
// in CI, so it never needs to exist there.

export const runtime = 'nodejs';

const EVENTS_KEY = 'payment-events.json';
const CAP = 1000; // keep the most recent N events

interface PaymentEvent {
  ts: string;
  event: string;
  status: string;
  paymentId: string | null;
  amount: number | null; // in paise, as Razorpay sends it
  email: string | null;
  contact: string | null;
  errorDescription: string | null;
}

// Constant-time compare so we never leak signature bytes via timing.
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfig, not a client error. Don't 200 it — Razorpay will retry, and a
    // 5xx makes the failure visible in the dashboard's webhook log.
    console.error('razorpay webhook: RAZORPAY_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Signature is an HMAC-SHA256 over the EXACT raw body, so read text() — never
  // re-stringify a parsed object (key order / whitespace would change the hash).
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') ?? '';
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (!sig || !safeEqualHex(sig, expected)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // The event name (e.g. "payment.failed", "refund.processed") tells us which
  // entity Razorpay nested under payload.<kind>.entity. payment.* → payment,
  // refund.* → refund, payment_link.* → payment_link. We pick the first entity
  // present so every ticked event logs with real data, not blanks.
  const event = String(body.event ?? 'unknown');
  const payload = (body.payload as Record<string, unknown> | undefined) ?? {};
  const entityOf = (kind: string): Record<string, unknown> | undefined =>
    (payload[kind] as Record<string, unknown> | undefined)?.entity as
      | Record<string, unknown>
      | undefined;

  const kind = event.split('.')[0]; // 'payment' | 'refund' | 'payment_link' | ...
  // Prefer the entity matching the event; fall back to a payment entity if
  // Razorpay also bundled one (refund events include the parent payment).
  const e = entityOf(kind) ?? entityOf('payment') ?? entityOf('refund') ?? {};
  // refund.* carries the refunded payment under payment_id; payment.* uses id.
  const paymentId = (e.payment_id as string) ?? (e.id as string) ?? null;

  const record: PaymentEvent = {
    ts: new Date().toISOString(),
    event,
    status: String(e.status ?? event),
    paymentId,
    amount: typeof e.amount === 'number' ? e.amount : null,
    email: (e.email as string) ?? null,
    contact: (e.contact as string) ?? null,
    errorDescription: (e.error_description as string) ?? null,
  };

  // Persist best-effort. We always 200 after a valid signature so Razorpay
  // doesn't retry a delivery we already accepted; a storage hiccup is logged
  // but must not turn into a 5xx retry storm.
  try {
    const log = (await readJSON<PaymentEvent[]>(EVENTS_KEY)) ?? [];
    log.push(record);
    if (log.length > CAP) log.splice(0, log.length - CAP);
    await writeJSON(EVENTS_KEY, log);
  } catch (err) {
    console.error('razorpay webhook: failed to persist event', err);
  }

  return NextResponse.json({ ok: true });
}

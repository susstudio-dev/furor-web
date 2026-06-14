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
//   • Events : payment.failed (+ payment.captured / payment_link.* if wanted).
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

  // Razorpay nests the payment entity under payload.payment.entity.
  const event = String(body.event ?? 'unknown');
  const payment =
    (((body.payload as Record<string, unknown> | undefined)?.payment as
      | Record<string, unknown>
      | undefined)?.entity as Record<string, unknown> | undefined) ?? {};

  const record: PaymentEvent = {
    ts: new Date().toISOString(),
    event,
    status: String(payment.status ?? event),
    paymentId: (payment.id as string) ?? null,
    amount: typeof payment.amount === 'number' ? payment.amount : null,
    email: (payment.email as string) ?? null,
    contact: (payment.contact as string) ?? null,
    errorDescription: (payment.error_description as string) ?? null,
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

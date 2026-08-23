// Staleness detection for the Razorpay event log shown on /admin/payments.
//
// Exists because of a real outage: during the Vercel → Workers cutover the
// webhook 500'd for days (no RAZORPAY_WEBHOOK_SECRET on the Worker yet),
// Razorpay auto-deactivated it after 24h of failures, and deliveries never
// resumed — while the admin page kept rendering the 105 migrated events with
// nothing to say that the newest one was weeks old. A silent gap in a payment
// log reads as "no payments" when it actually means "no visibility".

/**
 * Days without a single webhook delivery before the admin page warns.
 *
 * The studio takes a handful of payments a week (batches + the Saturday
 * social), so a week of total silence is far outside normal cadence while
 * still tolerant of a slow week. This is a visibility warning, not an alarm
 * on hard evidence — the copy it drives says "if you've taken payments
 * since", leaving room for a genuinely quiet week.
 */
export const STALE_AFTER_DAYS = 7;

export interface PaymentLogStaleness {
  /** Whole days since the newest event, or null when its timestamp is unparseable. */
  days: number | null;
}

/**
 * Non-null when the newest event is old enough that the webhook is probably
 * not delivering. Null for an empty log (the page's empty state covers that)
 * and while the log is fresh.
 */
export function paymentLogStaleness(
  events: { ts: string }[],
  now: Date,
): PaymentLogStaleness | null {
  if (events.length === 0) return null;
  // Newest by timestamp, not by position — the log is append-ordered today,
  // but this must not silently trust that forever.
  let newest = Number.NEGATIVE_INFINITY;
  for (const e of events) {
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) continue;
    if (t > newest) newest = t;
  }
  if (newest === Number.NEGATIVE_INFINITY) {
    // Every timestamp is garbage. That is not freshness — surface it.
    return { days: null };
  }
  const days = Math.floor((now.getTime() - newest) / 86400_000);
  return days > STALE_AFTER_DAYS ? { days } : null;
}

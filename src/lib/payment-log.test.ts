import { describe, expect, it } from 'vitest';
import { paymentLogStaleness, STALE_AFTER_DAYS } from './payment-log';

// The failure mode this guards: the webhook silently stops delivering (it
// happened for real — Razorpay deactivated the webhook during the Vercel →
// Workers cutover after >24h of 500s) while /admin/payments kept rendering
// 105 old events as if everything were fine. Staleness must be LOUD.
describe('paymentLogStaleness', () => {
  const now = new Date('2026-08-23T12:00:00Z');
  const at = (iso: string) => ({ ts: iso });

  it('is null for an empty log — the page has its own empty state', () => {
    expect(paymentLogStaleness([], now)).toBeNull();
  });

  it('is null while the newest event is fresh', () => {
    expect(paymentLogStaleness([at('2026-08-22T09:00:00Z')], now)).toBeNull();
  });

  it('is null exactly at the threshold, stale one day past it', () => {
    const edge = new Date(now.getTime() - STALE_AFTER_DAYS * 86400_000);
    expect(paymentLogStaleness([at(edge.toISOString())], now)).toBeNull();
    const past = new Date(edge.getTime() - 86400_000);
    expect(paymentLogStaleness([at(past.toISOString())], now)).toEqual({ days: STALE_AFTER_DAYS + 1 });
  });

  // The real incident's shape: last event 2026-07-30, checked 2026-08-23.
  it('reports whole days since the newest event', () => {
    expect(paymentLogStaleness([at('2026-06-14T16:31:24Z'), at('2026-07-30T16:52:00Z')], now)).toEqual({
      days: 23,
    });
  });

  it('uses the NEWEST event even if the log is unordered', () => {
    expect(
      paymentLogStaleness([at('2026-08-22T09:00:00Z'), at('2026-05-01T00:00:00Z')], now),
    ).toBeNull();
  });

  it('treats an unparseable newest timestamp as stale-unknown rather than fresh', () => {
    expect(paymentLogStaleness([at('not-a-date')], now)).toEqual({ days: null });
  });
});

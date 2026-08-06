import { describe, expect, it } from 'vitest';
import { resolveWelcomeState } from './welcome-confirm';

// The post-payment page's confirmation decision.
//
// The regression this pins: five of six live booking links are Razorpay
// Payment PAGES, whose success redirect carries NO query parameters — only
// Payment LINKS append razorpay_payment_id / razorpay_payment_link_status.
// The old logic required those params, so every real Payment-Pages customer
// landed on "We couldn't confirm your payment yet" seconds after paying.

const resolve = (query: string) => resolveWelcomeState(new URLSearchParams(query));

describe('resolveWelcomeState', () => {
  // The Payment Pages case — a bare success redirect. THE fix.
  it('confirms a bare redirect with no params at all', () => {
    expect(resolve('').confirmed).toBe(true);
  });

  it('confirms a redirect that only pins a batch', () => {
    expect(resolve('d=2026-08-29').confirmed).toBe(true);
    expect(resolve('b=batch-007').confirmed).toBe(true);
  });

  // The Payment Links happy paths, unchanged.
  it('confirms an explicit paid status', () => {
    const s = resolve('razorpay_payment_link_status=paid&razorpay_payment_id=pay_x');
    expect(s.confirmed).toBe(true);
    expect(s.paymentId).toBe('pay_x');
  });

  it('confirms a payment id with no status', () => {
    expect(resolve('razorpay_payment_id=pay_x').confirmed).toBe(true);
  });

  it('treats partially_paid as confirmed', () => {
    // A ₹500 token cannot be meaningfully part-paid; if Razorpay says money
    // moved, the welcome page is not the place to argue.
    expect(resolve('razorpay_payment_link_status=partially_paid').confirmed).toBe(true);
  });

  // The rule is an allow-list: paid/partially_paid (or no status at all)
  // confirm; EVERYTHING else does not. 'created' is the real Razorpay status
  // for an abandoned Payment Link.
  it.each(['cancelled', 'expired', 'created'])(
    'does not confirm a %s status',
    (status) => {
      expect(resolve(`razorpay_payment_link_status=${status}`).confirmed).toBe(false);
    },
  );

  it('does not confirm a status value it has never seen', () => {
    // A status added by Razorpay later must never read as money received.
    expect(resolve('razorpay_payment_link_status=settled_v2').confirmed).toBe(false);
  });

  it('is case-insensitive about the status value', () => {
    expect(resolve('razorpay_payment_link_status=PAID').confirmed).toBe(true);
    expect(resolve('razorpay_payment_link_status=Cancelled').confirmed).toBe(false);
  });

  it('carries the payment id through the unconfirmed state for the help message', () => {
    const s = resolve('razorpay_payment_link_status=cancelled&razorpay_payment_id=pay_y');
    expect(s.confirmed).toBe(false);
    expect(s.paymentId).toBe('pay_y');
  });
});

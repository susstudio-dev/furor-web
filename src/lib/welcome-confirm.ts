// The post-payment page's confirmation decision, as a pure function.
//
// Which Razorpay product sent the visitor decides what the URL carries:
//   - Payment LINKS (rzp.io/…) with a callback URL append razorpay_payment_id,
//     razorpay_payment_link_status, etc. — an explicit signal either way.
//   - Payment PAGES (pages.razorpay.com/…) redirect on success with NO query
//     parameters at all. Most of the studio's live booking links are Pages.
//
// So the rule is an ALLOW-LIST with a confirmed default: confirmed when the
// URL carries NO status at all (the Pages redirect, and hand-typed visits —
// the page grants nothing; the webhook log is the studio's real payment
// record) or a status of paid/partially_paid. EVERY other status value,
// known or unknown, is unconfirmed — deliberately, so a status this code
// does not recognise never reads as money received. Requiring Link-style
// params had shown every real Pages customer "we couldn't confirm your
// payment" seconds after they paid.

export interface WelcomeState {
  confirmed: boolean;
  /** Razorpay's payment reference, when the redirect carried one. */
  paymentId: string | null;
}

const CONFIRMED_STATUSES = new Set(['paid', 'partially_paid']);

export function resolveWelcomeState(query: URLSearchParams): WelcomeState {
  const status = query.get('razorpay_payment_link_status')?.toLowerCase() ?? null;
  const paymentId = query.get('razorpay_payment_id');

  return {
    confirmed: status === null || CONFIRMED_STATUSES.has(status),
    paymentId,
  };
}

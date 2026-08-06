// The post-payment page's confirmation decision, as a pure function.
//
// Which Razorpay product sent the visitor decides what the URL carries:
//   - Payment LINKS (rzp.io/…) with a callback URL append razorpay_payment_id,
//     razorpay_payment_link_status, etc. — an explicit signal either way.
//   - Payment PAGES (pages.razorpay.com/…) redirect on success with NO query
//     parameters at all. Most of the studio's live booking links are Pages.
//
// So the default must be CONFIRMED: the only organic way a customer arrives
// here is Razorpay's own success redirect, and requiring Link-style params
// showed every real Pages customer "we couldn't confirm your payment" seconds
// after they paid. The unconfirmed state is reserved for explicit failure
// signals. Someone hand-typing the URL sees a welcome page that grants
// nothing — the studio's real payment record is the webhook log, and intake
// is verified in person.

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

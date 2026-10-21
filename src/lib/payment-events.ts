// Shape of a persisted Razorpay webhook event. Shared by the webhook route
// (writer) and the admin payments dashboard (reader). Fields after
// `errorDescription` were added later, so they are optional — older stored
// events simply lack them.
export const PAYMENT_EVENTS_KEY = 'payment-events.json';
export const PAYMENT_EVENTS_CAP = 2000;

export interface PaymentEvent {
  ts: string;
  event: string;
  status: string;
  paymentId: string | null;
  amount: number | null; // paise
  email: string | null;
  contact: string | null;
  errorDescription: string | null;
  method?: string | null; // card | upi | netbanking | wallet | emi ...
  bank?: string | null;
  wallet?: string | null;
  cardNetwork?: string | null;
  errorCode?: string | null;
  errorReason?: string | null;
  errorSource?: string | null;
  errorStep?: string | null;
  orderId?: string | null;
  fee?: number | null; // paise
  notes?: Record<string, string> | null;
}

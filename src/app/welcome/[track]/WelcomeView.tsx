'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal';

interface Props {
  track: string;
  trackLabel: string;
  intakeDate: string | null;
  whenDays: string;
  whenTime: string;
  arriveBy: string;
  venue: string;
  mapUrl: string | null;
  waNumber: string;
  waDisplay: string;
  gcalUrl: string | null;
  icsHref: string | null;
  vcardHref: string;
}

interface Payment {
  status: string | null;
  paymentId: string | null;
}

export function WelcomeView({
  track,
  trackLabel,
  intakeDate,
  whenDays,
  whenTime,
  arriveBy,
  venue,
  mapUrl,
  waNumber,
  waDisplay,
  gcalUrl,
  icsHref,
  vcardHref,
}: Props) {
  // Razorpay appends its result to the redirect URL
  // (razorpay_payment_link_status, razorpay_payment_id, …). We read it on the
  // client so this works identically on the server deployment and the static
  // (GitHub Pages) export — neither can rely on server-side searchParams here.
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const status = q.get('razorpay_payment_link_status');
    const paymentId = q.get('razorpay_payment_id');
    setPayment({ status, paymentId });

    const ok = !status || status.toLowerCase() === 'paid';
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (w.gtag) {
      w.gtag('event', ok ? 'registration_confirmed' : 'registration_unconfirmed', {
        track,
        status: status ?? 'none',
        payment_id: paymentId ?? null,
      });
    }
  }, [track]);

  // Optimistic: unknown (no params / before the effect runs) is treated as
  // confirmed, so the common success case renders immediately and SSR matches
  // the first client render. A genuinely failed payment flips after mount.
  const confirmed = !payment || !payment.status || payment.status.toLowerCase() === 'paid';
  const paymentId = payment?.paymentId ?? null;

  const waText = (msg: string) => `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  const confirmMsg =
    `Hi Furor! I just registered for the ${trackLabel}.` +
    (paymentId ? ` My payment reference is ${paymentId}.` : '') +
    ` Could you please confirm my spot and start date?`;
  const helpMsg =
    `Hi Furor! I tried to register for the ${trackLabel} but I'm not sure my payment went through` +
    (paymentId ? ` (payment reference ${paymentId})` : '') +
    `. Can you help me confirm?`;

  // ── Payment could not be confirmed ─────────────────────────────────────────
  if (!confirmed) {
    return (
      <section className="container-x pt-20 pb-24">
        <Reveal className="mx-auto max-w-xl rounded-3xl border border-cream/10 bg-ink-900/40 p-8 text-center sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-1.5 text-xs uppercase tracking-widest text-gold-400">
            Payment not confirmed
          </span>
          <h1 className="mt-6 display text-3xl font-extrabold tracking-tight sm:text-4xl">
            We couldn’t confirm your payment yet
          </h1>
          <p className="mt-4 text-cream/80">
            It looks like the payment for your{' '}
            <span className="font-semibold text-cream">{trackLabel}</span> didn’t complete. If any
            money was deducted, don’t worry — message us and we’ll sort it out right away.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href={waText(helpMsg)} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Message us on WhatsApp
            </a>
            <Link href="/batches" className="btn-secondary">
              Try again
            </Link>
          </div>
          {paymentId ? (
            <p className="mt-6 text-xs text-cream/40">Reference: {paymentId}</p>
          ) : null}
        </Reveal>
      </section>
    );
  }

  // ── Registration confirmed ─────────────────────────────────────────────────
  return (
    <>
      {/* Confirmation hero */}
      <section className="container-x pt-20 pb-10 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-ember-500/40 bg-ember-500/10 px-4 py-1.5 text-xs uppercase tracking-widest text-ember-400">
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500" /> Registration confirmed
          </span>
          <h1 className="mt-6 display text-4xl font-extrabold tracking-tight sm:text-6xl">
            You’re in. 🎉
          </h1>
          <p className="mt-5 mx-auto max-w-2xl text-lg text-cream/80">
            {intakeDate ? (
              <>
                Reminder: your <span className="font-semibold text-cream">{trackLabel}</span>{' '}
                intake is on <span className="font-semibold text-ember-400">{intakeDate}</span>.
              </>
            ) : (
              <>
                Reminder: your <span className="font-semibold text-cream">{trackLabel}</span>{' '}
                intake is this coming weekend — we’ll confirm the exact date on WhatsApp.
              </>
            )}
          </p>
          <p className="mt-4 mx-auto max-w-2xl text-cream/70">
            Thank you for registering — this is the first step in your dance journey. Here are a
            couple of things to do right away.
          </p>
          {paymentId ? (
            <p className="mt-5 inline-block rounded-full border border-cream/10 bg-ink-900/50 px-4 py-1.5 text-xs text-cream/55">
              Payment reference: <span className="text-cream/80">{paymentId}</span>
            </p>
          ) : null}
        </Reveal>
      </section>

      {/* The two immediate steps */}
      <section className="container-x pb-4">
        <Reveal stagger className="grid gap-5 md:grid-cols-2">
          {/* Step 1 — save number */}
          <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-7">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-500 display text-lg font-bold text-ink-950">
              1
            </div>
            <p className="mt-4 display text-xl font-bold">Save our WhatsApp number</p>
            <p className="mt-2 leading-relaxed text-cream/75">
              Save <span className="font-semibold text-cream">{waDisplay}</span> as{' '}
              <span className="font-semibold text-cream">“Furor Hyderabad”</span> — so you get timely
              reminders for your class and can reach us anytime.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={vcardHref} download="Furor Hyderabad.vcf" className="btn-primary inline-flex">
                Save contact
              </a>
              <a
                href={waText(confirmMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex"
              >
                Message us →
              </a>
            </div>
          </div>

          {/* Step 2 — add to calendar / show up */}
          <div className="rounded-3xl border border-cream/10 bg-ink-900/40 p-7">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-500 display text-lg font-bold text-ink-950">
              2
            </div>
            <p className="mt-4 display text-xl font-bold">Add it to your calendar</p>
            <p className="mt-2 leading-relaxed text-cream/75">
              Come early by <span className="font-semibold text-cream">{arriveBy}</span> to sort out
              your registration. Add a reminder so the date doesn’t slip.
            </p>
            {gcalUrl || icsHref ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {gcalUrl ? (
                  <a
                    href={gcalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex"
                  >
                    Google Calendar
                  </a>
                ) : null}
                {icsHref ? (
                  <a href={icsHref} download="furor-class.ics" className="btn-secondary inline-flex">
                    Apple / Outlook (.ics)
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-sm text-cream/55">
                We’ll confirm the exact date on WhatsApp and send you a reminder.
              </p>
            )}
          </div>
        </Reveal>
      </section>

      {/* Intake details */}
      <section className="container-x py-10">
        <Reveal className="rounded-3xl border border-cream/10 bg-ink-900/40 p-8 sm:p-10">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Your intake details</p>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-cream/50">Where</p>
              <p className="mt-2 leading-relaxed text-cream/85">
                {venue || 'We’ll share the exact address on WhatsApp.'}
              </p>
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary mt-4 inline-flex"
                >
                  Open map →
                </a>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-cream/50">When</p>
              <p className="mt-2 leading-relaxed text-cream/85">
                Every <span className="font-semibold text-cream">{whenDays}</span>
                <br />
                {whenTime}
              </p>
              <p className="mt-2 text-sm text-cream/60">
                Please arrive by {arriveBy} for registration.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-cream/50">What to wear &amp; bring</p>
              <ul className="mt-2 space-y-1.5 leading-relaxed text-cream/85">
                <li>• Smart comfort wear — tees / tracks</li>
                <li>• Fresh socks (for footwear)</li>
                <li>• A personal water bottle / sipper — refill at the studio</li>
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Sign-off */}
      <section className="container-x pb-24">
        <Reveal className="rounded-3xl bg-gradient-to-br from-ember-700 via-ember-600 to-gold-500 p-10 text-ink-950 sm:p-14">
          <p className="display text-3xl font-extrabold tracking-tight sm:text-4xl">
            See you all in class! 💃🕺
          </p>
          <p className="mt-4 max-w-xl text-ink-950/80">
            Any questions before then? Just message us on WhatsApp — we reply fast.
          </p>
          <div className="mt-6">
            <a
              href={waText(confirmMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary !bg-ink-950 !text-cream hover:!bg-ink-800"
            >
              Chat on WhatsApp
            </a>
          </div>
          <p className="mt-8 font-semibold text-ink-950/90">Cheers, Rish</p>
          <p className="text-sm text-ink-950/70">Furor Hyderabad · Dance for Life</p>
        </Reveal>
      </section>
    </>
  );
}

'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal';
import type { Welcome } from '@/lib/content-schema';
import { resolveWelcomeState, type WelcomeState } from '@/lib/welcome-confirm';

// Everything the page shows for one batch, precomputed server-side. The client
// picks the right one from the ?d=/?b= redirect param.
export interface BatchBundle {
  id: string;
  startDate: string; // '' when there is no live batch
  intakeDate: string | null;
  whenDays: string;
  whenTime: string;
  arriveBy: string;
  venue: string;
  mapUrl: string | null;
  gcalUrl: string | null;
  icsHref: string | null;
}

interface Props {
  track: string;
  trackLabel: string;
  copy: Welcome; // admin-editable text templates from content.welcome
  waNumber: string;
  waDisplay: string;
  vcardHref: string;
  defaultBundle: BatchBundle;
  options: BatchBundle[];
}

// Renders an admin-editable copy template, replacing {placeholders} with live
// values shown as bold (or per-placeholder styled) spans.
function Filled({
  template,
  vars,
  classNames,
}: {
  template: string;
  vars: Record<string, string>;
  classNames?: Record<string, string>;
}) {
  const parts = template.split(/(\{[a-zA-Z]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\{([a-zA-Z]+)\}$/.exec(p);
        if (m && vars[m[1]] != null) {
          return (
            <span key={i} className={classNames?.[m[1]] ?? 'font-semibold text-cream'}>
              {vars[m[1]]}
            </span>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function WelcomeView({
  track,
  trackLabel,
  copy,
  waNumber,
  waDisplay,
  vcardHref,
  defaultBundle,
  options,
}: Props) {
  // Payment LINKS append their result to the redirect URL; Payment PAGES —
  // which most of the live booking links are — redirect on success with no
  // params at all. The decision lives in resolveWelcomeState (unit-tested):
  // confirmed unless the URL carries an EXPLICIT failure status. The redirect
  // may also pin a specific batch with ?d=<startDate> or ?b=<batchId>.
  // (To preview the failure state deliberately, append
  // ?razorpay_payment_link_status=cancelled to the URL.)
  const [payment, setPayment] = useState<WelcomeState | null>(null);
  const [bundle, setBundle] = useState<BatchBundle>(defaultBundle);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);

    // Pin the exact batch the customer paid for, if the redirect named one.
    const b = q.get('b');
    const d = q.get('d');
    const picked =
      (b && options.find((o) => o.id === b)) || (d && options.find((o) => o.startDate === d));
    if (picked) setBundle(picked);

    const state = resolveWelcomeState(q);
    setPayment(state);

    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (w.gtag) {
      // The event mirrors resolveWelcomeState exactly, so analytics can never
      // disagree with what the visitor was shown.
      w.gtag('event', state.confirmed ? 'registration_confirmed' : 'registration_unconfirmed', {
        track,
        status: q.get('razorpay_payment_link_status') ?? 'none',
        payment_id: state.paymentId ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  // Before the effect runs (SSR + first client render) stay optimistic so the
  // common success case never flashes the failure layout.
  const confirmed = payment === null || payment.confirmed;
  const paymentId = payment?.paymentId ?? null;

  const { intakeDate, whenDays, whenTime, arriveBy, venue, mapUrl, gcalUrl, icsHref } = bundle;

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
            {copy.unconfirmedBadge}
          </span>
          <h1 className="mt-6 display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {copy.unconfirmedHeadline}
          </h1>
          <p className="mt-4 text-cream/80">
            <Filled template={copy.unconfirmedBody} vars={{ trackLabel }} />
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
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500" /> {copy.confirmedBadge}
          </span>
          <h1 className="mt-6 display text-4xl font-extrabold tracking-tight sm:text-6xl">
            {copy.confirmedHeadline}
          </h1>
          <p className="mt-5 mx-auto max-w-2xl text-lg text-cream/80">
            {intakeDate ? (
              <Filled
                template={copy.reminderWithDate}
                vars={{ trackLabel, date: intakeDate }}
                classNames={{ date: 'font-semibold text-ember-400' }}
              />
            ) : (
              <Filled template={copy.reminderNoDate} vars={{ trackLabel }} />
            )}
          </p>
          <p className="mt-4 mx-auto max-w-2xl text-cream/70">{copy.thankYouBody}</p>
          {paymentId ? (
            <p className="mt-5 inline-block rounded-full border border-cream/10 bg-ink-900/50 px-4 py-1.5 text-xs text-cream/70">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-600 display text-lg font-bold text-on-ember">
              1
            </div>
            <p className="mt-4 display text-xl font-bold">{copy.step1Title}</p>
            <p className="mt-2 leading-relaxed text-cream/75">
              <Filled template={copy.step1Body} vars={{ number: waDisplay }} />
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-600 display text-lg font-bold text-on-ember">
              2
            </div>
            <p className="mt-4 display text-xl font-bold">{copy.step2Title}</p>
            <p className="mt-2 leading-relaxed text-cream/75">
              <Filled template={copy.step2Body} vars={{ arriveBy }} />
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
              <p className="mt-5 text-sm text-cream/70">
                We’ll confirm the exact date on WhatsApp and send you a reminder.
              </p>
            )}
          </div>
        </Reveal>
      </section>

      {/* Intake details */}
      <section className="container-x py-10">
        <Reveal className="rounded-3xl border border-cream/10 bg-ink-900/40 p-8 sm:p-10">
          <p className="display text-sm uppercase tracking-widest text-ember-400">{copy.intakeHeading}</p>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-cream/70">Where</p>
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
              <p className="text-xs uppercase tracking-widest text-cream/70">When</p>
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
              <p className="text-xs uppercase tracking-widest text-cream/70">{copy.whatToBringHeading}</p>
              <ul className="mt-2 space-y-1.5 leading-relaxed text-cream/85">
                {copy.whatToBring.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Sign-off */}
      <section className="container-x pb-24">
        <Reveal className="on-accent accent-panel rounded-3xl p-10 sm:p-14">
          <p className="display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {copy.signoffHeadline}
          </p>
          <p className="mt-4 max-w-xl text-on-ember">{copy.signoffBody}</p>
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
          <p className="mt-8 font-semibold text-on-ember">{copy.signoffName}</p>
          <p className="text-sm text-on-ember">{copy.signoffTagline}</p>
        </Reveal>
      </section>
    </>
  );
}

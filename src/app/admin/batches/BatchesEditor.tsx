'use client';

import { useState } from 'react';
import { randomId } from '@/lib/id';
import type { Batch, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { saveSiteContent } from '@/lib/admin-save';
import { formatBatchDate, formatInr, todayIso, addDaysIso } from '@/lib/format';
import { DEFAULT_JOIN_GRACE_DAYS, isJoinable } from '@/lib/content-helpers';
import { levelMismatchedTracks, tracksForBatch } from '@/lib/welcome-tracks';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function BatchesEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  const styleOptions = c.danceStyles.map((s) => ({ value: s.slug, label: s.name }));
  const branchOptions = c.studios.map((s) => ({ value: s.slug, label: s.name }));

  function patch(idx: number, p: Partial<Batch>) {
    setC((prev) => {
      const next = { ...prev, batches: prev.batches.map((b, i) => (i === idx ? { ...b, ...p } : b)) };
      return next;
    });
    setDirty(true);
  }
  function add() {
    const fresh: Batch = {
      id: randomId('batch'),
      styleSlugs: c.danceStyles[0]?.slug ? [c.danceStyles[0].slug] : ['salsa'],
      level: 'Foundation',
      branchSlug: c.studios[0]?.slug || 'jubilee-hills',
      daysOfWeek: ['Sat', 'Sun'],
      time: '9:30–10:30 AM',
      // todayIso(), not new Date().toISOString(): batch visibility is filtered
      // on IST business dates (format.ts adds +5:30), so a UTC stamp meant a
      // batch created between 00:00 and 05:30 IST was dated *yesterday* and
      // went invisible on every public surface the instant it was saved.
      startDate: todayIso(),
      joinUntil: '',
      priceInr: 6500,
      trialInr: 500,
      seatsLeft: null,
      status: 'Open',
      razorpayLink: null,
      // Present from the moment a batch is created, so the post-payment
      // message is a field the studio can see and fill rather than a hidden
      // capability. Empty ships the track's standard copy.
      welcomeNote: '',
    };
    setC((prev) => ({ ...prev, batches: [fresh, ...prev.batches] }));
    setDirty(true);
  }
  function remove(idx: number) {
    setC((prev) => ({ ...prev, batches: prev.batches.filter((_, i) => i !== idx) }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={add} className="btn-primary">+ Add batch</button>
        <p className="text-cream/50 text-sm">{c.batches.length} total</p>
      </div>
      <div className="mt-6 grid gap-4">
        {c.batches.map((b, i) => (
          <div key={b.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
            <Field label="Styles taught in this batch" hint="Tap to toggle. Pick two or more to combine them — e.g. Salsa + Bachata.">
              <div className="flex flex-wrap gap-2">
                {styleOptions.map((o) => {
                  const on = b.styleSlugs.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        const next = on
                          ? b.styleSlugs.filter((s) => s !== o.value)
                          : [...b.styleSlugs, o.value];
                        if (next.length === 0) return; // schema requires at least one
                        patch(i, { styleSlugs: next });
                      }}
                      className={`pill ${on ? 'bg-ember-500 text-cream' : 'bg-cream/5 text-cream/70'}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select label="Branch" value={b.branchSlug} onChange={(v) => patch(i, { branchSlug: v })} options={branchOptions} />
              <Select label="Level" value={b.level} onChange={(v) => patch(i, { level: v as Batch['level'] })} options={[
                { value: 'Foundation', label: 'Foundation' },
                { value: 'Intermediate', label: 'Intermediate' },
                { value: 'Advanced', label: 'Advanced' },
              ]} />
              <Select label="Status" value={b.status} onChange={(v) => patch(i, { status: v as Batch['status'] })} options={[
                { value: 'Open', label: 'Open' },
                { value: 'Filling Fast', label: 'Filling Fast' },
                { value: 'Closed', label: 'Closed' },
              ]} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Time" hint="e.g. 9:30–10:30 AM">
                <input value={b.time} onChange={(e) => patch(i, { time: e.target.value })} className="input" />
              </Field>
              <Field label="Start date">
                <input type="date" value={b.startDate} onChange={(e) => patch(i, { startDate: e.target.value })} className="input" />
                {/* Batches whose start date has passed drop out of
                    visibleBatches() and vanish from every public surface. That
                    happened silently to five of six batches, leaving one class
                    visible site-wide with nothing on screen to explain it. */}
                {b.startDate && !isJoinable(b, todayIso()) && b.status !== 'Closed' ? (
                  <p className="mt-1.5 text-xs text-ember-400">
                    Hidden from the site — this batch is past its joinable window. Update the start
                    date (or set "Joinable until") to show it again.
                  </p>
                ) : b.startDate && b.startDate < todayIso() && isJoinable(b, todayIso()) ? (
                  <p className="mt-1.5 text-xs text-gold-400">
                    Started {formatBatchDate(b.startDate)} — still bookable until{' '}
                    {formatBatchDate(b.joinUntil || addDaysIso(b.startDate, DEFAULT_JOIN_GRACE_DAYS))}.
                  </p>
                ) : null}
              </Field>
              <Field
                label="Joinable until (optional)"
                hint="Last day this batch can still be booked. Blank = start date + 14 days, so late joiners keep seeing it (make-ups cover missed classes)."
              >
                <input
                  type="date"
                  value={b.joinUntil || ''}
                  onChange={(e) => patch(i, { joinUntil: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Price (INR)" hint="Full course fee — shown on the cards.">
                <input type="number" min={0} value={b.priceInr} onChange={(e) => patch(i, { priceInr: Number(e.target.value) })} className="input" />
              </Field>
              <Field
                label="First class price (INR)"
                hint="What one class off this batch costs. Untick when the batch sells no single class — the booking button then charges the full course fee and reads “Book my seat”."
              >
                <label className="mb-2 flex items-center gap-2 text-sm text-cream/75">
                  <input
                    type="checkbox"
                    checked={b.trialInr !== null}
                    onChange={(e) => patch(i, { trialInr: e.target.checked ? 500 : null })}
                  />
                  You can book a single class in this batch
                </label>
                {b.trialInr !== null ? (
                  <input
                    type="number"
                    min={0}
                    value={b.trialInr}
                    onChange={(e) => patch(i, { trialInr: Number(e.target.value) })}
                    className="input"
                  />
                ) : (
                  <p className="text-xs text-cream/50">
                    Booking button charges the full course fee, {formatInr(b.priceInr)}.
                  </p>
                )}
              </Field>
              <Field label="Seats left (blank to hide)">
                <input
                  type="number"
                  min={0}
                  value={b.seatsLeft ?? ''}
                  onChange={(e) => patch(i, { seatsLeft: e.target.value === '' ? null : Number(e.target.value) })}
                  className="input"
                />
              </Field>
            </div>

            <Field label="Days of week">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const on = b.daysOfWeek.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const next = on ? b.daysOfWeek.filter((x) => x !== d) : [...b.daysOfWeek, d];
                        patch(i, { daysOfWeek: next.length ? (next as Batch['daysOfWeek']) : ['Sat'] });
                      }}
                      className={`pill ${on ? 'bg-ember-500 text-cream' : 'bg-cream/5 text-cream/70'}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Razorpay pre-register link (optional)">
              <input
                value={b.razorpayLink || ''}
                onChange={(e) => patch(i, { razorpayLink: e.target.value || null })}
                placeholder="https://razorpay.me/..."
                className="input"
              />
            </Field>

            <Field
              label="Post-payment message (optional)"
              hint="Shown on the confirmation page after someone pays for this batch. Leave blank to use the standard copy for this track. Venue, date, time and contact details are filled in automatically — you only need the words."
            >
              <textarea
                value={b.welcomeNote}
                onChange={(e) => patch(i, { welcomeNote: e.target.value })}
                rows={3}
                // Same rule as the redirect hint below and as the page itself.
                // This used to name whichever track merely shared a STYLE, so
                // an Advanced Bachata batch was told its note would appear on
                // the "Latin beginner class" page — a page that would never
                // show this batch at all.
                placeholder={
                  tracksForBatch(c.welcome.tracks, b)[0]
                    ? `Standard copy for the ${
                        tracksForBatch(c.welcome.tracks, b)[0].trackLabel
                      } will be used.`
                    : 'This batch has no welcome page yet, so this message would not be shown.'
                }
                className="input"
              />
            </Field>

            <RazorpayRedirectHint batch={b} tracks={c.welcome.tracks} />

            <div className="flex justify-end">
              <button onClick={() => remove(i)} className="text-sm text-cream/40 hover:text-ember-400">Delete</button>
            </div>
          </div>
        ))}
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      <style jsx global>{`
        .input {
          width: 100%;
          background: #ffffff;
          border: 1px solid rgba(36, 26, 18, 0.18);
          border-radius: 12px;
          padding: 10px 14px;
          color: #241a12;
          outline: none;
          color-scheme: light;
        }
        .input::placeholder { color: rgba(36, 26, 18, 0.4); }
        .input:focus {
          border-color: #e1591f;
        }
      `}</style>
    </>
  );
}

// Tells the studio admin which exact URL to paste into Razorpay as the
// "redirect after payment" — pinning the welcome page to THIS batch.
//
// It must decide "which welcome page" with the SAME rule /welcome/[track]
// uses, which is why it calls tracksForBatch rather than carrying its own
// copy. It used to match on style overlap alone while the page also required
// the levels to match, so for an Intermediate or Advanced batch it printed a
// confident URL to a Foundation page that structurally could not display that
// batch: the payer landed on somebody else's date, time, venue and .ics.
function RazorpayRedirectHint({
  batch,
  tracks,
}: {
  batch: Batch;
  tracks: SiteContent['welcome']['tracks'];
}) {
  const [copied, setCopied] = useState(false);
  const matches = tracksForBatch(tracks, batch);
  const nearMisses = levelMismatchedTracks(tracks, batch);

  if (matches.length === 0) {
    return (
      <p className="text-xs text-ember-400">
        {nearMisses.length > 0 ? (
          <>
            No welcome page for this batch yet. {nearMisses.map((t) => `/welcome/${t.key}`).join(', ')}{' '}
            {nearMisses.length === 1 ? 'teaches' : 'teach'} this style but{' '}
            {nearMisses.length === 1 ? `is set to ${nearMisses[0].level}` : 'at other levels'} and this
            batch is {batch.level} — sending payers there would show them a different batch. Add a{' '}
            {batch.level} page in{' '}
            <a href="/admin/pages/welcome" className="underline hover:text-ember-300">
              Welcome pages
            </a>
            .
          </>
        ) : (
          <>
            No welcome page matches this batch&apos;s styles and level yet — add one in{' '}
            <a href="/admin/pages/welcome" className="underline hover:text-ember-300">
              Welcome pages
            </a>{' '}
            to enable a post-payment redirect.
          </>
        )}
      </p>
    );
  }

  // More than one page can legitimately claim the same level and style. Naming
  // them all beats silently taking tracks[0], which made a second page for the
  // same style permanently unreachable.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/welcome/${matches[0].key}?d=${batch.startDate}&b=${batch.id}`;
  return (
    <div className="rounded-lg border border-cream/10 bg-cream/5 p-3 text-xs">
      <p className="text-cream/60">
        Razorpay redirect URL for this batch — paste into the &ldquo;redirect after payment&rdquo; field
        on the Razorpay payment page:
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 break-all rounded bg-ink-950/30 px-2 py-1 text-cream/90">{url}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked — user can still copy manually */
            }
          }}
          className="rounded-full bg-ember-500 px-3 py-1 font-semibold text-cream hover:bg-ember-600"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-cream/40">
        The <code>?b=</code> param pins the page to this exact batch; <code>?d=</code> is kept so
        links minted before it existed keep working.
      </p>
      {matches.length > 1 ? (
        <p className="mt-2 text-ember-400">
          {matches.length} welcome pages match this batch (
          {matches.map((t) => `/welcome/${t.key}`).join(', ')}). The URL above uses the first — pick
          deliberately, or give them distinct styles in Welcome pages.
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <p className="text-xs uppercase tracking-widest text-cream/60">{label}</p>
      {hint ? <p className="text-xs text-cream/40 mt-0.5">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

'use client';

import { useState } from 'react';
import { randomId } from '@/lib/id';
import type { Batch, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { saveSiteContent } from '@/lib/admin-save';

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
      startDate: new Date().toISOString().slice(0, 10),
      priceInr: 6500,
      reservationInr: 500,
      seatsLeft: null,
      status: 'Open',
      razorpayLink: null,
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
              </Field>
              <Field label="Price (INR)" hint="Full course fee — shown on the cards.">
                <input type="number" min={0} value={b.priceInr} onChange={(e) => patch(i, { priceInr: Number(e.target.value) })} className="input" />
              </Field>
              <Field label="Reserve deposit (INR)" hint="Amount the 'Reserve my seat' button charges to book.">
                <input type="number" min={0} value={b.reservationInr} onChange={(e) => patch(i, { reservationInr: Number(e.target.value) })} className="input" />
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
// "redirect after payment" — pinning the welcome page to THIS batch's date so
// two batches of the same style don't get conflated.
function RazorpayRedirectHint({
  batch,
  tracks,
}: {
  batch: Batch;
  tracks: SiteContent['welcome']['tracks'];
}) {
  const [copied, setCopied] = useState(false);
  const matchingTrack = tracks.find((t) => t.styleSlugs.some((s) => batch.styleSlugs.includes(s)));
  if (!matchingTrack) {
    return (
      <p className="text-xs text-cream/50">
        No welcome page matches this batch&apos;s styles yet — add one in{' '}
        <a href="/admin/pages/welcome" className="text-ember-400 hover:text-ember-300">
          Welcome pages
        </a>{' '}
        to enable a post-payment redirect.
      </p>
    );
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/welcome/${matchingTrack.key}?d=${batch.startDate}&b=${batch.id}`;
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
        The <code>?d=</code> param pins the welcome page to this batch&apos;s start date, so two
        batches of the same style stay distinct.
      </p>
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

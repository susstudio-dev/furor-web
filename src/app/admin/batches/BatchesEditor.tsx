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
      styleSlug: c.danceStyles[0]?.slug || 'salsa',
      level: 'Foundation',
      branchSlug: c.studios[0]?.slug || 'jubilee-hills',
      daysOfWeek: ['Sat', 'Sun'],
      time: '9:30–10:30 AM',
      startDate: new Date().toISOString().slice(0, 10),
      priceInr: 6500,
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Style" value={b.styleSlug} onChange={(v) => patch(i, { styleSlug: v })} options={styleOptions} />
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
              <Field label="Price (INR)">
                <input type="number" min={0} value={b.priceInr} onChange={(e) => patch(i, { priceInr: Number(e.target.value) })} className="input" />
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

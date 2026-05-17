'use client';

import { ReactNode } from 'react';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <p className="text-xs uppercase tracking-widest text-cream/60">{label}</p>
      {hint ? <p className="text-xs text-cream/40 mt-0.5">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function MultiToggle<T extends string>({
  label,
  values,
  options,
  onChange,
  hint,
}: {
  label: string;
  values: T[];
  options: { value: T; label: string }[];
  onChange: (next: T[]) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() =>
                onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])
              }
              className={`pill ${on ? 'bg-ember-500 text-cream' : 'bg-cream/5 text-cream/70'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function EditorStyles() {
  return (
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
      .input::placeholder {
        color: rgba(36, 26, 18, 0.4);
      }
      .input:focus {
        border-color: #e1591f;
      }
    `}</style>
  );
}

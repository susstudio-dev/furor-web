'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Field } from './fields';

export function ImageUploader({
  label,
  value,
  onChange,
  hint,
  aspect = 'square',
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  aspect?: 'square' | 'wide' | 'portrait';
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Upload failed');
      onChange(j.url);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const aspectClass =
    aspect === 'wide' ? 'aspect-[16/9]' : aspect === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';

  return (
    <Field
      label={label}
      hint={hint || 'JPEG / PNG / WebP / AVIF · up to 8 MB. Or paste a URL.'}
    >
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div
          className={`relative ${aspectClass} overflow-hidden rounded-xl border border-cream/15 bg-ink-950`}
        >
          {value ? (
            <Image
              src={value}
              alt=""
              fill
              sizes="160px"
              className="object-cover"
              unoptimized={value.startsWith('http')}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-cream/30 text-xs">
              No image
            </div>
          )}
        </div>
        <div className="grid gap-2 content-start">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/uploads/... or https://..."
            className="input"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-ember-500 text-cream text-sm px-4 py-2 hover:bg-ember-600 disabled:opacity-60"
            >
              {busy ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-sm text-cream/50 hover:text-ember-400"
              >
                Clear
              </button>
            ) : null}
            {error ? <p className="text-sm text-ember-400">{error}</p> : null}
          </div>
        </div>
      </div>
    </Field>
  );
}

export function ImageGalleryEditor({
  label,
  values,
  onChange,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadMany(files: FileList) {
    setBusy(true);
    setError(null);
    const next: string[] = [...values];
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Upload failed');
        next.push(j.url);
      }
      onChange(next);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= values.length) return;
    const next = values.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <Field label={label} hint={hint || 'Drag to reorder using the arrows. Multiple files supported.'}>
      <div className="grid gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadMany(e.target.files);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-ember-500 text-cream text-sm px-4 py-2 hover:bg-ember-600 disabled:opacity-60"
          >
            {busy ? 'Uploading…' : '+ Add images'}
          </button>
          <p className="text-sm text-cream/50">{values.length} image{values.length === 1 ? '' : 's'}</p>
          {error ? <p className="text-sm text-ember-400">{error}</p> : null}
        </div>
        {values.length ? (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {values.map((src, i) => (
              <li
                key={`${src}-${i}`}
                className="relative rounded-xl overflow-hidden border border-cream/15 bg-ink-950"
              >
                <div className="relative aspect-square">
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                    unoptimized={src.startsWith('http')}
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-ink-950/80 backdrop-blur p-1.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded-md bg-cream/10 text-cream/80 hover:bg-cream/20 disabled:opacity-30 px-2 py-0.5 text-xs"
                      aria-label="Move left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === values.length - 1}
                      className="rounded-md bg-cream/10 text-cream/80 hover:bg-cream/20 disabled:opacity-30 px-2 py-0.5 text-xs"
                      aria-label="Move right"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="rounded-md bg-cream/10 text-cream/80 hover:bg-ember-500 hover:text-cream px-2 py-0.5 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}

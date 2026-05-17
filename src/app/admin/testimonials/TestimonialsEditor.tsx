'use client';

import { useState } from 'react';
import { randomId } from '@/lib/id';
import type { SiteContent, Testimonial } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, Select, EditorStyles } from '@/components/admin/fields';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { saveSiteContent } from '@/lib/admin-save';

export function TestimonialsEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  const styleOptions = [
    { value: '', label: 'Any / general' },
    ...c.danceStyles.map((s) => ({ value: s.slug, label: s.name })),
  ];

  function patch(idx: number, p: Partial<Testimonial>) {
    setC((prev) => ({
      ...prev,
      testimonials: prev.testimonials.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    }));
    setDirty(true);
  }
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= c.testimonials.length) return;
    const next = c.testimonials.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setC((prev) => ({ ...prev, testimonials: next }));
    setDirty(true);
  }
  function add() {
    const today = new Date().toISOString().slice(0, 10);
    const fresh: Testimonial = {
      id: randomId('test'),
      studentName: 'Student name',
      photo: '',
      text: 'Quote — replace this with what the student said.',
      styleSlug: '',
      publishedAt: today,
    };
    setC((prev) => ({ ...prev, testimonials: [fresh, ...prev.testimonials] }));
    setDirty(true);
  }
  function remove(idx: number) {
    if (!confirm(`Delete testimonial from "${c.testimonials[idx].studentName || 'this student'}"?`)) return;
    setC((prev) => ({ ...prev, testimonials: prev.testimonials.filter((_, i) => i !== idx) }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={add} className="btn-primary">+ Add testimonial</button>
        <p className="text-cream/50 text-sm">{c.testimonials.length} total</p>
      </div>

      <div className="mt-6 grid gap-4">
        {c.testimonials.map((t, i) => (
          <div key={t.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="display text-sm uppercase tracking-widest text-cream/50">
                {t.studentName || 'New testimonial'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  className="rounded-md bg-cream/5 hover:bg-cream/10 px-2 py-1 text-xs text-cream/70"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  className="rounded-md bg-cream/5 hover:bg-cream/10 px-2 py-1 text-xs text-cream/70"
                >
                  ↓
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Student name">
                <input
                  value={t.studentName}
                  onChange={(e) => patch(i, { studentName: e.target.value })}
                  className="input"
                />
              </Field>
              <Select
                label="Style"
                value={t.styleSlug || ''}
                onChange={(v) => patch(i, { styleSlug: v })}
                options={styleOptions}
              />
              <Field label="Published" hint="Cannot be in the future.">
                <input
                  type="date"
                  value={t.publishedAt}
                  onChange={(e) => patch(i, { publishedAt: e.target.value })}
                  className="input"
                />
              </Field>
            </div>

            <Field label="Quote">
              <textarea
                rows={4}
                value={t.text}
                onChange={(e) => patch(i, { text: e.target.value })}
                className="input"
              />
            </Field>

            <ImageUploader
              label="Photo (optional)"
              value={t.photo || ''}
              onChange={(v) => patch(i, { photo: v })}
              aspect="square"
            />

            <div className="flex justify-end">
              <button onClick={() => remove(i)} className="text-sm text-cream/40 hover:text-ember-400">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

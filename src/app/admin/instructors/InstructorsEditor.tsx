'use client';

import { useState } from 'react';
import { randomId } from '@/lib/id';
import type { Instructor, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, MultiToggle, EditorStyles } from '@/components/admin/fields';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { saveSiteContent } from '@/lib/admin-save';

export function InstructorsEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initial.instructors[0]?.id ?? null);

  const styleOptions = c.danceStyles.map((s) => ({ value: s.slug, label: s.name }));
  const branchOptions = c.studios.map((s) => ({ value: s.slug, label: s.name }));

  function patch(idx: number, p: Partial<Instructor>) {
    setC((prev) => ({
      ...prev,
      instructors: prev.instructors.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    }));
    setDirty(true);
  }
  function patchSocial(idx: number, p: Partial<Instructor['social']>) {
    setC((prev) => ({
      ...prev,
      instructors: prev.instructors.map((s, i) =>
        i === idx ? { ...s, social: { ...s.social, ...p } } : s,
      ),
    }));
    setDirty(true);
  }
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= c.instructors.length) return;
    const next = c.instructors.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setC((prev) => ({ ...prev, instructors: next }));
    setDirty(true);
  }
  function add() {
    const fresh: Instructor = {
      id: randomId('inst'),
      name: 'New instructor',
      photo: '',
      role: 'Instructor — Hyderabad',
      shortBio: 'Bio — replace this with one or two paragraphs about the instructor.',
      branchSlugs: [],
      styleSlugs: [],
      social: { instagram: '' },
    };
    setC((prev) => ({ ...prev, instructors: [fresh, ...prev.instructors] }));
    setOpenId(fresh.id);
    setDirty(true);
  }
  function remove(idx: number) {
    if (!confirm(`Delete instructor "${c.instructors[idx].name}"?`)) return;
    setC((prev) => ({ ...prev, instructors: prev.instructors.filter((_, i) => i !== idx) }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={add} className="btn-primary">+ Add instructor</button>
        <p className="text-cream/50 text-sm">{c.instructors.length} total</p>
      </div>

      <div className="mt-6 grid gap-3">
        {c.instructors.map((s, i) => {
          const open = openId === s.id;
          return (
            <div key={s.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-cream/5"
              >
                <div className="text-left">
                  <p className="display text-lg font-bold">{s.name || '(untitled)'}</p>
                  <p className="text-cream/60 text-sm">{s.role || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(i, -1);
                    }}
                    className="rounded-md bg-cream/5 hover:bg-cream/10 px-2 py-1 text-xs text-cream/70"
                  >
                    ↑
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(i, 1);
                    }}
                    className="rounded-md bg-cream/5 hover:bg-cream/10 px-2 py-1 text-xs text-cream/70"
                  >
                    ↓
                  </span>
                  <span className="text-cream/50 text-sm">{open ? '▾' : '▸'}</span>
                </div>
              </button>
              {open ? (
                <div className="border-t border-cream/10 p-5 grid gap-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Name">
                      <input value={s.name} onChange={(e) => patch(i, { name: e.target.value })} className="input" />
                    </Field>
                    <Field label="Role" hint="e.g. Lead Instructor — Hyderabad">
                      <input value={s.role} onChange={(e) => patch(i, { role: e.target.value })} className="input" />
                    </Field>
                  </div>

                  <ImageUploader
                    label="Photo"
                    value={s.photo}
                    onChange={(v) => patch(i, { photo: v })}
                    aspect="portrait"
                  />

                  <Field label="Bio" hint="One or two paragraphs. Line breaks are preserved.">
                    <textarea
                      rows={8}
                      value={s.shortBio}
                      onChange={(e) => patch(i, { shortBio: e.target.value })}
                      className="input"
                    />
                  </Field>

                  <MultiToggle
                    label="Styles taught"
                    values={s.styleSlugs}
                    options={styleOptions}
                    onChange={(next) => patch(i, { styleSlugs: next })}
                  />

                  <MultiToggle
                    label="Branches"
                    values={s.branchSlugs}
                    options={branchOptions}
                    onChange={(next) => patch(i, { branchSlugs: next })}
                  />

                  <Field label="Instagram URL (optional)">
                    <input
                      value={s.social.instagram || ''}
                      onChange={(e) => patchSocial(i, { instagram: e.target.value })}
                      placeholder="https://instagram.com/..."
                      className="input"
                    />
                  </Field>

                  <div className="flex justify-end">
                    <button onClick={() => remove(i)} className="text-sm text-cream/40 hover:text-ember-400">
                      Delete instructor
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

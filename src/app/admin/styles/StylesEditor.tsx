'use client';

import { useState } from 'react';
import { randomId } from '@/lib/id';
import type { DanceStyle, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { saveSiteContent } from '@/lib/admin-save';

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function StylesEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  const [openId, setOpenId] = useState<string | null>(
    initial.danceStyles[0]?.id ?? null,
  );

  function patchStyle(idx: number, p: Partial<DanceStyle>) {
    setC((prev) => ({
      ...prev,
      danceStyles: prev.danceStyles.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    }));
    setDirty(true);
  }
  function patchOutcomes(idx: number, p: Partial<DanceStyle['levelOutcomes']>) {
    setC((prev) => ({
      ...prev,
      danceStyles: prev.danceStyles.map((s, i) =>
        i === idx ? { ...s, levelOutcomes: { ...s.levelOutcomes, ...p } } : s,
      ),
    }));
    setDirty(true);
  }
  function patchFaq(idx: number, fi: number, p: { q?: string; a?: string }) {
    setC((prev) => ({
      ...prev,
      danceStyles: prev.danceStyles.map((s, i) =>
        i === idx
          ? { ...s, faqs: s.faqs.map((f, j) => (j === fi ? { ...f, ...p } : f)) }
          : s,
      ),
    }));
    setDirty(true);
  }
  function addFaq(idx: number) {
    setC((prev) => ({
      ...prev,
      danceStyles: prev.danceStyles.map((s, i) =>
        i === idx ? { ...s, faqs: [...s.faqs, { q: '', a: '' }] } : s,
      ),
    }));
    setDirty(true);
  }
  function removeFaq(idx: number, fi: number) {
    setC((prev) => ({
      ...prev,
      danceStyles: prev.danceStyles.map((s, i) =>
        i === idx ? { ...s, faqs: s.faqs.filter((_, j) => j !== fi) } : s,
      ),
    }));
    setDirty(true);
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= c.danceStyles.length) return;
    const next = c.danceStyles.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((s, i) => (s.displayOrder = i + 1));
    setC((prev) => ({ ...prev, danceStyles: next }));
    setDirty(true);
  }

  function add() {
    const n = c.danceStyles.length + 1;
    const suffix = c.danceStyles.some((s) => s.slug === 'new-style') ? `-${n}` : '';
    const fresh: DanceStyle = {
      id: randomId('style'),
      slug: `new-style${suffix}`,
      name: 'New style',
      tagline: 'Short tagline — replace this.',
      description: 'Description — replace this with a 2-3 sentence intro for the style.',
      whoItsFor: 'Who it is for — replace this.',
      heroImage: '',
      heroVideo: '',
      levelOutcomes: {
        foundation: 'What students achieve at Foundation level — replace this.',
        intermediate: 'What students achieve at Intermediate level — replace this.',
        advanced: 'What students achieve at Advanced level — replace this.',
      },
      faqs: [],
      displayOrder: n,
    };
    setC((prev) => ({ ...prev, danceStyles: [fresh, ...prev.danceStyles] }));
    setOpenId(fresh.id);
    setDirty(true);
  }
  function remove(idx: number) {
    if (!confirm(`Delete "${c.danceStyles[idx].name}"? This cannot be undone (but versions are kept).`)) return;
    setC((prev) => ({ ...prev, danceStyles: prev.danceStyles.filter((_, i) => i !== idx) }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={add} className="btn-primary">+ Add style</button>
        <p className="text-cream/50 text-sm">{c.danceStyles.length} total</p>
      </div>

      <div className="mt-6 grid gap-3">
        {c.danceStyles.map((s, i) => {
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
                  <p className="text-cream/60 text-sm">{s.tagline || '—'}</p>
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
                      <input
                        value={s.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          patchStyle(i, {
                            name,
                            // Only auto-slug if the current slug looks generated from the name.
                            slug:
                              !s.slug || s.slug === slugify(s.name)
                                ? slugify(name) || s.slug
                                : s.slug,
                          });
                        }}
                        className="input"
                      />
                    </Field>
                    <Field label="Slug" hint="URL fragment under /dance-styles/. Lowercase, hyphens only.">
                      <input
                        value={s.slug}
                        onChange={(e) => patchStyle(i, { slug: slugify(e.target.value) })}
                        className="input"
                      />
                    </Field>
                  </div>

                  <Field label="Tagline" hint="One line under the name on cards & headers.">
                    <input value={s.tagline} onChange={(e) => patchStyle(i, { tagline: e.target.value })} className="input" />
                  </Field>

                  <Field label="Description" hint="2–3 sentence intro on the style's public page.">
                    <textarea
                      rows={4}
                      value={s.description}
                      onChange={(e) => patchStyle(i, { description: e.target.value })}
                      className="input"
                    />
                  </Field>

                  <Field label="Who it's for">
                    <textarea
                      rows={2}
                      value={s.whoItsFor}
                      onChange={(e) => patchStyle(i, { whoItsFor: e.target.value })}
                      className="input"
                    />
                  </Field>

                  <ImageUploader
                    label="Hero image"
                    value={s.heroImage}
                    onChange={(v) => patchStyle(i, { heroImage: v })}
                    aspect="wide"
                  />

                  <Field label="Hero video URL (optional)">
                    <input
                      value={s.heroVideo || ''}
                      onChange={(e) => patchStyle(i, { heroVideo: e.target.value })}
                      placeholder="https://..."
                      className="input"
                    />
                  </Field>

                  <div className="rounded-2xl border border-cream/10 p-4 grid gap-3">
                    <p className="display text-sm uppercase tracking-widest text-ember-400">Level outcomes</p>
                    <Field label="Foundation">
                      <textarea
                        rows={2}
                        value={s.levelOutcomes.foundation}
                        onChange={(e) => patchOutcomes(i, { foundation: e.target.value })}
                        className="input"
                      />
                    </Field>
                    <Field label="Intermediate">
                      <textarea
                        rows={2}
                        value={s.levelOutcomes.intermediate}
                        onChange={(e) => patchOutcomes(i, { intermediate: e.target.value })}
                        className="input"
                      />
                    </Field>
                    <Field label="Advanced">
                      <textarea
                        rows={2}
                        value={s.levelOutcomes.advanced}
                        onChange={(e) => patchOutcomes(i, { advanced: e.target.value })}
                        className="input"
                      />
                    </Field>
                  </div>

                  <div className="rounded-2xl border border-cream/10 p-4 grid gap-3">
                    <div className="flex items-center justify-between">
                      <p className="display text-sm uppercase tracking-widest text-ember-400">FAQs</p>
                      <button type="button" onClick={() => addFaq(i)} className="text-sm text-ember-400 hover:text-ember-300">+ Add FAQ</button>
                    </div>
                    {s.faqs.length === 0 ? (
                      <p className="text-cream/50 text-sm">No FAQs yet.</p>
                    ) : (
                      s.faqs.map((f, fi) => (
                        <div key={fi} className="grid gap-2 border-t border-cream/10 pt-3 first:border-t-0 first:pt-0">
                          <Field label={`Q${fi + 1}`}>
                            <input
                              value={f.q}
                              onChange={(e) => patchFaq(i, fi, { q: e.target.value })}
                              className="input"
                            />
                          </Field>
                          <Field label="Answer">
                            <textarea
                              rows={2}
                              value={f.a}
                              onChange={(e) => patchFaq(i, fi, { a: e.target.value })}
                              className="input"
                            />
                          </Field>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeFaq(i, fi)}
                              className="text-sm text-cream/40 hover:text-ember-400"
                            >
                              Remove FAQ
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button onClick={() => remove(i)} className="text-sm text-cream/40 hover:text-ember-400">
                      Delete style
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

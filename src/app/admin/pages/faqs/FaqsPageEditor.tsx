'use client';

import { useState } from 'react';
import type { Pages, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { saveSiteContent } from '@/lib/admin-save';

type FaqsPage = Pages['faqs'];

export function FaqsPageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patch(p: Partial<FaqsPage>) {
    setC((prev) => ({ ...prev, pages: { ...prev.pages, faqs: { ...prev.pages.faqs, ...p } } }));
    setDirty(true);
  }

  const f = c.pages.faqs;

  function patchSection(si: number, ps: { section?: string }) {
    const next = f.sections.slice();
    next[si] = { ...next[si], ...ps };
    patch({ sections: next });
  }
  function patchItem(si: number, ii: number, p: { q?: string; a?: string }) {
    const next = f.sections.slice();
    const items = next[si].items.slice();
    items[ii] = { ...items[ii], ...p };
    next[si] = { ...next[si], items };
    patch({ sections: next });
  }
  function addItem(si: number) {
    const next = f.sections.slice();
    next[si] = { ...next[si], items: [...next[si].items, { q: '', a: '' }] };
    patch({ sections: next });
  }
  function removeItem(si: number, ii: number) {
    const next = f.sections.slice();
    next[si] = { ...next[si], items: next[si].items.filter((_, i) => i !== ii) };
    patch({ sections: next });
  }
  function addSection() {
    patch({ sections: [...f.sections, { section: 'New section', items: [] }] });
  }
  function removeSection(si: number) {
    if (!confirm('Delete this whole section?')) return;
    patch({ sections: f.sections.filter((_, i) => i !== si) });
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Header</p>
          <PageIntroFields value={f.intro} onChange={(v) => patch({ intro: v })} />
        </div>

        {f.sections.map((s, si) => (
          <div key={si} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <Field label="Section title">
                <input
                  value={s.section}
                  onChange={(e) => patchSection(si, { section: e.target.value })}
                  className="input"
                />
              </Field>
              <button
                type="button"
                onClick={() => removeSection(si)}
                className="rounded-md bg-cream/5 hover:bg-ember-500/10 text-cream/60 hover:text-ember-400 px-3 py-2 text-xs shrink-0 self-end"
              >
                Delete section
              </button>
            </div>
            <div className="grid gap-3">
              {s.items.map((it, ii) => (
                <div key={ii} className="rounded-xl border border-cream/10 p-3 grid gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest text-cream/50">Q{ii + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeItem(si, ii)}
                      className="text-xs text-cream/40 hover:text-ember-400"
                    >
                      Remove
                    </button>
                  </div>
                  <Field label="Question">
                    <input
                      value={it.q}
                      onChange={(e) => patchItem(si, ii, { q: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Answer">
                    <textarea
                      rows={3}
                      value={it.a}
                      onChange={(e) => patchItem(si, ii, { a: e.target.value })}
                      className="input"
                    />
                  </Field>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  onClick={() => addItem(si)}
                  className="text-sm text-ember-400 hover:text-ember-300"
                >
                  + Add question
                </button>
              </div>
            </div>
          </div>
        ))}

        <div>
          <button
            type="button"
            onClick={addSection}
            className="btn-primary"
          >
            + Add section
          </button>
        </div>

        <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Closing CTA</p>
          <Field label="Headline">
            <input
              value={f.closingCta.headline}
              onChange={(e) => patch({ closingCta: { ...f.closingCta, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={2}
              value={f.closingCta.body}
              onChange={(e) => patch({ closingCta: { ...f.closingCta, body: e.target.value } })}
              className="input"
            />
          </Field>
        </div>
      </div>

      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

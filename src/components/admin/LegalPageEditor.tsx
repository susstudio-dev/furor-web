'use client';

import { useState } from 'react';
import type { SiteContent, LegalPage } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { saveSiteContent } from '@/lib/admin-save';
import { SeoFields } from '@/components/admin/SeoFields';

type PageKey = 'privacy' | 'terms';

// Reusable editor for any LegalPage (Privacy, Terms, similar). Long-form
// "intro + sections" pages. Sections can be added, reordered (up/down) and
// removed; each is a heading + body.
export function LegalPageEditor({
  initial,
  pageKey,
}: {
  initial: SiteContent;
  pageKey: PageKey;
}) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patch(p: Partial<LegalPage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, [pageKey]: { ...prev.pages[pageKey], ...p } },
    }));
    setDirty(true);
  }

  const page = c.pages[pageKey];

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  function moveSection(i: number, dir: -1 | 1) {
    const next = page.sections.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    patch({ sections: next });
  }

  return (
    <>
      <EditorStyles />
      <div className="mt-8 grid gap-5">
        <SeoFields
          pageKey={pageKey}
          value={{ seoTitle: page.seoTitle, seoDescription: page.seoDescription }}
          onChange={(next) => patch(next)}
        />
        <Section title="Header">
          <PageIntroFields value={page.intro} onChange={(v) => patch({ intro: v })} />
        </Section>

        <Section title="Last updated">
          <Field label="Date shown to readers" hint="Free text — e.g. “14 May 2026”.">
            <input
              value={page.lastUpdated}
              onChange={(e) => patch({ lastUpdated: e.target.value })}
              className="input"
              placeholder="14 May 2026"
            />
          </Field>
        </Section>

        <Section title="Sections">
          <p className="text-xs text-cream/50">
            Each section is a sub-heading + a paragraph. Use blank lines in the body to break
            paragraphs.
          </p>
          {page.sections.map((s, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-2xl border border-cream/10 bg-ink-900/30 p-4"
            >
              <Field label={`Heading ${i + 1}`}>
                <input
                  value={s.heading}
                  onChange={(e) => {
                    const next = page.sections.slice();
                    next[i] = { ...next[i], heading: e.target.value };
                    patch({ sections: next });
                  }}
                  className="input"
                />
              </Field>
              <Field label="Body">
                <textarea
                  rows={4}
                  value={s.body}
                  onChange={(e) => {
                    const next = page.sections.slice();
                    next[i] = { ...next[i], body: e.target.value };
                    patch({ sections: next });
                  }}
                  className="input"
                />
              </Field>
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveSection(i, -1)}
                    disabled={i === 0}
                    className="text-xs text-cream/60 hover:text-cream disabled:opacity-30"
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(i, +1)}
                    disabled={i === page.sections.length - 1}
                    className="text-xs text-cream/60 hover:text-cream disabled:opacity-30"
                  >
                    ↓ Down
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => patch({ sections: page.sections.filter((_, j) => j !== i) })}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Remove section
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch({ sections: [...page.sections, { heading: '', body: '' }] })}
            className="rounded-full bg-cream/10 px-4 py-2 text-sm text-cream/80 hover:bg-cream/15 w-fit"
          >
            + Add section
          </button>
        </Section>
      </div>
      <SaveBar dirty={dirty} onSave={save} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-cream/10 bg-ink-900/20 p-5">
      <p className="display text-xs uppercase tracking-widest text-cream/50 mb-3">{title}</p>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

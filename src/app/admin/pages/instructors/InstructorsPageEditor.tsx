'use client';

import { useState } from 'react';
import type { Pages, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { saveSiteContent } from '@/lib/admin-save';

type IPage = Pages['instructorsPage'];

export function InstructorsPageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patch(p: Partial<IPage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, instructorsPage: { ...prev.pages.instructorsPage, ...p } },
    }));
    setDirty(true);
  }

  const p = c.pages.instructorsPage;

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Header</p>
          <PageIntroFields value={p.intro} onChange={(v) => patch({ intro: v })} />
        </div>

        <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Testimonials section header</p>
          <p className="text-xs text-cream/50">
            Shown above the student-voice testimonials block. The individual testimonials themselves are edited under Testimonials.
          </p>
          <Field label="Eyebrow">
            <input
              value={p.testimonialsHeader.eyebrow}
              onChange={(e) =>
                patch({ testimonialsHeader: { ...p.testimonialsHeader, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.testimonialsHeader.headline}
              onChange={(e) =>
                patch({ testimonialsHeader: { ...p.testimonialsHeader, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Closing CTA</p>
          <Field label="Headline">
            <input
              value={p.closingCta.headline}
              onChange={(e) => patch({ closingCta: { ...p.closingCta, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={2}
              value={p.closingCta.body}
              onChange={(e) => patch({ closingCta: { ...p.closingCta, body: e.target.value } })}
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

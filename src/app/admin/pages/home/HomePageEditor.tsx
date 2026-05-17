'use client';

import { useState } from 'react';
import type { Pages, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { saveSiteContent } from '@/lib/admin-save';

type HomePage = Pages['home'];

export function HomePageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patchHome(patch: Partial<HomePage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, home: { ...prev.pages.home, ...patch } },
    }));
    setDirty(true);
  }

  const h = c.pages.home;

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <Section title="What we teach (dance-styles section header)">
          <Field label="Eyebrow">
            <input
              value={h.whatWeTeach.eyebrow}
              onChange={(e) =>
                patchHome({ whatWeTeach: { ...h.whatWeTeach, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline" hint="Wrap a word in *asterisks* to give it the accent style.">
            <input
              value={h.whatWeTeach.headline}
              onChange={(e) =>
                patchHome({ whatWeTeach: { ...h.whatWeTeach, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="Next batches section header">
          <Field label="Eyebrow">
            <input
              value={h.nextBatches.eyebrow}
              onChange={(e) =>
                patchHome({ nextBatches: { ...h.nextBatches, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={h.nextBatches.headline}
              onChange={(e) =>
                patchHome({ nextBatches: { ...h.nextBatches, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="How it works">
          <Field label="Eyebrow">
            <input
              value={h.howItWorks.eyebrow}
              onChange={(e) =>
                patchHome({ howItWorks: { ...h.howItWorks, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={h.howItWorks.headline}
              onChange={(e) =>
                patchHome({ howItWorks: { ...h.howItWorks, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          {h.howItWorks.steps.map((s, i) => (
            <div key={i} className="rounded-xl border border-cream/10 p-3 grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-cream/50">Step {i + 1}</p>
                <button
                  type="button"
                  onClick={() =>
                    patchHome({
                      howItWorks: {
                        ...h.howItWorks,
                        steps: h.howItWorks.steps.filter((_, j) => j !== i),
                      },
                    })
                  }
                  className="text-xs text-cream/40 hover:text-ember-400"
                >
                  Remove
                </button>
              </div>
              <Field label="Title">
                <input
                  value={s.title}
                  onChange={(e) => {
                    const next = h.howItWorks.steps.slice();
                    next[i] = { ...s, title: e.target.value };
                    patchHome({ howItWorks: { ...h.howItWorks, steps: next } });
                  }}
                  className="input"
                />
              </Field>
              <Field label="Body">
                <textarea
                  rows={2}
                  value={s.body}
                  onChange={(e) => {
                    const next = h.howItWorks.steps.slice();
                    next[i] = { ...s, body: e.target.value };
                    patchHome({ howItWorks: { ...h.howItWorks, steps: next } });
                  }}
                  className="input"
                />
              </Field>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={() =>
                patchHome({
                  howItWorks: {
                    ...h.howItWorks,
                    steps: [...h.howItWorks.steps, { title: '', body: '' }],
                  },
                })
              }
              className="text-sm text-ember-400 hover:text-ember-300"
            >
              + Add step
            </button>
          </div>
        </Section>

        <Section title="Closing CTA (orange gradient block)">
          <Field label="Headline" hint="Wrap a word in *asterisks* for the accent style — e.g. Ready when *you* are.">
            <input
              value={h.closingCta.headline}
              onChange={(e) =>
                patchHome({ closingCta: { ...h.closingCta, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={2}
              value={h.closingCta.body}
              onChange={(e) =>
                patchHome({ closingCta: { ...h.closingCta, body: e.target.value } })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="Visit us section">
          <Field label="Eyebrow">
            <input
              value={h.visitUs.eyebrow}
              onChange={(e) =>
                patchHome({ visitUs: { ...h.visitUs, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field
            label="Headline template"
            hint='Use {neighborhood} as a placeholder — it will be replaced with the studio neighborhood. e.g. "Find us in {neighborhood}, Hyderabad."'
          >
            <input
              value={h.visitUs.headlineTemplate}
              onChange={(e) =>
                patchHome({ visitUs: { ...h.visitUs, headlineTemplate: e.target.value } })
              }
              className="input"
            />
          </Field>
        </Section>
      </div>

      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
      <p className="display text-sm uppercase tracking-widest text-ember-400">{title}</p>
      {children}
    </div>
  );
}

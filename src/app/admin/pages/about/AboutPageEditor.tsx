'use client';

import { useState } from 'react';
import type { SiteContent, Pages } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { ImageGalleryEditor } from '@/components/admin/ImageUploader';
import { saveSiteContent } from '@/lib/admin-save';

type AboutPage = Pages['about'];

export function AboutPageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patchAbout(patch: Partial<AboutPage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, about: { ...prev.pages.about, ...patch } },
    }));
    setDirty(true);
  }

  const a = c.pages.about;

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <Section title="Header">
          <PageIntroFields value={a.intro} onChange={(v) => patchAbout({ intro: v })} />
        </Section>

        <Section title="Intro paragraphs">
          <p className="text-xs text-cream/50">The 2–3 paragraphs under the headline.</p>
          {a.introParagraphs.map((p, i) => (
            <div key={i} className="grid gap-2">
              <Field label={`Paragraph ${i + 1}`}>
                <textarea
                  rows={3}
                  value={p}
                  onChange={(e) => {
                    const next = a.introParagraphs.slice();
                    next[i] = e.target.value;
                    patchAbout({ introParagraphs: next });
                  }}
                  className="input"
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    patchAbout({ introParagraphs: a.introParagraphs.filter((_, j) => j !== i) })
                  }
                  className="text-xs text-cream/40 hover:text-ember-400"
                >
                  Remove paragraph
                </button>
              </div>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={() => patchAbout({ introParagraphs: [...a.introParagraphs, ''] })}
              className="text-sm text-ember-400 hover:text-ember-300"
            >
              + Add paragraph
            </button>
          </div>
        </Section>

        <Section title="Moments — photo gallery">
          <Field label="Eyebrow">
            <input
              value={a.moments.eyebrow}
              onChange={(e) =>
                patchAbout({ moments: { ...a.moments, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={a.moments.headline}
              onChange={(e) =>
                patchAbout({ moments: { ...a.moments, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Side description (right of headline)">
            <textarea
              rows={2}
              value={a.moments.lead}
              onChange={(e) =>
                patchAbout({ moments: { ...a.moments, lead: e.target.value } })
              }
              className="input"
            />
          </Field>
          <p className="text-xs text-cream/50">
            The first photo is rendered larger (2x2 cell). The remaining photos fill the grid.
          </p>
          <ImageGalleryEditor
            label="Photos"
            values={a.moments.photos.map((p) => p.src)}
            onChange={(srcs) => {
              const photos = srcs.map((src, i) => ({
                src,
                alt: a.moments.photos[i]?.alt ?? '',
              }));
              patchAbout({ moments: { ...a.moments, photos } });
            }}
          />
          {a.moments.photos.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-widest text-cream/60">Alt text for each photo (for accessibility)</p>
              {a.moments.photos.map((p, i) => (
                <input
                  key={i}
                  value={p.alt}
                  placeholder={`Alt text for photo ${i + 1}`}
                  onChange={(e) => {
                    const photos = a.moments.photos.slice();
                    photos[i] = { ...photos[i], alt: e.target.value };
                    patchAbout({ moments: { ...a.moments, photos } });
                  }}
                  className="input"
                />
              ))}
            </div>
          ) : null}
        </Section>

        <Section title="Stats strip">
          <p className="text-xs text-cream/50">Up to 4 stat cards. The big number is the &ldquo;value&rdquo;, the small line below is the &ldquo;label&rdquo;.</p>
          {a.stats.map((s, i) => (
            <div key={i} className="grid grid-cols-[140px_1fr_auto] gap-2 items-end">
              <Field label="Number">
                <input
                  value={s.k}
                  onChange={(e) => {
                    const next = a.stats.slice();
                    next[i] = { ...s, k: e.target.value };
                    patchAbout({ stats: next });
                  }}
                  className="input"
                />
              </Field>
              <Field label="Label">
                <input
                  value={s.v}
                  onChange={(e) => {
                    const next = a.stats.slice();
                    next[i] = { ...s, v: e.target.value };
                    patchAbout({ stats: next });
                  }}
                  className="input"
                />
              </Field>
              <button
                type="button"
                onClick={() => patchAbout({ stats: a.stats.filter((_, j) => j !== i) })}
                className="rounded-md bg-cream/5 hover:bg-cream/10 text-cream/60 hover:text-ember-400 px-2 py-2 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={() => patchAbout({ stats: [...a.stats, { k: '', v: '' }] })}
              className="text-sm text-ember-400 hover:text-ember-300"
            >
              + Add stat
            </button>
          </div>
        </Section>

        <Section title="Timeline (Our journey)">
          <Field label="Eyebrow">
            <input
              value={a.timeline.eyebrow}
              onChange={(e) =>
                patchAbout({ timeline: { ...a.timeline, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={a.timeline.headline}
              onChange={(e) =>
                patchAbout({ timeline: { ...a.timeline, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          {a.timeline.milestones.map((m, i) => (
            <div key={i} className="rounded-xl border border-cream/10 p-3 grid gap-2">
              <div className="grid grid-cols-[110px_1fr_auto] gap-2 items-end">
                <Field label="Year">
                  <input
                    value={m.year}
                    onChange={(e) => {
                      const next = a.timeline.milestones.slice();
                      next[i] = { ...m, year: e.target.value };
                      patchAbout({ timeline: { ...a.timeline, milestones: next } });
                    }}
                    className="input"
                  />
                </Field>
                <Field label="Title">
                  <input
                    value={m.title}
                    onChange={(e) => {
                      const next = a.timeline.milestones.slice();
                      next[i] = { ...m, title: e.target.value };
                      patchAbout({ timeline: { ...a.timeline, milestones: next } });
                    }}
                    className="input"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    patchAbout({
                      timeline: {
                        ...a.timeline,
                        milestones: a.timeline.milestones.filter((_, j) => j !== i),
                      },
                    })
                  }
                  className="rounded-md bg-cream/5 hover:bg-cream/10 text-cream/60 hover:text-ember-400 px-2 py-2 text-xs"
                >
                  ✕
                </button>
              </div>
              <Field label="Body">
                <textarea
                  rows={2}
                  value={m.body}
                  onChange={(e) => {
                    const next = a.timeline.milestones.slice();
                    next[i] = { ...m, body: e.target.value };
                    patchAbout({ timeline: { ...a.timeline, milestones: next } });
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
                patchAbout({
                  timeline: {
                    ...a.timeline,
                    milestones: [...a.timeline.milestones, { year: '', title: '', body: '' }],
                  },
                })
              }
              className="text-sm text-ember-400 hover:text-ember-300"
            >
              + Add milestone
            </button>
          </div>
        </Section>

        <Section title="Beyond the classroom">
          <Field label="Eyebrow">
            <input
              value={a.beyond.eyebrow}
              onChange={(e) =>
                patchAbout({ beyond: { ...a.beyond, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={a.beyond.headline}
              onChange={(e) =>
                patchAbout({ beyond: { ...a.beyond, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          {a.beyond.cards.map((card, i) => (
            <div key={i} className="rounded-xl border border-cream/10 p-3 grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-cream/50">Card {i + 1}</p>
                <button
                  type="button"
                  onClick={() =>
                    patchAbout({
                      beyond: { ...a.beyond, cards: a.beyond.cards.filter((_, j) => j !== i) },
                    })
                  }
                  className="text-xs text-cream/40 hover:text-ember-400"
                >
                  Remove
                </button>
              </div>
              <Field label="Title">
                <input
                  value={card.title}
                  onChange={(e) => {
                    const next = a.beyond.cards.slice();
                    next[i] = { ...card, title: e.target.value };
                    patchAbout({ beyond: { ...a.beyond, cards: next } });
                  }}
                  className="input"
                />
              </Field>
              <Field label="Body">
                <textarea
                  rows={2}
                  value={card.body}
                  onChange={(e) => {
                    const next = a.beyond.cards.slice();
                    next[i] = { ...card, body: e.target.value };
                    patchAbout({ beyond: { ...a.beyond, cards: next } });
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
                patchAbout({
                  beyond: { ...a.beyond, cards: [...a.beyond.cards, { title: '', body: '' }] },
                })
              }
              className="text-sm text-ember-400 hover:text-ember-300"
            >
              + Add card
            </button>
          </div>
        </Section>

        <Section title="Team teaser (links to /instructors)">
          <Field label="Eyebrow">
            <input
              value={a.teamTeaser.eyebrow}
              onChange={(e) =>
                patchAbout({ teamTeaser: { ...a.teamTeaser, eyebrow: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={a.teamTeaser.headline}
              onChange={(e) =>
                patchAbout({ teamTeaser: { ...a.teamTeaser, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Button label">
            <input
              value={a.teamTeaser.linkLabel}
              onChange={(e) =>
                patchAbout({ teamTeaser: { ...a.teamTeaser, linkLabel: e.target.value } })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="Closing CTA">
          <Field label="Headline">
            <input
              value={a.closingCta.headline}
              onChange={(e) =>
                patchAbout({ closingCta: { ...a.closingCta, headline: e.target.value } })
              }
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={2}
              value={a.closingCta.body}
              onChange={(e) =>
                patchAbout({ closingCta: { ...a.closingCta, body: e.target.value } })
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

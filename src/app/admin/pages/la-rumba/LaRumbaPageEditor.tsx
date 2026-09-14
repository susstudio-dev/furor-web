'use client';

import { useState } from 'react';
import type { SiteContent, Pages } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { ImageGalleryEditor } from '@/components/admin/ImageUploader';
import { SeoFields } from '@/components/admin/SeoFields';
import { saveSiteContent } from '@/lib/admin-save';
import { useAutosave } from '@/lib/autosave';
import { AutosaveBanner } from '@/components/admin/AutosaveBanner';

type LaRumbaPage = Pages['laRumba'];

export function LaRumbaPageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  // Subtree only, matching the other page editors: stashing the whole document
  // means a restore reverts every section this tab holds a stale copy of.
  const autosave = useAutosave('pages.laRumba', c.pages.laRumba, dirty);

  function patch(p: Partial<LaRumbaPage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, laRumba: { ...prev.pages.laRumba, ...p } },
    }));
    setDirty(true);
  }

  const p = c.pages.laRumba;

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
    autosave.clear();
  }

  return (
    <>
      {autosave.stash ? (
        <AutosaveBanner
          savedAt={autosave.stash.savedAt}
          matchesVersion={autosave.stashMatchesVersion}
          onRestore={() => {
            const laRumba = autosave.stash!.value;
            setC((prev) => ({ ...prev, pages: { ...prev.pages, laRumba } }));
            setDirty(true);
            autosave.clear();
          }}
          onDiscard={autosave.clear}
        />
      ) : null}

      <div className="mt-8 grid gap-5">
        {/* The whole reason this page gets a real editor instead of a generic
            custom page. Without this notice someone types "Saturday 7 PM" into
            a copy field and cannot work out why editing it changes nothing. */}
        <p className="rounded-2xl border border-ember-500/30 bg-ember-500/5 p-4 text-sm text-cream/75">
          The day, the time and the venue are <strong>not</strong> edited here — they
          come from <strong>Site → the social block</strong>, and this page reads them
          live. Change them once, there, and every surface follows.
        </p>

        <SeoFields
          pageKey="laRumba"
          value={{ seoTitle: p.seoTitle, seoDescription: p.seoDescription }}
          onChange={(next) => patch(next)}
        />

        <Section title="Header">
          <PageIntroFields value={p.intro} onChange={(v) => patch({ intro: v })} />
          <Field label="Hero photo" hint="The full-width photo behind the page title.">
            <ImageGalleryEditor
              label="Hero photo"
              values={p.heroPhoto.src ? [p.heroPhoto.src] : []}
              onChange={(srcs) =>
                patch({ heroPhoto: { ...p.heroPhoto, src: srcs[0] ?? '' } })
              }
            />
          </Field>
          <Field label="Hero photo description" hint="Read aloud by screen readers.">
            <input
              value={p.heroPhoto.alt}
              onChange={(e) => patch({ heroPhoto: { ...p.heroPhoto, alt: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Hero button" hint="The main ask at the top of the page.">
            <input
              value={p.heroCtaLabel}
              onChange={(e) => patch({ heroCtaLabel: e.target.value })}
              className="input"
            />
          </Field>
        </Section>

        <Section title="Reassurance">
          <Field label="Eyebrow">
            <input
              value={p.reassure.eyebrow}
              onChange={(e) => patch({ reassure: { ...p.reassure, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.reassure.headline}
              onChange={(e) => patch({ reassure: { ...p.reassure, headline: e.target.value } })}
              className="input"
            />
          </Field>
          {p.reassure.items.map((item, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-cream/10 p-3">
              <Field label={`Point ${i + 1} — title`}>
                <input
                  value={item.title}
                  onChange={(e) => {
                    const items = p.reassure.items.slice();
                    items[i] = { ...items[i], title: e.target.value };
                    patch({ reassure: { ...p.reassure, items } });
                  }}
                  className="input"
                />
              </Field>
              <Field label={`Point ${i + 1} — body`}>
                <textarea
                  rows={2}
                  value={item.body}
                  onChange={(e) => {
                    const items = p.reassure.items.slice();
                    items[i] = { ...items[i], body: e.target.value };
                    patch({ reassure: { ...p.reassure, items } });
                  }}
                  className="input"
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      reassure: {
                        ...p.reassure,
                        items: p.reassure.items.filter((_, j) => j !== i),
                      },
                    })
                  }
                  className="text-xs text-cream/40 hover:text-ember-400"
                >
                  Remove point
                </button>
              </div>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={() =>
                patch({
                  reassure: {
                    ...p.reassure,
                    items: [...p.reassure.items, { title: '', body: '' }],
                  },
                })
              }
              className="text-sm text-ember-400 hover:text-ember-300"
            >
              + Add point
            </button>
          </div>
        </Section>

        <Section title="Gallery">
          <Field label="Eyebrow">
            <input
              value={p.gallery.eyebrow}
              onChange={(e) => patch({ gallery: { ...p.gallery, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.gallery.headline}
              onChange={(e) => patch({ gallery: { ...p.gallery, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <ImageGalleryEditor
            label="Photos"
            values={p.gallery.photos.map((x) => x.src)}
            onChange={(srcs) => {
              const photos = srcs.map((src, i) => ({
                src,
                alt: p.gallery.photos[i]?.alt ?? '',
              }));
              patch({ gallery: { ...p.gallery, photos } });
            }}
          />
          {p.gallery.photos.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-widest text-cream/60">
                Description for each photo (for accessibility)
              </p>
              {p.gallery.photos.map((photo, i) => (
                <Field key={i} label={`Photo ${i + 1}`}>
                  <input
                    value={photo.alt}
                    onChange={(e) => {
                      const photos = p.gallery.photos.slice();
                      photos[i] = { ...photos[i], alt: e.target.value };
                      patch({ gallery: { ...p.gallery, photos } });
                    }}
                    className="input"
                  />
                </Field>
              ))}
            </div>
          ) : null}
        </Section>

        <Section title="Voices">
          <Field label="Eyebrow">
            <input
              value={p.voices.eyebrow}
              onChange={(e) => patch({ voices: { ...p.voices, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.voices.headline}
              onChange={(e) => patch({ voices: { ...p.voices, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field
            label="Testimonial IDs"
            hint="Comma-separated, in the order they should appear. Edit the testimonials themselves under Testimonials. An ID that no longer exists is skipped."
          >
            <input
              value={p.voices.testimonialIds.join(', ')}
              onChange={(e) =>
                patch({
                  voices: {
                    ...p.voices,
                    testimonialIds: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0),
                  },
                })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="Every week is different">
          <p className="text-xs text-cream/50">
            The block that says entry is sorted at the venue and the night changes.
            Keep it confident — it is the reason someone messages instead of guessing.
          </p>
          <Field label="Eyebrow">
            <input
              value={p.weekly.eyebrow}
              onChange={(e) => patch({ weekly: { ...p.weekly, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.weekly.headline}
              onChange={(e) => patch({ weekly: { ...p.weekly, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={3}
              value={p.weekly.body}
              onChange={(e) => patch({ weekly: { ...p.weekly, body: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Button label">
            <input
              value={p.weekly.ctaLabel}
              onChange={(e) => patch({ weekly: { ...p.weekly, ctaLabel: e.target.value } })}
              className="input"
            />
          </Field>
          <Field
            label="WhatsApp message context"
            hint="Filled into the prefilled message, e.g. “what’s on at La Rumba this Saturday”."
          >
            <input
              value={p.weekly.ctaContext}
              onChange={(e) => patch({ weekly: { ...p.weekly, ctaContext: e.target.value } })}
              className="input"
            />
          </Field>
        </Section>

        <Section title="Link to classes">
          <Field label="Eyebrow">
            <input
              value={p.classCta.eyebrow}
              onChange={(e) => patch({ classCta: { ...p.classCta, eyebrow: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Headline">
            <input
              value={p.classCta.headline}
              onChange={(e) => patch({ classCta: { ...p.classCta, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={2}
              value={p.classCta.body}
              onChange={(e) => patch({ classCta: { ...p.classCta, body: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Button label" hint="The first-class price is added automatically.">
            <input
              value={p.classCta.ctaLabel}
              onChange={(e) => patch({ classCta: { ...p.classCta, ctaLabel: e.target.value } })}
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

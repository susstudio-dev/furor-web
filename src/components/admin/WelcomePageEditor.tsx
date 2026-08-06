'use client';

import { useState } from 'react';
import type { SiteContent, Welcome, WelcomeTrack } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, Select, EditorStyles } from '@/components/admin/fields';
import { saveSiteContent } from '@/lib/admin-save';
import { useAutosave } from '@/lib/autosave';
import { AutosaveBanner } from '@/components/admin/AutosaveBanner';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function WelcomePageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  // Subtree only - see AboutPageEditor.
  const autosave = useAutosave('welcome', c.welcome, dirty);

  const w = c.welcome;

  function patchWelcome(patch: Partial<Welcome>) {
    setC((prev) => ({ ...prev, welcome: { ...prev.welcome, ...patch } }));
    setDirty(true);
  }
  // Tracks are edited by index — the `key` (slug) is itself editable, so it
  // can't be used as a stable identity.
  function patchTrackAt(i: number, patch: Partial<WelcomeTrack>) {
    patchWelcome({ tracks: w.tracks.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  }
  function addTrack() {
    patchWelcome({
      tracks: [
        ...w.tracks,
        {
          key: '',
          trackLabel: 'New track',
          styleSlugs: [],
          weekendTod: 'AM',
          whenDays: 'Saturday & Sunday',
          whenTime: '',
          arriveBy: '',
          metaDesc: '',
        },
      ],
    });
  }
  function removeTrack(i: number) {
    if (
      !confirm(
        'Remove this welcome page? Make sure no Razorpay page still redirects to its URL first.',
      )
    )
      return;
    patchWelcome({ tracks: w.tracks.filter((_, j) => j !== i) });
  }

  async function save() {
    // Auto-fill blank slugs from the track label so we never save an empty key
    // (the schema requires one, and the URL needs it).
    const cleaned: SiteContent = {
      ...c,
      welcome: {
        ...c.welcome,
        tracks: c.welcome.tracks.map((t) => ({
          ...t,
          key: t.key.trim() || slugify(t.trackLabel) || 'track',
        })),
      },
    };
    await saveSiteContent(cleaned);
    setC(cleaned);
    setDirty(false);
    autosave.clear();
  }

  // Small typed helpers to cut repetition across the many copy fields.
  const txt = (
    label: string,
    key: keyof Welcome,
    hint?: string,
  ) => (
    <Field label={label} hint={hint}>
      <input
        value={w[key] as string}
        onChange={(e) => patchWelcome({ [key]: e.target.value } as Partial<Welcome>)}
        className="input"
      />
    </Field>
  );
  const area = (label: string, key: keyof Welcome, hint?: string) => (
    <Field label={label} hint={hint}>
      <textarea
        rows={3}
        value={w[key] as string}
        onChange={(e) => patchWelcome({ [key]: e.target.value } as Partial<Welcome>)}
        className="input"
      />
    </Field>
  );

  return (
    <>
      {autosave.stash ? (
        <AutosaveBanner
          savedAt={autosave.stash.savedAt}
          matchesVersion={autosave.stashMatchesVersion}
          onRestore={() => {
            const welcome = autosave.stash!.value;
            setC((prev) => ({ ...prev, welcome }));
            setDirty(true);
            autosave.clear();
          }}
          onDiscard={autosave.clear}
        />
      ) : null}

      <div className="mt-8 grid gap-5">
        <Section title="Confirmation header">
          {txt('Badge', 'confirmedBadge')}
          {txt('Headline', 'confirmedHeadline')}
          {area(
            'Reminder line (with a known date)',
            'reminderWithDate',
            'Use {trackLabel} and {date} — both are filled in automatically.',
          )}
          {area(
            'Reminder line (no date yet)',
            'reminderNoDate',
            'Shown when no upcoming batch date is set. Use {trackLabel}.',
          )}
          {area('Thank-you paragraph', 'thankYouBody')}
        </Section>

        <Section title="Step cards">
          {txt('Step 1 — title', 'step1Title')}
          {area('Step 1 — body', 'step1Body', 'Use {number} for the WhatsApp number.')}
          {txt('Step 2 — title', 'step2Title')}
          {area('Step 2 — body', 'step2Body', 'Use {arriveBy} for the arrival time.')}
        </Section>

        <Section title="Intake details">
          {txt('Section heading', 'intakeHeading')}
          {txt('“What to bring” heading', 'whatToBringHeading')}
          <Field label="What to bring (one item per line)" hint="Shown as a bullet list.">
            <textarea
              rows={4}
              value={w.whatToBring.join('\n')}
              onChange={(e) =>
                patchWelcome({
                  whatToBring: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                })
              }
              className="input"
            />
          </Field>
        </Section>

        <Section title="Sign-off (orange block)">
          {txt('Headline', 'signoffHeadline')}
          {area('Body', 'signoffBody')}
          {txt('Sign-off name', 'signoffName')}
          {txt('Tagline', 'signoffTagline')}
        </Section>

        <Section title="Payment not confirmed">
          {txt('Badge', 'unconfirmedBadge')}
          {txt('Headline', 'unconfirmedHeadline')}
          {area('Body', 'unconfirmedBody', 'Use {trackLabel}.')}
        </Section>

        <Section title="Tracks (post-payment pages)">
          <p className="-mt-1 text-xs text-cream/50">
            One block per post-payment page. Each lives at <code>/welcome/&lt;slug&gt;</code> — set
            that exact URL as the “redirect after payment” on its Razorpay page. The date, venue and
            class times come from your live batches; the fields below are labels and fallbacks.
          </p>
          {w.tracks.map((t, i) => {
            const slug = t.key.trim();
            const dup = slug && w.tracks.filter((x) => x.key.trim() === slug).length > 1;
            return (
              <div key={i} className="rounded-xl border border-cream/10 p-4 grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-widest text-ember-400">
                    /welcome/{slug || '…'}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeTrack(i)}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="URL slug"
                    hint="Lowercase, hyphens. The page URL is /welcome/<slug>."
                  >
                    <input
                      value={t.key}
                      onChange={(e) => patchTrackAt(i, { key: slugify(e.target.value) })}
                      placeholder="e.g. kizomba"
                      className="input"
                    />
                  </Field>
                  <Field label="Track label" hint="e.g. Latin beginner class. Shown in the copy as {trackLabel}.">
                    <input
                      value={t.trackLabel}
                      onChange={(e) => patchTrackAt(i, { trackLabel: e.target.value })}
                      className="input"
                    />
                  </Field>
                </div>
                {dup ? (
                  <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    Another track already uses this slug — give it a unique one.
                  </p>
                ) : null}
                <Field
                  label="Style slugs"
                  hint="Comma-separated, e.g. salsa, bachata. Used to find the matching batch for the date."
                >
                  <input
                    value={t.styleSlugs.join(', ')}
                    onChange={(e) =>
                      patchTrackAt(i, {
                        styleSlugs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="input"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Select
                    label="Time of day"
                    value={t.weekendTod}
                    onChange={(v) => patchTrackAt(i, { weekendTod: v as 'AM' | 'PM' })}
                    options={[
                      { value: 'AM', label: 'AM (morning)' },
                      { value: 'PM', label: 'PM (evening)' },
                    ]}
                  />
                  <Field label="Days (fallback)" hint="e.g. Saturday & Sunday">
                    <input
                      value={t.whenDays}
                      onChange={(e) => patchTrackAt(i, { whenDays: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Time (fallback)" hint="e.g. 9:30 AM – 10:30 AM">
                    <input
                      value={t.whenTime}
                      onChange={(e) => patchTrackAt(i, { whenTime: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Arrive by (fallback)" hint="e.g. 9:15 AM">
                    <input
                      value={t.arriveBy}
                      onChange={(e) => patchTrackAt(i, { arriveBy: e.target.value })}
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="SEO description" hint="Shown in the browser tab / link previews.">
                  <input
                    value={t.metaDesc}
                    onChange={(e) => patchTrackAt(i, { metaDesc: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addTrack}
            className="w-fit rounded-full bg-ember-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-ember-600"
          >
            + Add welcome page
          </button>
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

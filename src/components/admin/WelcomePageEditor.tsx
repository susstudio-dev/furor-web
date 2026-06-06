'use client';

import { useState } from 'react';
import type { SiteContent, Welcome, WelcomeTrack } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, Select, EditorStyles } from '@/components/admin/fields';
import { saveSiteContent } from '@/lib/admin-save';

export function WelcomePageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  const w = c.welcome;

  function patchWelcome(patch: Partial<Welcome>) {
    setC((prev) => ({ ...prev, welcome: { ...prev.welcome, ...patch } }));
    setDirty(true);
  }
  function patchTrack(key: string, patch: Partial<WelcomeTrack>) {
    patchWelcome({
      tracks: w.tracks.map((t) => (t.key === key ? { ...t, ...patch } : t)),
    });
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
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

        <Section title="Tracks">
          <p className="-mt-1 text-xs text-cream/50">
            One block per post-payment URL (/welcome/&lt;key&gt;). The date, venue and class times
            come from your live batches; the fields below are labels and fallbacks.
          </p>
          {w.tracks.map((t) => (
            <div key={t.key} className="rounded-xl border border-cream/10 p-4 grid gap-3">
              <p className="text-xs uppercase tracking-widest text-ember-400">
                /welcome/{t.key}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Track label" hint="e.g. Latin beginner class. Used throughout the copy as {trackLabel}.">
                  <input
                    value={t.trackLabel}
                    onChange={(e) => patchTrack(t.key, { trackLabel: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field
                  label="Style slugs"
                  hint="Comma-separated, e.g. salsa, bachata. Used to find the matching batch for the date."
                >
                  <input
                    value={t.styleSlugs.join(', ')}
                    onChange={(e) =>
                      patchTrack(t.key, {
                        styleSlugs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="input"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Select
                  label="Time of day"
                  value={t.weekendTod}
                  onChange={(v) => patchTrack(t.key, { weekendTod: v as 'AM' | 'PM' })}
                  options={[
                    { value: 'AM', label: 'AM (morning)' },
                    { value: 'PM', label: 'PM (evening)' },
                  ]}
                />
                <Field label="Days (fallback)" hint="e.g. Saturday & Sunday">
                  <input
                    value={t.whenDays}
                    onChange={(e) => patchTrack(t.key, { whenDays: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Time (fallback)" hint="e.g. 9:30 AM – 10:30 AM">
                  <input
                    value={t.whenTime}
                    onChange={(e) => patchTrack(t.key, { whenTime: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Arrive by (fallback)" hint="e.g. 9:15 AM">
                  <input
                    value={t.arriveBy}
                    onChange={(e) => patchTrack(t.key, { arriveBy: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="SEO description" hint="Shown in the browser tab / link previews.">
                <input
                  value={t.metaDesc}
                  onChange={(e) => patchTrack(t.key, { metaDesc: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          ))}
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

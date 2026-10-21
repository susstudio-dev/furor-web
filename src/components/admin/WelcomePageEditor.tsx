'use client';

import { useState } from 'react';
import type { SiteContent, Welcome, WelcomeTrack } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, Select, EditorStyles } from '@/components/admin/fields';
import { saveSiteContent } from '@/lib/admin-save';
import { useAutosave } from '@/lib/autosave';
import { AutosaveBanner } from '@/components/admin/AutosaveBanner';
import {
  duplicateTrackKeys,
  normaliseTracks,
  slugify,
  suggestTrackKey,
  unknownStyleSlugs,
} from '@/lib/welcome-tracks';

export function WelcomePageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  // Indices of tracks whose slug is still following the track label. Only
  // tracks added in THIS session start linked, and typing in the slug field
  // unlinks one for good: an already-saved slug is the redirect target on a
  // live Razorpay payment page, so it must never move on its own.
  const [linked, setLinked] = useState<ReadonlySet<number>>(() => new Set());
  // Subtree only - see AboutPageEditor.
  const autosave = useAutosave('welcome', c.welcome, dirty);

  const w = c.welcome;
  const knownStyleSlugs = c.danceStyles.map((s) => s.slug);

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
          level: 'Foundation',
          weekendTod: 'AM',
          whenDays: 'Saturday & Sunday',
          whenTime: '',
          arriveBy: '',
          metaDesc: '',
        },
      ],
    });
    // A brand-new page has no URL in the wild yet, so its slug can safely
    // follow the label until the studio types a slug of its own.
    setLinked((prev) => new Set(prev).add(w.tracks.length));
  }
  function removeTrack(i: number) {
    if (
      !confirm(
        'Remove this welcome page? Make sure no Razorpay page still redirects to its URL first.',
      )
    )
      return;
    patchWelcome({ tracks: w.tracks.filter((_, j) => j !== i) });
    // Tracks are identified by index, so removing one shifts every later link.
    setLinked((prev) => {
      const next = new Set<number>();
      for (const j of prev) {
        if (j < i) next.add(j);
        else if (j > i) next.add(j - 1);
      }
      return next;
    });
  }
  function unlink(i: number) {
    setLinked((prev) => {
      if (!prev.has(i)) return prev;
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  }

  async function save() {
    // Fill blank slugs from the track label (the schema requires a key and the
    // URL needs it) and slugify the hand-typed style slugs, which are matched
    // against batches exactly.
    const tracks = normaliseTracks(c.welcome.tracks);
    // /welcome/[track] resolves with find(), so a repeated slug would save a
    // page that can never be opened. Refuse rather than lose it silently —
    // SaveBar surfaces the message.
    const dups = duplicateTrackKeys(tracks);
    if (dups.length) {
      throw new Error(
        `Two welcome pages share the URL /welcome/${dups[0]} — only the first would ever open. Give each page a unique slug, then save.`,
      );
    }
    const cleaned: SiteContent = {
      ...c,
      welcome: { ...c.welcome, tracks },
    };
    await saveSiteContent(cleaned);
    setC(cleaned);
    setDirty(false);
    // Every slug is now published and can be a Razorpay redirect target, so
    // none of them may follow their label any longer.
    setLinked(new Set());
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
            // Links are by track index, and a restored stash can hold a
            // different set of tracks entirely.
            setLinked(new Set());
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
          {txt('WhatsApp button', 'unconfirmedCta')}
          {txt('Try-again button', 'tryAgainLabel')}
          {txt('Reference line', 'referenceLabel', 'Use {id} for the payment reference.')}
        </Section>

        <Section title="Buttons & references">
          {txt('Search / tab title', 'seoTitle', 'Leave empty to keep “You’re in — Furor Hyderabad”.')}
          {txt('Google Calendar button', 'gcalLabel')}
          {txt('Apple / Outlook button', 'icsLabel')}
          {txt(
            'Payment reference line',
            'paymentReferenceLabel',
            'Shown under the headline once payment is confirmed. Use {id}.',
          )}
        </Section>

        <Section title="Intake details — headings and fallbacks">
          <p className="-mt-1 text-xs text-cream/50">
            The venue, days, times and arrival time are filled in automatically from the batch and
            the studio. These are the words around them, and what we say when a batch has no venue
            or date yet. (The “Where” heading itself lives in Labels.)
          </p>
          {area(
            'When there is no venue yet',
            'noVenueNote',
            'Shown instead of the address when the batch has no studio set.',
          )}
          {txt('“When” heading', 'whenHeading')}
          {txt('Days line', 'whenEvery', 'Use {days} — e.g. “Every Saturday & Sunday”.')}
          {txt('Arrival note', 'arriveByNote', 'Use {time} for the arrive-by time.')}
          {area(
            'When there is no date yet',
            'noDateNote',
            'Shown instead of the calendar buttons when no upcoming batch date is set.',
          )}
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
            const isLinked = linked.has(i);
            // Offered as a chip rather than applied — an already-saved slug is
            // a live Razorpay redirect target. Only where the studio is
            // actually stuck, though: a page whose slug is deliberately
            // shorter than its label ("latin" for "Latin beginner class") is
            // right as it stands, and suggesting "latin-beginner-class" at it
            // forever would be worse than saying nothing. Linked tracks apply
            // the slug as you type, so they never need the chip.
            const suggestion =
              !isLinked && (dup || !slug) ? suggestTrackKey(t.trackLabel, t.key) : null;
            const unknownStyles = unknownStyleSlugs(t.styleSlugs, knownStyleSlugs);
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
                      onChange={(e) => {
                        patchTrackAt(i, { key: slugify(e.target.value) });
                        unlink(i);
                      }}
                      placeholder="e.g. kizomba"
                      className="input"
                    />
                  </Field>
                  <Field label="Track label" hint="e.g. Latin beginner class. Shown in the copy as {trackLabel}.">
                    <input
                      value={t.trackLabel}
                      onChange={(e) => {
                        const trackLabel = e.target.value;
                        // A never-saved page's slug follows the label until the
                        // studio types its own; a saved one never moves itself.
                        patchTrackAt(
                          i,
                          isLinked ? { trackLabel, key: slugify(trackLabel) } : { trackLabel },
                        );
                      }}
                      className="input"
                    />
                  </Field>
                </div>
                {dup ? (
                  <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    Another welcome page already uses this slug, and only the first one would ever
                    open. Give this page its own — two classes in the same style can each have their
                    own page (e.g. <code>salsa-intermediate</code>), and the class date, time and
                    venue still come from whichever batch you point it at below.
                  </p>
                ) : null}
                {suggestion ? (
                  <p className="text-xs text-cream/50">
                    From the track label:{' '}
                    <button
                      type="button"
                      onClick={() => patchTrackAt(i, { key: suggestion })}
                      className="rounded-full border border-ember-500/50 px-2 py-0.5 font-mono text-ember-300 hover:border-ember-400 hover:text-ember-200"
                    >
                      use /welcome/{suggestion}
                    </button>{' '}
                    {slug
                      ? '— changing a slug moves the page URL, so update the Razorpay redirect that points at the old one.'
                      : '— this page has no URL yet.'}
                  </p>
                ) : null}
                <Field
                  label="Style slugs"
                  hint={`Comma-separated. Matched against batches exactly — one of: ${knownStyleSlugs.join(', ')}.`}
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
                {unknownStyles.length ? (
                  <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    No dance style uses {unknownStyles.map((s) => `“${s}”`).join(', ')}. Style slugs
                    are matched exactly (lowercase, hyphenated), so this page would show no date,
                    venue or calendar links — only the fallbacks below. Known styles:{' '}
                    {knownStyleSlugs.join(', ')}.
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Level"
                    value={t.level}
                    onChange={(v) => patchTrackAt(i, { level: v as WelcomeTrack['level'] })}
                    hint="Must match the level on the batch this page is for."
                    options={[
                      { value: 'Foundation', label: 'Foundation (beginner)' },
                      { value: 'Intermediate', label: 'Intermediate' },
                      { value: 'Advanced', label: 'Advanced' },
                    ]}
                  />
                  <Select
                    label="Time of day"
                    value={t.weekendTod}
                    onChange={(v) => patchTrackAt(i, { weekendTod: v as 'AM' | 'PM' })}
                    hint="Which sitting to prefer when a style runs more than one."
                    options={[
                      { value: 'AM', label: 'AM (morning)' },
                      { value: 'PM', label: 'PM (evening)' },
                    ]}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
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

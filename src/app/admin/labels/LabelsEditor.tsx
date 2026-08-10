'use client';

import { useMemo, useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { EditorStyles } from '@/components/admin/fields';
import { LABEL_DEFAULTS, PILL_CHAR_LIMIT, PILL_KEYS, type LabelKey } from '@/lib/labels';
import { saveSiteContent } from '@/lib/admin-save';

// Grouped by name prefix only — deliberately not by nesting. The document key
// is flat for parse cost (see content-schema.ts), so the grouping lives here,
// in the one place a human reads it. Every key in LABEL_DEFAULTS starts with
// exactly one of these prefixes.
const GROUPS: { prefix: string; title: string; blurb: string }[] = [
  { prefix: 'cta', title: 'Buttons', blurb: 'Every call-to-action verb on the site.' },
  { prefix: 'nav', title: 'Menu items', blurb: 'Header menu and the footer Explore list.' },
  {
    prefix: 'empty',
    title: 'When there is nothing to show',
    blurb: 'Shown when a list comes back empty. {style} and {track} are filled in for you.',
  },
  { prefix: 'badge', title: 'Badges', blurb: 'The small chips on batch cards and rows.' },
  { prefix: 'aria', title: 'Screen-reader text', blurb: 'Read aloud, never shown on screen.' },
  {
    prefix: 'welcome',
    title: 'After payment',
    blurb:
      'Headings and buttons on the confirmation page. {notes} and {phone} are filled in for you.',
  },
];

const ALL_KEYS = Object.keys(LABEL_DEFAULTS) as LabelKey[];

// Counts code POINTS, not UTF-16 code units: this copy contains "·", "→" and
// emoji, and .length would tell a studio their 13-character badge is 15.
function charCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

export function LabelsEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState('');

  function patch(key: LabelKey, value: string) {
    setC((prev) => {
      const labels: SiteContent['labels'] = { ...prev.labels, [key]: value };
      return { ...prev, labels };
    });
    setDirty(true);
  }

  // Search matches the key, the shipped default AND the current value, so
  // "whatsapp" still finds ctaChatWhatsapp after it has been renamed to
  // "Message us".
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return new Set<LabelKey>(ALL_KEYS);
    return new Set<LabelKey>(
      ALL_KEYS.filter(
        (k) =>
          k.toLowerCase().includes(needle) ||
          LABEL_DEFAULTS[k].toLowerCase().includes(needle) ||
          (c.labels[k] ?? '').toLowerCase().includes(needle),
      ),
    );
  }, [q, c.labels]);

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search — try “whatsapp”, “book”, “menu”"
          className="input"
          aria-label="Search labels"
        />
        <p className="mt-1.5 text-xs text-cream/40">
          {matches.size} of {ALL_KEYS.length} labels
        </p>
      </div>

      <div className="mt-6 grid gap-6">
        {GROUPS.map((g) => {
          const keys = ALL_KEYS.filter((k) => k.startsWith(g.prefix) && matches.has(k));
          if (keys.length === 0) return null;
          return (
            <div key={g.prefix} className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5">
              <p className="display text-sm uppercase tracking-widest text-ember-400">{g.title}</p>
              <p className="mt-1 text-xs text-cream/50">{g.blurb}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {keys.map((k) => {
                  const value = c.labels[k] ?? '';
                  const shown = value.trim() === '' ? LABEL_DEFAULTS[k] : value;
                  const over = PILL_KEYS.has(k) && charCount(shown) > PILL_CHAR_LIMIT;
                  return (
                    <label key={k} className="block">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-xs uppercase tracking-widest text-cream/60">{k}</span>
                        {value.trim() !== '' ? (
                          <button
                            type="button"
                            onClick={() => patch(k, '')}
                            className="text-[11px] text-cream/40 hover:text-ember-400"
                          >
                            Reset to default
                          </button>
                        ) : null}
                      </span>
                      <div className="mt-1.5">
                        <input
                          value={value}
                          onChange={(e) => patch(k, e.target.value)}
                          placeholder={LABEL_DEFAULTS[k]}
                          className="input"
                        />
                      </div>
                      {PILL_KEYS.has(k) ? (
                        <p className={`mt-1 text-xs ${over ? 'text-gold-400' : 'text-cream/40'}`}>
                          {charCount(shown)}/{PILL_CHAR_LIMIT} characters
                          {over ? ' — too long, it will be cut off' : ''} · shown in a small rounded
                          chip that never wraps.
                        </p>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

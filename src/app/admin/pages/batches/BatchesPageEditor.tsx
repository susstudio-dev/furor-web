'use client';

import { useState } from 'react';
import type { BatchesPage, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { SeoFields } from '@/components/admin/SeoFields';
import { CharCount } from '@/components/admin/CharCount';
import { PILL_CHAR_LIMIT } from '@/lib/labels';
import { saveSiteContent } from '@/lib/admin-save';

type Browser = BatchesPage['browser'];
type BrowserKey = keyof Browser;

// The thirteen values that render inside a .pill on /batches — the five quick
// picks and the eight derived option labels. `.pill` is whitespace-nowrap
// inside overflow-clip wrappers, so a long value razor-cuts itself with no
// warning. Same budget as Plan 1's PILL_KEYS, which covers the label bag.
const PILL_FIELDS = new Set<BrowserKey>([
  'presetBeginner',
  'presetWeekend',
  'presetEvening',
  'presetStartingSoon',
  'presetFillingFast',
  'todMorning',
  'todAfternoon',
  'todEvening',
  'startingThisMonth',
  'startingNext30',
  'startingLater',
  'filterWeekends',
  'filterWeekdays',
]);

const GROUPS: { title: string; blurb: string; fields: { key: BrowserKey; label: string; hint?: string }[] }[] = [
  {
    title: 'Quick picks',
    blurb: 'The one-tap filter chips along the top of the page.',
    fields: [
      { key: 'presetBeginner', label: 'Beginner preset' },
      { key: 'presetWeekend', label: 'Weekend preset' },
      { key: 'presetEvening', label: 'Evening preset' },
      { key: 'presetStartingSoon', label: 'Starting-soon preset' },
      { key: 'presetFillingFast', label: 'Filling-fast preset' },
    ],
  },
  {
    title: 'Filter bar',
    blurb: 'The controls around the filters — headings, buttons and the sort menu.',
    fields: [
      { key: 'filterQuickPicks', label: '“Quick picks” heading' },
      { key: 'filterShowAll', label: 'Show-filters button (mobile)' },
      { key: 'filterHide', label: 'Hide-filters button (mobile)' },
      { key: 'filterClearAll', label: 'Clear-all link' },
      { key: 'filterClearAction', label: 'Clear-filters button (empty state)' },
      { key: 'filterRemoveTitle', label: 'Remove-filter tooltip', hint: 'Shown on hover over an active filter chip.' },
      { key: 'filterSortLabel', label: 'Sort label' },
      { key: 'filterSortLevel', label: 'Sort option — beginner first' },
      { key: 'filterSortSoon', label: 'Sort option — soonest first' },
      { key: 'filterSortLate', label: 'Sort option — latest first' },
    ],
  },
  {
    title: 'Filter group headings',
    blurb: 'The small uppercase heading above each set of filter chips.',
    fields: [
      { key: 'facetStyle', label: 'Dance style group' },
      { key: 'facetLevel', label: 'Level group' },
      { key: 'facetBranch', label: 'Studio group', hint: 'Only shown when you have more than one studio.' },
      { key: 'facetTod', label: 'Time-of-day group' },
      { key: 'facetDays', label: 'Days group' },
      { key: 'facetStarting', label: 'Start-date group' },
      { key: 'facetPrice', label: 'Price group' },
      { key: 'facetStatus', label: 'Availability group' },
    ],
  },
  {
    title: 'Filter chip wording',
    blurb:
      'What each chip says. These are labels only — the values behind them are part of the page address, so a shared or bookmarked filter link keeps working however you word these.',
    fields: [
      { key: 'filterWeekends', label: 'Weekend chip' },
      { key: 'filterWeekdays', label: 'Weekday chip' },
      { key: 'todMorning', label: 'Morning chip' },
      { key: 'todAfternoon', label: 'Afternoon chip' },
      { key: 'todEvening', label: 'Evening chip' },
      { key: 'startingThisMonth', label: 'Starting this month chip' },
      { key: 'startingNext30', label: 'Starting in 30 days chip' },
      { key: 'startingLater', label: 'Starting later chip' },
    ],
  },
  {
    title: 'Batch rows',
    blurb: 'The three bits of wording on the result list itself.',
    fields: [
      { key: 'resultCount', label: 'Result count', hint: 'Use {n} for how many are showing and {total} for how many there are.' },
      { key: 'seatsTemplate', label: 'Seats left', hint: 'Use {n} for the number of seats.' },
      { key: 'startsPrefix', label: 'Start-date prefix', hint: 'The word before the date, e.g. “starts 5 Sep”.' },
    ],
  },
];

export function BatchesPageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  const p = c.pages.batches;

  function patchPage(patch: Partial<BatchesPage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, batches: { ...prev.pages.batches, ...patch } },
    }));
    setDirty(true);
  }

  function patchBrowser(key: BrowserKey, value: string) {
    setC((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        batches: {
          ...prev.pages.batches,
          browser: { ...prev.pages.batches.browser, [key]: value },
        },
      },
    }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <SeoFields
          pageKey="batches"
          value={{ seoTitle: p.seoTitle, seoDescription: p.seoDescription }}
          onChange={(next) => patchPage(next)}
        />

        <Section title="Header">
          <PageIntroFields value={p.intro} onChange={(v) => patchPage({ intro: v })} />
        </Section>

        {GROUPS.map((g) => (
          <Section key={g.title} title={g.title} blurb={g.blurb}>
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input
                  value={p.browser[f.key]}
                  onChange={(e) => patchBrowser(f.key, e.target.value)}
                  className="input"
                />
                {PILL_FIELDS.has(f.key) ? (
                  <CharCount
                    text={p.browser[f.key]}
                    max={PILL_CHAR_LIMIT}
                    note="shown in a small rounded chip — longer text gets cut off on phones"
                  />
                ) : null}
              </Field>
            ))}
          </Section>
        ))}
      </div>

      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
      <p className="display text-sm uppercase tracking-widest text-ember-400">{title}</p>
      {blurb ? <p className="-mt-1 text-xs text-cream/50">{blurb}</p> : null}
      {children}
    </div>
  );
}

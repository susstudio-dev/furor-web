'use client';

import { CharCount } from '@/components/admin/CharCount';
import { Field } from '@/components/admin/fields';
import { PAGE_SEO_DEFAULTS, type PageMetaKey } from '@/lib/page-meta';
import { SEO_DESC_CHARS, SEO_TITLE_CHARS } from '@/lib/seo';

export interface SeoValue {
  seoTitle: string;
  seoDescription: string;
}

/**
 * The search-result title and description for one page.
 *
 * Both still pass through fitTitle / fitDescription at render time, so an
 * over-long value is trimmed rather than shipped broken. The counters exist so
 * the editor finds that out here rather than from Google. The greyed-out
 * placeholder is the exact string the page renders when the box is empty.
 */
export function SeoFields({
  pageKey,
  value,
  onChange,
  titleHint = 'The site name is added after this automatically.',
}: {
  pageKey: PageMetaKey;
  value: SeoValue;
  onChange: (next: SeoValue) => void;
  titleHint?: string;
}) {
  const shipped = PAGE_SEO_DEFAULTS[pageKey];
  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Search results</p>
      <p className="text-xs text-cream/50">
        What Google shows for this page. Leave a box empty to keep the wording we ship — the grey
        text inside it is that wording.
      </p>
      <Field label="Search title" hint={titleHint}>
        <input
          value={value.seoTitle}
          onChange={(e) => onChange({ ...value, seoTitle: e.target.value })}
          placeholder={shipped.title}
          className="input"
        />
        <CharCount
          text={value.seoTitle || shipped.title}
          max={SEO_TITLE_CHARS}
          note="the site name is added after this"
        />
      </Field>
      <Field
        label="Search description"
        hint="One or two sentences. Google shows about 155 characters."
      >
        <textarea
          rows={3}
          value={value.seoDescription}
          onChange={(e) => onChange({ ...value, seoDescription: e.target.value })}
          placeholder={shipped.description}
          className="input"
        />
        <CharCount text={value.seoDescription || shipped.description} max={SEO_DESC_CHARS} />
      </Field>
    </div>
  );
}

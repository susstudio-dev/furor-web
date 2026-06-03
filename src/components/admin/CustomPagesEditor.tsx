'use client';

import { useState } from 'react';
import type { SiteContent, CustomPage } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { saveSiteContent } from '@/lib/admin-save';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function newPage(): CustomPage {
  return {
    id: `page-${Math.random().toString(36).slice(2, 8)}`,
    slug: '',
    title: 'New page',
    navLabel: '',
    seoDescription: '',
    showInFooter: true,
    showInNav: false,
    published: true,
    intro: { eyebrow: '', headline: 'New page', lead: '' },
    sections: [],
    displayOrder: 0,
  };
}

export function CustomPagesEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pages = c.customPages;

  function patchList(next: CustomPage[]) {
    setC((prev) => ({ ...prev, customPages: next }));
    setDirty(true);
  }
  function patchPage(id: string, p: Partial<CustomPage>) {
    patchList(pages.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function add() {
    const p = newPage();
    patchList([...pages, { ...p, displayOrder: pages.length }]);
    setExpandedId(p.id);
  }
  function remove(id: string) {
    if (!confirm('Delete this page? This cannot be undone after you save.')) return;
    patchList(pages.filter((p) => p.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const i = pages.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= pages.length) return;
    const next = pages.slice();
    [next[i], next[j]] = [next[j], next[i]];
    next.forEach((p, idx) => (p.displayOrder = idx));
    patchList(next);
  }

  async function save() {
    // Auto-fill blank slugs from title before saving.
    const cleaned = {
      ...c,
      customPages: c.customPages.map((p) => ({
        ...p,
        slug: p.slug.trim() || slugify(p.title),
      })),
    };
    await saveSiteContent(cleaned);
    setC(cleaned);
    setDirty(false);
  }

  // Slug collision check — surfaces in the row.
  const slugCount = new Map<string, number>();
  pages.forEach((p) => {
    const k = (p.slug || slugify(p.title)).trim();
    if (k) slugCount.set(k, (slugCount.get(k) || 0) + 1);
  });

  return (
    <>
      <EditorStyles />
      <div className="mt-8 grid gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-cream/70">
            {pages.length === 0
              ? 'No custom pages yet. Add one to render at /p/<slug>.'
              : `${pages.length} custom page${pages.length === 1 ? '' : 's'}.`}
          </p>
          <button
            type="button"
            onClick={add}
            className="rounded-full bg-ember-500 text-cream px-4 py-2 text-sm font-semibold hover:bg-ember-600"
          >
            + Add page
          </button>
        </div>

        {pages.map((p, i) => {
          const open = expandedId === p.id;
          const effectiveSlug = p.slug.trim() || slugify(p.title);
          const dup =
            effectiveSlug && (slugCount.get(effectiveSlug) || 0) > 1
              ? 'This slug is already used by another page.'
              : null;
          return (
            <div
              key={p.id}
              className="rounded-2xl border border-cream/10 bg-ink-900/30"
            >
              <div className="flex items-center gap-3 p-4">
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : p.id)}
                  className="flex-1 text-left"
                >
                  <p className="font-semibold text-cream">{p.title || '(untitled)'}</p>
                  <p className="text-xs text-cream/50 mt-0.5">
                    /p/{effectiveSlug || '(empty)'} ·{' '}
                    {p.published ? 'published' : 'draft'}
                    {p.showInNav ? ' · in main nav' : ''}
                    {p.showInFooter ? ' · in footer' : ''}
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(p.id, -1)}
                    disabled={i === 0}
                    className="px-2 text-cream/50 hover:text-cream disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(p.id, +1)}
                    disabled={i === pages.length - 1}
                    className="px-2 text-cream/50 hover:text-cream disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : p.id)}
                    className="ml-2 rounded-full bg-cream/5 px-3 py-1 text-xs text-cream/80 hover:bg-cream/10"
                  >
                    {open ? 'Close' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="text-xs text-rose-400 hover:text-rose-300 ml-1"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {open ? (
                <div className="border-t border-cream/10 p-4 grid gap-5">
                  {dup ? (
                    <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      {dup}
                    </p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Title" hint="Shown in the browser tab.">
                      <input
                        value={p.title}
                        onChange={(e) => patchPage(p.id, { title: e.target.value })}
                        className="input"
                      />
                    </Field>
                    <Field
                      label="Slug (URL)"
                      hint="The page will live at /p/<slug>. Lowercase, hyphens only. Auto-fills from title."
                    >
                      <input
                        value={p.slug}
                        onChange={(e) => patchPage(p.id, { slug: slugify(e.target.value) })}
                        placeholder={slugify(p.title)}
                        className="input"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Footer label" hint="Optional. Defaults to the title.">
                      <input
                        value={p.navLabel}
                        onChange={(e) => patchPage(p.id, { navLabel: e.target.value })}
                        className="input"
                        placeholder={p.title}
                      />
                    </Field>
                    <Field
                      label="SEO description"
                      hint="Optional. Shown in search engines + social cards."
                    >
                      <input
                        value={p.seoDescription}
                        onChange={(e) => patchPage(p.id, { seoDescription: e.target.value })}
                        className="input"
                      />
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-5">
                    <label className="inline-flex items-center gap-2 text-sm text-cream/80">
                      <input
                        type="checkbox"
                        checked={p.published}
                        onChange={(e) => patchPage(p.id, { published: e.target.checked })}
                      />
                      Published
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-cream/80">
                      <input
                        type="checkbox"
                        checked={p.showInFooter}
                        onChange={(e) => patchPage(p.id, { showInFooter: e.target.checked })}
                      />
                      Link in footer
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-cream/80">
                      <input
                        type="checkbox"
                        checked={p.showInNav}
                        onChange={(e) => patchPage(p.id, { showInNav: e.target.checked })}
                      />
                      Link in main nav
                    </label>
                  </div>

                  <Section title="Page header">
                    <PageIntroFields
                      value={p.intro}
                      onChange={(v) => patchPage(p.id, { intro: v })}
                    />
                  </Section>

                  <Section title="Sections">
                    {p.sections.map((s, si) => (
                      <div
                        key={si}
                        className="grid gap-3 rounded-2xl border border-cream/10 bg-ink-900/40 p-4"
                      >
                        <Field label={`Heading ${si + 1}`}>
                          <input
                            value={s.heading}
                            onChange={(e) => {
                              const next = p.sections.slice();
                              next[si] = { ...next[si], heading: e.target.value };
                              patchPage(p.id, { sections: next });
                            }}
                            className="input"
                          />
                        </Field>
                        <Field label="Body">
                          <textarea
                            rows={4}
                            value={s.body}
                            onChange={(e) => {
                              const next = p.sections.slice();
                              next[si] = { ...next[si], body: e.target.value };
                              patchPage(p.id, { sections: next });
                            }}
                            className="input"
                          />
                        </Field>
                        <div className="flex justify-between">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (si === 0) return;
                                const next = p.sections.slice();
                                [next[si - 1], next[si]] = [next[si], next[si - 1]];
                                patchPage(p.id, { sections: next });
                              }}
                              disabled={si === 0}
                              className="text-xs text-cream/60 hover:text-cream disabled:opacity-30"
                            >
                              ↑ Up
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (si === p.sections.length - 1) return;
                                const next = p.sections.slice();
                                [next[si], next[si + 1]] = [next[si + 1], next[si]];
                                patchPage(p.id, { sections: next });
                              }}
                              disabled={si === p.sections.length - 1}
                              className="text-xs text-cream/60 hover:text-cream disabled:opacity-30"
                            >
                              ↓ Down
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              patchPage(p.id, {
                                sections: p.sections.filter((_, j) => j !== si),
                              })
                            }
                            className="text-xs text-rose-400 hover:text-rose-300"
                          >
                            Remove section
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        patchPage(p.id, {
                          sections: [...p.sections, { heading: '', body: '' }],
                        })
                      }
                      className="rounded-full bg-cream/10 px-4 py-2 text-sm text-cream/80 hover:bg-cream/15 w-fit"
                    >
                      + Add section
                    </button>
                  </Section>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <SaveBar dirty={dirty} onSave={save} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-cream/10 bg-ink-900/20 p-4">
      <p className="display text-xs uppercase tracking-widest text-cream/50 mb-3">{title}</p>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

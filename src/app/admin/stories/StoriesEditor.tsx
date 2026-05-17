'use client';

import { useState } from 'react';
import { randomId } from '@/lib/id';
import type { SiteContent, Story } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { saveSiteContent } from '@/lib/admin-save';

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function StoriesEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initial.stories[0]?.id ?? null);

  function patch(idx: number, p: Partial<Story>) {
    setC((prev) => ({
      ...prev,
      stories: prev.stories.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    }));
    setDirty(true);
  }
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= c.stories.length) return;
    const next = c.stories.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setC((prev) => ({ ...prev, stories: next }));
    setDirty(true);
  }
  function add() {
    const today = new Date().toISOString().slice(0, 10);
    const n = c.stories.length + 1;
    const suffix = c.stories.some((s) => s.slug === 'new-story') ? `-${n}` : '';
    const fresh: Story = {
      id: randomId('story'),
      slug: `new-story${suffix}`,
      title: 'New story',
      publishedAt: today,
      heroImage: '',
      excerpt: '',
      body: 'Story body — replace this with the post content. Blank lines create paragraph breaks.',
    };
    setC((prev) => ({ ...prev, stories: [fresh, ...prev.stories] }));
    setOpenId(fresh.id);
    setDirty(true);
  }
  function remove(idx: number) {
    if (!confirm(`Delete story "${c.stories[idx].title}"?`)) return;
    setC((prev) => ({ ...prev, stories: prev.stories.filter((_, i) => i !== idx) }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={add} className="btn-primary">+ Add story</button>
        <p className="text-cream/50 text-sm">{c.stories.length} total</p>
      </div>

      <div className="mt-6 grid gap-3">
        {c.stories.map((s, i) => {
          const open = openId === s.id;
          return (
            <div key={s.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-cream/5"
              >
                <div className="text-left">
                  <p className="display text-lg font-bold">{s.title || '(untitled)'}</p>
                  <p className="text-cream/60 text-sm">
                    {s.publishedAt} · /stories/{s.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(i, -1);
                    }}
                    className="rounded-md bg-cream/5 hover:bg-cream/10 px-2 py-1 text-xs text-cream/70"
                  >
                    ↑
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      move(i, 1);
                    }}
                    className="rounded-md bg-cream/5 hover:bg-cream/10 px-2 py-1 text-xs text-cream/70"
                  >
                    ↓
                  </span>
                  <span className="text-cream/50 text-sm">{open ? '▾' : '▸'}</span>
                </div>
              </button>
              {open ? (
                <div className="border-t border-cream/10 p-5 grid gap-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Title">
                      <input
                        value={s.title}
                        onChange={(e) => {
                          const title = e.target.value;
                          patch(i, {
                            title,
                            slug:
                              !s.slug || s.slug === slugify(s.title)
                                ? slugify(title) || s.slug
                                : s.slug,
                          });
                        }}
                        className="input"
                      />
                    </Field>
                    <Field label="Slug" hint="URL fragment under /stories/. Lowercase, hyphens only.">
                      <input
                        value={s.slug}
                        onChange={(e) => patch(i, { slug: slugify(e.target.value) })}
                        className="input"
                      />
                    </Field>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Published date">
                      <input
                        type="date"
                        value={s.publishedAt}
                        onChange={(e) => patch(i, { publishedAt: e.target.value })}
                        className="input"
                      />
                    </Field>
                  </div>

                  <ImageUploader
                    label="Cover image"
                    value={s.heroImage || ''}
                    onChange={(v) => patch(i, { heroImage: v })}
                    aspect="wide"
                  />

                  <Field label="Excerpt" hint="One sentence shown on the stories index card.">
                    <textarea
                      rows={2}
                      value={s.excerpt || ''}
                      onChange={(e) => patch(i, { excerpt: e.target.value })}
                      className="input"
                    />
                  </Field>

                  <Field
                    label="Body"
                    hint="Plain text with line breaks. A blank line creates a new paragraph. Markdown formatting is not rendered (yet)."
                  >
                    <textarea
                      rows={14}
                      value={s.body}
                      onChange={(e) => patch(i, { body: e.target.value })}
                      className="input font-mono text-sm"
                    />
                  </Field>

                  <div className="flex justify-end">
                    <button onClick={() => remove(i)} className="text-sm text-cream/40 hover:text-ember-400">
                      Delete story
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

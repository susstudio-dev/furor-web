'use client';

import { useState } from 'react';
import type { SiteContent, CustomPage, CustomBlock } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, Select, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { saveSiteContent } from '@/lib/admin-save';
import { useAutosave } from '@/lib/autosave';
import { AutosaveBanner } from '@/components/admin/AutosaveBanner';

// Pages created before the block builder existed stored their body as text-only
// `sections`. Convert those to equivalent heading/text blocks the first time the
// editor loads, so everything is edited as blocks from here on. Saving persists
// the migration; until then the public renderer still falls back to `sections`.
function migrateBlocks(c: SiteContent): SiteContent {
  return {
    ...c,
    customPages: (c.customPages ?? []).map((p) => {
      if (p.blocks.length > 0 || p.sections.length === 0) return p;
      const blocks: CustomBlock[] = [];
      for (const s of p.sections) {
        if (s.heading) blocks.push({ type: 'heading', text: s.heading });
        if (s.body) blocks.push({ type: 'text', body: s.body });
      }
      return { ...p, blocks, sections: [] };
    }),
  };
}

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
    noindex: false,
    intro: { eyebrow: '', headline: 'New page', lead: '' },
    sections: [],
    blocks: [],
    displayOrder: 0,
  };
}

export function CustomPagesEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(() => migrateBlocks(initial));
  const [dirty, setDirty] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Subtree only - see AboutPageEditor.
  const autosave = useAutosave('customPages', c.customPages, dirty);

  const pages = c.customPages;

  function patchList(next: CustomPage[]) {
    setC((prev) => ({ ...prev, customPages: next }));
    setDirty(true);
  }
  function patchPage(id: string, p: Partial<CustomPage>) {
    patchList(pages.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  // ── block helpers (operate on one page's `blocks` array) ──────────────────
  function addBlock(id: string, block: CustomBlock) {
    const page = pages.find((x) => x.id === id);
    if (page) patchPage(id, { blocks: [...page.blocks, block] });
  }
  function patchBlock(id: string, bi: number, block: CustomBlock) {
    const page = pages.find((x) => x.id === id);
    if (!page) return;
    const next = page.blocks.slice();
    next[bi] = block;
    patchPage(id, { blocks: next });
  }
  function removeBlock(id: string, bi: number) {
    const page = pages.find((x) => x.id === id);
    if (page) patchPage(id, { blocks: page.blocks.filter((_, j) => j !== bi) });
  }
  function moveBlock(id: string, bi: number, dir: -1 | 1) {
    const page = pages.find((x) => x.id === id);
    if (!page) return;
    const j = bi + dir;
    if (j < 0 || j >= page.blocks.length) return;
    const next = page.blocks.slice();
    [next[bi], next[j]] = [next[j], next[bi]];
    patchPage(id, { blocks: next });
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
    // Shallow copy + in-place renumbering would mutate the loaded document's
    // own objects, so a diff against that base would drop the reorder.
    const next = pages.map((p) => ({ ...p }));
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
    autosave.clear();
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
      {autosave.stash ? (
        <AutosaveBanner
          savedAt={autosave.stash.savedAt}
          matchesVersion={autosave.stashMatchesVersion}
          onRestore={() => {
            const customPages = autosave.stash!.value;
            setC((prev) => ({ ...prev, customPages }));
            setDirty(true);
            autosave.clear();
          }}
          onDiscard={autosave.clear}
        />
      ) : null}

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

                  <Section title="Content blocks">
                    <p className="-mt-1 text-xs text-cream/50">
                      Build the page from blocks — they render top to bottom. Use the arrows to
                      reorder.
                    </p>
                    {p.blocks.length === 0 ? (
                      <p className="text-sm text-cream/50">No blocks yet. Add one below.</p>
                    ) : (
                      p.blocks.map((block, bi) => (
                        <BlockEditor
                          key={bi}
                          index={bi}
                          total={p.blocks.length}
                          block={block}
                          onChange={(nb) => patchBlock(p.id, bi, nb)}
                          onMove={(dir) => moveBlock(p.id, bi, dir)}
                          onRemove={() => removeBlock(p.id, bi)}
                        />
                      ))
                    )}
                    <div className="flex flex-wrap gap-2">
                      <AddBlockButton onClick={() => addBlock(p.id, { type: 'heading', text: '' })}>
                        + Heading
                      </AddBlockButton>
                      <AddBlockButton onClick={() => addBlock(p.id, { type: 'text', body: '' })}>
                        + Text
                      </AddBlockButton>
                      <AddBlockButton
                        onClick={() =>
                          addBlock(p.id, { type: 'image', url: '', alt: '', caption: '' })
                        }
                      >
                        + Image
                      </AddBlockButton>
                      <AddBlockButton
                        onClick={() =>
                          addBlock(p.id, {
                            type: 'button',
                            label: '',
                            href: '',
                            variant: 'primary',
                          })
                        }
                      >
                        + Button
                      </AddBlockButton>
                    </div>
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

function AddBlockButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-cream/10 px-4 py-2 text-sm text-cream/80 hover:bg-cream/15"
    >
      {children}
    </button>
  );
}

const BLOCK_LABELS: Record<CustomBlock['type'], string> = {
  heading: 'Heading',
  text: 'Text',
  image: 'Image',
  button: 'Button',
};

function BlockEditor({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  block: CustomBlock;
  index: number;
  total: number;
  onChange: (next: CustomBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-cream/10 bg-ink-900/40 p-4">
      <div className="flex items-center justify-between">
        <p className="display text-xs uppercase tracking-widest text-ember-400">
          {BLOCK_LABELS[block.type]}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="px-1 text-cream/60 hover:text-cream disabled:opacity-30"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="px-1 text-cream/60 hover:text-cream disabled:opacity-30"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-rose-400 hover:text-rose-300"
          >
            Remove
          </button>
        </div>
      </div>

      {block.type === 'heading' ? (
        <Field label="Heading text" hint="Wrap a word in *asterisks* for the accent style.">
          <input
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className="input"
          />
        </Field>
      ) : null}

      {block.type === 'text' ? (
        <Field label="Paragraph" hint="Line breaks are preserved.">
          <textarea
            rows={4}
            value={block.body}
            onChange={(e) => onChange({ ...block, body: e.target.value })}
            className="input"
          />
        </Field>
      ) : null}

      {block.type === 'image' ? (
        <>
          <ImageUploader
            label="Image"
            aspect="wide"
            value={block.url}
            onChange={(url) => onChange({ ...block, url })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Alt text" hint="Describes the image for screen readers + SEO.">
              <input
                value={block.alt}
                onChange={(e) => onChange({ ...block, alt: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Caption" hint="Optional. Shown under the image.">
              <input
                value={block.caption}
                onChange={(e) => onChange({ ...block, caption: e.target.value })}
                className="input"
              />
            </Field>
          </div>
        </>
      ) : null}

      {block.type === 'button' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Button label">
            <input
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Link" hint="A URL, or a path like /batches.">
            <input
              value={block.href}
              onChange={(e) => onChange({ ...block, href: e.target.value })}
              placeholder="/batches or https://..."
              className="input"
            />
          </Field>
          <Select
            label="Style"
            value={block.variant}
            onChange={(v) => onChange({ ...block, variant: v as 'primary' | 'secondary' })}
            options={[
              { value: 'primary', label: 'Primary (filled)' },
              { value: 'secondary', label: 'Secondary (outline)' },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

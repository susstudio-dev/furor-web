'use client';

import { useState } from 'react';
import { randomId } from '@/lib/id';
import type { SiteContent, Studio } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, MultiToggle, EditorStyles } from '@/components/admin/fields';
import { ImageGalleryEditor } from '@/components/admin/ImageUploader';
import { saveSiteContent } from '@/lib/admin-save';

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function StudiosEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initial.studios[0]?.id ?? null);

  const styleOptions = c.danceStyles.map((s) => ({ value: s.slug, label: s.name }));

  function patch(idx: number, p: Partial<Studio>) {
    setC((prev) => ({
      ...prev,
      studios: prev.studios.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    }));
    setDirty(true);
  }
  function patchGeo(idx: number, p: Partial<Studio['geo']>) {
    setC((prev) => ({
      ...prev,
      studios: prev.studios.map((s, i) =>
        i === idx ? { ...s, geo: { ...s.geo, ...p } } : s,
      ),
    }));
    setDirty(true);
  }
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= c.studios.length) return;
    const next = c.studios.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((s, i) => (s.displayOrder = i + 1));
    setC((prev) => ({ ...prev, studios: next }));
    setDirty(true);
  }
  function add() {
    const n = c.studios.length + 1;
    const suffix = c.studios.some((s) => s.slug === 'new-studio') ? `-${n}` : '';
    const fresh: Studio = {
      id: randomId('studio'),
      slug: `new-studio${suffix}`,
      name: 'New studio',
      neighborhood: 'Hyderabad',
      address: 'Studio address — replace this with the full street address.',
      geo: { lat: 17.385, lng: 78.4867 },
      hours: 'Mon–Fri 9 AM–6 PM · Sat–Sun 9:30 AM–4:30 PM',
      telephone: '+91 00000 00000',
      photos: [],
      parkingNotes: '',
      styleSlugs: [],
      displayOrder: n,
    };
    setC((prev) => ({ ...prev, studios: [fresh, ...prev.studios] }));
    setOpenId(fresh.id);
    setDirty(true);
  }
  function remove(idx: number) {
    if (!confirm(`Delete studio "${c.studios[idx].name}"?`)) return;
    setC((prev) => ({ ...prev, studios: prev.studios.filter((_, i) => i !== idx) }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={add} className="btn-primary">+ Add studio</button>
        <p className="text-cream/50 text-sm">{c.studios.length} total</p>
      </div>

      <div className="mt-6 grid gap-3">
        {c.studios.map((s, i) => {
          const open = openId === s.id;
          return (
            <div key={s.id} className="rounded-2xl border border-cream/10 bg-ink-900/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-cream/5"
              >
                <div className="text-left">
                  <p className="display text-lg font-bold">{s.name || '(untitled)'}</p>
                  <p className="text-cream/60 text-sm">{s.address || '—'}</p>
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
                    <Field label="Name">
                      <input
                        value={s.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          patch(i, {
                            name,
                            slug:
                              !s.slug || s.slug === slugify(s.name)
                                ? slugify(name) || s.slug
                                : s.slug,
                          });
                        }}
                        className="input"
                      />
                    </Field>
                    <Field label="Slug">
                      <input
                        value={s.slug}
                        onChange={(e) => patch(i, { slug: slugify(e.target.value) })}
                        className="input"
                      />
                    </Field>
                  </div>

                  <Field label="Neighborhood" hint="e.g. Jubilee Hills">
                    <input
                      value={s.neighborhood}
                      onChange={(e) => patch(i, { neighborhood: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Full address">
                    <textarea
                      rows={2}
                      value={s.address}
                      onChange={(e) => patch(i, { address: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Latitude" hint="From Google Maps — share → coordinates.">
                      <input
                        type="number"
                        step="0.000001"
                        value={s.geo.lat}
                        onChange={(e) => patchGeo(i, { lat: Number(e.target.value) })}
                        className="input"
                      />
                    </Field>
                    <Field label="Longitude">
                      <input
                        type="number"
                        step="0.000001"
                        value={s.geo.lng}
                        onChange={(e) => patchGeo(i, { lng: Number(e.target.value) })}
                        className="input"
                      />
                    </Field>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Hours" hint="e.g. Mon–Fri 9 AM–6 PM · Sat–Sun 9:30 AM–4:30 PM">
                      <input value={s.hours} onChange={(e) => patch(i, { hours: e.target.value })} className="input" />
                    </Field>
                    <Field label="Telephone">
                      <input
                        value={s.telephone}
                        onChange={(e) => patch(i, { telephone: e.target.value })}
                        placeholder="+91 88860 72572"
                        className="input"
                      />
                    </Field>
                  </div>
                  <Field label="Parking notes">
                    <textarea
                      rows={2}
                      value={s.parkingNotes || ''}
                      onChange={(e) => patch(i, { parkingNotes: e.target.value })}
                      className="input"
                    />
                  </Field>

                  <MultiToggle
                    label="Styles taught here"
                    values={s.styleSlugs}
                    options={styleOptions}
                    onChange={(next) => patch(i, { styleSlugs: next })}
                    hint="Tap to toggle. Affects which batches show up on the studio page."
                  />

                  <ImageGalleryEditor
                    label="Studio photos"
                    values={s.photos}
                    onChange={(next) => patch(i, { photos: next })}
                  />

                  <div className="flex justify-end">
                    <button onClick={() => remove(i)} className="text-sm text-cream/40 hover:text-ember-400">
                      Delete studio
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

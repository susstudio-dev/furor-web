'use client';

import { useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { saveSiteContent } from '@/lib/admin-save';

export function HeroEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patch(p: Partial<SiteContent['hero']>) {
    setC((prev) => ({ ...prev, hero: { ...prev.hero, ...p } }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <Field
          label="Headline"
          hint="Use *asterisks* to emphasise a word — e.g. The night was made for *dancing*."
        >
          <input
            value={c.hero.headline}
            onChange={(e) => patch({ headline: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Sub-headline" hint="One or two sentences below the headline.">
          <textarea
            rows={3}
            value={c.hero.subHeadline}
            onChange={(e) => patch({ subHeadline: e.target.value })}
            className="input"
          />
        </Field>
        <ImageUploader
          label="Poster image"
          value={c.hero.posterImage}
          onChange={(v) => patch({ posterImage: v })}
          aspect="wide"
          hint="Used as the fallback image behind the hero video, and on mobile when the video doesn't autoplay."
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Hero video — MP4 URL" hint="Optional. Paste a hosted .mp4 URL.">
            <input
              value={c.hero.videoMp4Url || ''}
              onChange={(e) => patch({ videoMp4Url: e.target.value })}
              placeholder="https://..."
              className="input"
            />
          </Field>
          <Field label="Hero video — WebM URL" hint="Optional. Higher-quality alternate format.">
            <input
              value={c.hero.videoWebmUrl || ''}
              onChange={(e) => patch({ videoWebmUrl: e.target.value })}
              placeholder="https://..."
              className="input"
            />
          </Field>
        </div>
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

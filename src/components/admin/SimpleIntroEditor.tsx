'use client';

import { useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { saveSiteContent } from '@/lib/admin-save';
import { SeoFields } from '@/components/admin/SeoFields';

// 'batches' stays in the union for now: the plan moves it to its own
// BatchesPageEditor once pages.batches gains its 34 browser strings, but that
// schema/editor doesn't exist yet, and /admin/pages/batches/page.tsx still
// mounts this editor with pageKey="batches". Narrowing this type before that
// lands would just break that route's typecheck for no behavioural gain —
// SeoFields works identically against 'batches', a valid PageMetaKey.
type SimplePageKey = 'stories' | 'danceStyles' | 'batches';

export function SimpleIntroEditor({
  initial,
  pageKey,
}: {
  initial: SiteContent;
  pageKey: SimplePageKey;
}) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  const intro = c.pages[pageKey].intro;

  function setIntro(next: typeof intro) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, [pageKey]: { ...prev.pages[pageKey], intro: next } },
    }));
    setDirty(true);
  }

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-3">
        <SeoFields
          pageKey={pageKey}
          value={{
            seoTitle: c.pages[pageKey].seoTitle,
            seoDescription: c.pages[pageKey].seoDescription,
          }}
          onChange={(next) => {
            setC((prev) => ({
              ...prev,
              pages: { ...prev.pages, [pageKey]: { ...prev.pages[pageKey], ...next } },
            }));
            setDirty(true);
          }}
        />
        <PageIntroFields value={intro} onChange={setIntro} />
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

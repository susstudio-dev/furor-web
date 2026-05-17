'use client';

import { useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { saveSiteContent } from '@/lib/admin-save';

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
        <PageIntroFields value={intro} onChange={setIntro} />
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      <EditorStyles />
    </>
  );
}

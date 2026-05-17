'use client';

import { useState } from 'react';
import type { Pages, SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';
import { Field, EditorStyles } from '@/components/admin/fields';
import { PageIntroFields } from '@/components/admin/PageIntroFields';
import { saveSiteContent } from '@/lib/admin-save';

type ContactPage = Pages['contact'];

export function ContactPageEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patch(p: Partial<ContactPage>) {
    setC((prev) => ({
      ...prev,
      pages: { ...prev.pages, contact: { ...prev.pages.contact, ...p } },
    }));
    setDirty(true);
  }

  const p = c.pages.contact;

  async function save() {
    await saveSiteContent(c);
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Header</p>
          <PageIntroFields value={p.intro} onChange={(v) => patch({ intro: v })} />
        </div>

        <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-4">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Channel tiles</p>
          <p className="text-xs text-cream/50">
            The three cards under the headline. WhatsApp number, email, and Instagram handle come from Site & socials —
            this only edits the labels and descriptions.
          </p>

          <Tile
            heading="WhatsApp tile"
            labelValue={p.tiles.whatsappLabel}
            bodyValue={p.tiles.whatsappBody}
            onLabel={(v) => patch({ tiles: { ...p.tiles, whatsappLabel: v } })}
            onBody={(v) => patch({ tiles: { ...p.tiles, whatsappBody: v } })}
          />
          <Tile
            heading="Email tile"
            labelValue={p.tiles.emailLabel}
            bodyValue={p.tiles.emailBody}
            onLabel={(v) => patch({ tiles: { ...p.tiles, emailLabel: v } })}
            onBody={(v) => patch({ tiles: { ...p.tiles, emailBody: v } })}
          />
          <Tile
            heading="Instagram tile"
            labelValue={p.tiles.instagramLabel}
            bodyValue={p.tiles.instagramBody}
            onLabel={(v) => patch({ tiles: { ...p.tiles, instagramLabel: v } })}
            onBody={(v) => patch({ tiles: { ...p.tiles, instagramBody: v } })}
          />
        </div>

        <div className="rounded-2xl border border-cream/10 bg-ink-900/40 p-5 grid gap-3">
          <p className="display text-sm uppercase tracking-widest text-ember-400">Closing CTA</p>
          <Field label="Headline">
            <input
              value={p.closingCta.headline}
              onChange={(e) => patch({ closingCta: { ...p.closingCta, headline: e.target.value } })}
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={2}
              value={p.closingCta.body}
              onChange={(e) => patch({ closingCta: { ...p.closingCta, body: e.target.value } })}
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

function Tile({
  heading,
  labelValue,
  bodyValue,
  onLabel,
  onBody,
}: {
  heading: string;
  labelValue: string;
  bodyValue: string;
  onLabel: (v: string) => void;
  onBody: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-cream/10 p-3 grid gap-2">
      <p className="text-xs uppercase tracking-widest text-cream/50">{heading}</p>
      <Field label="Label (top of card)">
        <input value={labelValue} onChange={(e) => onLabel(e.target.value)} className="input" />
      </Field>
      <Field label="Body (description)">
        <textarea
          rows={2}
          value={bodyValue}
          onChange={(e) => onBody(e.target.value)}
          className="input"
        />
      </Field>
    </div>
  );
}

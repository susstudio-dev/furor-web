'use client';

import { useState } from 'react';
import type { SiteContent } from '@/lib/content-schema';
import { SaveBar } from '@/components/admin/SaveBar';

export function SiteEditor({ initial }: { initial: SiteContent }) {
  const [c, setC] = useState<SiteContent>(initial);
  const [dirty, setDirty] = useState(false);

  function patchSite(patch: Partial<SiteContent['site']>) {
    setC((p) => ({ ...p, site: { ...p.site, ...patch } }));
    setDirty(true);
  }
  function patchTonight(patch: Partial<SiteContent['tonight']>) {
    setC((p) => ({ ...p, tonight: { ...p.tonight, ...patch } }));
    setDirty(true);
  }

  async function save() {
    const res = await fetch('/api/admin/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(c),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Save failed');
    setDirty(false);
  }

  return (
    <>
      <div className="mt-8 grid gap-5">
        <Field label="Site title">
          <input value={c.site.title} onChange={(e) => patchSite({ title: e.target.value })} className="input" />
        </Field>
        <Field label="Tagline (used in meta description)">
          <input value={c.site.tagline} onChange={(e) => patchSite({ tagline: e.target.value })} className="input" />
        </Field>
        <Field label="WhatsApp number" hint="International format, digits only — e.g. 918886072572">
          <input
            value={c.site.whatsappNumber}
            onChange={(e) => patchSite({ whatsappNumber: e.target.value.replace(/[^0-9]/g, '') })}
            className="input"
          />
        </Field>
        <Field label="Instagram handle" hint="Without the @ — e.g. furorhyd">
          <input value={c.site.instagramHandle} onChange={(e) => patchSite({ instagramHandle: e.target.value.trim() })} className="input" />
        </Field>
        <Field label="Email (footer only)">
          <input value={c.site.email || ''} onChange={(e) => patchSite({ email: e.target.value })} className="input" />
        </Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Instagram URL">
            <input value={c.site.socials.instagram || ''} onChange={(e) => patchSite({ socials: { ...c.site.socials, instagram: e.target.value } })} className="input" />
          </Field>
          <Field label="Facebook URL">
            <input value={c.site.socials.facebook || ''} onChange={(e) => patchSite({ socials: { ...c.site.socials, facebook: e.target.value } })} className="input" />
          </Field>
          <Field label="YouTube URL">
            <input value={c.site.socials.youtube || ''} onChange={(e) => patchSite({ socials: { ...c.site.socials, youtube: e.target.value } })} className="input" />
          </Field>
        </div>
        <Field label="Footer copy">
          <textarea
            rows={2}
            value={c.site.footerCopy}
            onChange={(e) => patchSite({ footerCopy: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Notice banner (leave blank to hide)">
          <input value={c.site.notice || ''} onChange={(e) => patchSite({ notice: e.target.value })} className="input" />
        </Field>
        <Field label="Students this week (live counter on home)" hint="Set to 0 or blank to hide the counter section entirely.">
          <input
            type="number"
            min={0}
            value={c.site.stats?.studentsThisWeek ?? ''}
            onChange={(e) =>
              patchSite({
                stats: {
                  ...c.site.stats,
                  studentsThisWeek: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                },
              })
            }
            className="input"
          />
        </Field>

        <div className="mt-4 rounded-2xl border border-ember-500/30 bg-ember-500/5 p-5">
          <div className="flex items-center justify-between">
            <p className="display text-sm uppercase tracking-widest text-ember-400">Tonight at the studio</p>
            <label className="inline-flex items-center gap-2 text-sm text-cream/80">
              <input
                type="checkbox"
                checked={c.tonight.enabled}
                onChange={(e) => patchTonight({ enabled: e.target.checked })}
              />
              Show on home page
            </label>
          </div>
          <p className="mt-1 text-xs text-cream/50">When enabled, a high-contrast urgency tile appears above the closing CTA on the home page.</p>
          <div className="mt-4 grid gap-3">
            <Field label="Headline" hint="e.g. La Rumba · Latin Social">
              <input value={c.tonight.headline} onChange={(e) => patchTonight({ headline: e.target.value })} className="input" />
            </Field>
            <Field label="Body" hint="One short paragraph">
              <textarea rows={2} value={c.tonight.body} onChange={(e) => patchTonight({ body: e.target.value })} className="input" />
            </Field>
            <Field label="When" hint="e.g. Tonight · 8 PM at Jubilee Hills">
              <input value={c.tonight.when} onChange={(e) => patchTonight({ when: e.target.value })} className="input" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="CTA label" hint="Default: WhatsApp to RSVP">
                <input value={c.tonight.ctaLabel} onChange={(e) => patchTonight({ ctaLabel: e.target.value })} className="input" />
              </Field>
              <Field label="WhatsApp message context" hint="Inserted into 'Hi Furor, I'd like to come to ___.'">
                <input value={c.tonight.ctaContext} onChange={(e) => patchTonight({ ctaContext: e.target.value })} className="input" />
              </Field>
            </div>
          </div>
        </div>
      </div>
      <SaveBar dirty={dirty} onSave={save} />
      <style jsx global>{`
        .input {
          width: 100%;
          background: #ffffff;
          border: 1px solid rgba(36, 26, 18, 0.18);
          border-radius: 12px;
          padding: 10px 14px;
          color: #241a12;
          outline: none;
        }
        .input::placeholder { color: rgba(36, 26, 18, 0.4); }
        .input:focus {
          border-color: #e1591f;
        }
      `}</style>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <p className="text-xs uppercase tracking-widest text-cream/60">{label}</p>
      {hint ? <p className="text-xs text-cream/40 mt-0.5">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

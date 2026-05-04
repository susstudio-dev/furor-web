import { EnquiryCTA } from './EnquiryCTA';
import type { SiteContent } from '@/lib/content-schema';

export function TonightTile({ content }: { content: SiteContent }) {
  const t = content.tonight;
  if (!t.enabled || !t.headline || !t.body || !t.when) return null;

  return (
    <section className="container-x py-12 sm:py-16">
      <div className="relative overflow-hidden rounded-3xl border border-ember-500/40 bg-gradient-to-br from-ember-700/20 via-ink-900/60 to-ink-900 p-8 sm:p-12">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-ember-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="pill bg-ember-500/20 text-ember-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-ember-500/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ember-500" />
              </span>
              Live · {t.when}
            </p>
            <h2 className="mt-3 display text-3xl font-extrabold tracking-tight sm:text-5xl">{t.headline}</h2>
            <p className="mt-3 max-w-xl text-cream/80">{t.body}</p>
          </div>
          <div className="shrink-0">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary', customNote: t.ctaContext }}
              variant="primary"
              label={t.ctaLabel || 'WhatsApp to RSVP'}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

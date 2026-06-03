import { EnquiryCTA } from './EnquiryCTA';
import type { SiteContent } from '@/lib/content-schema';

// "Free trial" ribbon. Lives at the top of the page (just under the kinetic
// strip) so the offer is impossible to miss — first-time visitors should
// never need to message us to find out there's a free first class. Hidden
// entirely when admin disables it.
export function TrialBanner({ content }: { content: SiteContent }) {
  const t = content.trial;
  if (!t.enabled || !t.headline || !t.ctaContext) return null;

  return (
    <section className="container-x py-6 sm:py-8">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 via-ember-500/10 to-ember-500/15 px-5 py-5 sm:px-8 sm:py-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-ember-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {t.eyebrow ? (
                <span className="pill bg-emerald-500/25 text-emerald-200">
                  <span className="relative flex h-2 w-2 mr-1">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  {t.eyebrow}
                </span>
              ) : null}
              {t.when ? (
                <span className="text-xs uppercase tracking-widest text-cream/55">
                  {t.when}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 display text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t.headline}
            </h2>
            {t.body ? (
              <p className="mt-1.5 text-cream/75 text-sm sm:text-base max-w-2xl">
                {t.body}
              </p>
            ) : null}
            {t.footnote ? (
              <p className="mt-2 text-xs text-cream/45">{t.footnote}</p>
            ) : null}
          </div>
          <div className="shrink-0">
            <EnquiryCTA
              whatsappNumber={content.site.whatsappNumber}
              ctx={{ source: 'primary', customNote: t.ctaContext }}
              variant="primary"
              label={t.ctaLabel || 'Book a trial on WhatsApp'}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

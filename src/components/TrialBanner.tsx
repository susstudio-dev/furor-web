import Link from 'next/link';
import { EnquiryCTA } from './EnquiryCTA';
import type { SiteContent } from '@/lib/content-schema';

// Featured "weekend / offer" ribbon on the home page. Generic enough to host
// any admin-configured promo. Primary CTA is a Link when ctaHref is set
// (visitors stay in-app); WhatsApp is shown as a secondary "Or chat" link.
// When ctaHref is empty, WhatsApp takes over as the primary CTA.
export function TrialBanner({ content }: { content: SiteContent }) {
  const t = content.trial;
  if (!t.enabled || !t.headline) return null;

  const useLinkPrimary = !!t.ctaHref;

  return (
    <section className="container-x py-6 sm:py-8">
      <div className="relative overflow-clip rounded-3xl border border-ember-500/30 bg-gradient-to-r from-ember-500/10 via-gold-500/8 to-ember-500/10 px-5 py-5 sm:px-8 sm:py-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-ember-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-gold-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {t.eyebrow ? (
                <span className="pill bg-ember-500/20 text-ember-400">{t.eyebrow}</span>
              ) : null}
              {t.when ? (
                <span className="text-xs uppercase tracking-widest text-cream/70">{t.when}</span>
              ) : null}
            </div>
            <h2 className="mt-2 display text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t.headline}
            </h2>
            {t.body ? (
              <p className="mt-1.5 text-cream/75 text-sm sm:text-base max-w-2xl">{t.body}</p>
            ) : null}
            {t.footnote ? (
              <p className="mt-2 text-xs text-cream/70">{t.footnote}</p>
            ) : null}
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {useLinkPrimary ? (
              <>
                <Link
                  href={t.ctaHref}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ember-600 text-on-ember px-5 py-2.5 text-sm font-semibold hover:bg-ember-700 transition"
                >
                  {t.ctaLabel || 'See more'}
                </Link>
                {t.ctaContext ? (
                  <EnquiryCTA
                    whatsappNumber={content.site.whatsappNumber}
                    ctx={{ source: 'primary', customNote: t.ctaContext }}
                    variant="batch-row"
                    label={t.whatsappLabel || 'Or chat on WhatsApp'}
                  />
                ) : null}
              </>
            ) : (
              <EnquiryCTA
                whatsappNumber={content.site.whatsappNumber}
                ctx={{ source: 'primary', customNote: t.ctaContext }}
                variant="primary"
                label={t.ctaLabel || 'Chat on WhatsApp'}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

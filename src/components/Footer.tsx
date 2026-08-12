import Link from 'next/link';
import type { SiteContent } from '@/lib/content-schema';
import { buildWhatsAppHref } from '@/lib/enquiry';
import { BrandMark } from './BrandMark';
import { FacebookIcon, InstagramIcon, WhatsAppIcon, YouTubeIcon } from './SocialIcons';
import { NAV_ITEMS, navLabel } from '@/lib/nav';
import { label } from '@/lib/labels';

// `flush` drops the breathing room above the footer. On the public pages that
// margin is the pause after the closing CTA; under the admin shell — which
// already fills the viewport — it is just a gap between the editor and the
// footer with nothing in it.
export function Footer({ content, flush = false }: { content: SiteContent; flush?: boolean }) {
  const wa = (branchSlug: string, branchName: string) =>
    buildWhatsAppHref(content.site.whatsappNumber, {
      source: 'footer',
      branch: { slug: branchSlug, name: branchName },
    });

  return (
    <footer className={`${flush ? '' : 'mt-32'} border-t border-cream/10 bg-ink-950/60`}>
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <BrandMark size={64} />
            <p className="mt-5 text-sm text-cream/60 max-w-xs leading-relaxed">
              {content.site.footerCopy}
            </p>
            {/* Mirrors the burger drawer's row so the channels are reachable
                from the top and the bottom of every page. WhatsApp was missing
                here despite buildWhatsAppHref already being imported at the top
                of this file — the one channel this business converts on. */}
            <div className="mt-6 flex items-center gap-3 text-cream/70">
              {content.site.socials.instagram ? (
                <a
                  aria-label={label(content.labels, 'ariaSocialInstagram')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 transition hover:border-ember-500/60 hover:text-cream"
                  href={content.site.socials.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <InstagramIcon />
                </a>
              ) : null}
              {content.site.socials.facebook ? (
                <a
                  aria-label={label(content.labels, 'ariaSocialFacebook')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 transition hover:border-ember-500/60 hover:text-cream"
                  href={content.site.socials.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FacebookIcon />
                </a>
              ) : null}
              {content.site.socials.youtube ? (
                <a
                  aria-label={label(content.labels, 'ariaSocialYoutube')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 transition hover:border-ember-500/60 hover:text-cream"
                  href={content.site.socials.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <YouTubeIcon />
                </a>
              ) : null}
              <a
                aria-label={label(content.labels, 'ariaSocialWhatsapp')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 transition hover:border-ember-500/60 hover:text-cream"
                href={buildWhatsAppHref(content.site.whatsappNumber, { source: 'footer' })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon />
              </a>
            </div>
          </div>

          {/* Studios */}
          <div className="md:col-span-4 space-y-6">
            {content.studios.map((s) => (
              <div key={s.slug}>
                <h3 className="display text-sm uppercase tracking-widest text-cream/70">{s.name}</h3>
                <p className="mt-3 text-sm text-cream/80 leading-relaxed">{s.address}</p>
                <p className="mt-2 text-xs text-cream/70">{s.hours}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <a className="inline-block py-1 text-ember-400 hover:text-ember-300 transition-colors" href={`tel:${s.telephone.replace(/\s/g, '')}`}>
                    {label(content.labels, 'ctaCall')}
                  </a>
                  <a className="inline-block py-1 text-ember-400 hover:text-ember-300 transition-colors" href={wa(s.slug, s.name)} target="_blank" rel="noopener noreferrer">
                    {label(content.labels, 'ctaWhatsapp')}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* More */}
          <div className="md:col-span-3">
            <h3 className="display text-sm uppercase tracking-widest text-cream/70">
              {label(content.labels, 'navExplore')}
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-cream/80">
              {/* Same seven destinations, same order, one source of truth with
                  the header. `home` is deliberately excluded — the brand mark
                  above already links there. */}
              {NAV_ITEMS.filter(
                (i) => i.id !== 'home' && (i.id !== 'blog' || content.stories.length > 0),
              ).map((i) => (
                <li key={i.id}>
                  <Link href={i.href} className="inline-block py-1 hover:text-cream transition-colors">
                    {navLabel(i, content.labels)}
                  </Link>
                </li>
              ))}
              {content.customPages
                .filter((p) => p.published && p.showInFooter)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((p) => (
                  <li key={p.id}>
                    <Link href={`/p/${p.slug}`} className="inline-block py-1 hover:text-cream transition-colors">
                      {p.navLabel || p.title}
                    </Link>
                  </li>
                ))}
              {content.site.email ? (
                <li className="pt-2">
                  <a className="inline-block py-1 hover:text-cream transition-colors break-all" href={`mailto:${content.site.email}`}>
                    {content.site.email}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-cream/10 pt-6 text-xs text-cream/70">
          <p>© {new Date().getFullYear()} Furor Dance Hyderabad. All rights reserved.</p>
          <div className="flex items-center gap-5 pr-12 sm:pr-28">
            <Link href="/privacy" className="inline-block py-1.5 hover:text-cream transition-colors">{label(content.labels, 'navPrivacy')}</Link>
            <Link href="/terms" className="inline-block py-1.5 hover:text-cream transition-colors">{label(content.labels, 'navTerms')}</Link>
            {/* No "Studio login" link here. robots.txt disallows /admin, so a
                followed internal link to it made every crawl report a blocked
                URL — and it invited bots to the login screen for no gain.
                Staff reach the admin by bookmarking /admin directly. */}
          </div>
        </div>
      </div>
    </footer>
  );
}

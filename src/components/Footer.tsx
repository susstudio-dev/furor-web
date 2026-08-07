import Link from 'next/link';
import type { SiteContent } from '@/lib/content-schema';
import { buildWhatsAppHref } from '@/lib/enquiry';
import { BrandMark } from './BrandMark';

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
            <div className="mt-6 flex items-center gap-4 text-sm text-cream/70">
              {content.site.socials.instagram ? (
                <a aria-label="Instagram" className="inline-block py-1 hover:text-cream transition-colors" href={content.site.socials.instagram} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              ) : null}
              {content.site.socials.facebook ? (
                <a aria-label="Facebook" className="inline-block py-1 hover:text-cream transition-colors" href={content.site.socials.facebook} target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              ) : null}
              {content.site.socials.youtube ? (
                <a aria-label="YouTube" className="inline-block py-1 hover:text-cream transition-colors" href={content.site.socials.youtube} target="_blank" rel="noopener noreferrer">
                  YouTube
                </a>
              ) : null}
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
                    Call
                  </a>
                  <a className="inline-block py-1 text-ember-400 hover:text-ember-300 transition-colors" href={wa(s.slug, s.name)} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* More */}
          <div className="md:col-span-3">
            <h3 className="display text-sm uppercase tracking-widest text-cream/70">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm text-cream/80">
              <li><Link href="/about" className="inline-block py-1 hover:text-cream transition-colors">About</Link></li>
              <li><Link href="/dance-styles" className="inline-block py-1 hover:text-cream transition-colors">Dance Styles</Link></li>
              <li><Link href="/instructors" className="inline-block py-1 hover:text-cream transition-colors">Instructors</Link></li>
              <li><Link href="/batches" className="inline-block py-1 hover:text-cream transition-colors">Batches &amp; Pricing</Link></li>
              {content.stories.length > 0 ? (
                <li><Link href="/stories" className="inline-block py-1 hover:text-cream transition-colors">Blog</Link></li>
              ) : null}
              <li><Link href="/faqs" className="inline-block py-1 hover:text-cream transition-colors">FAQs</Link></li>
              <li><Link href="/contact" className="inline-block py-1 hover:text-cream transition-colors">Contact</Link></li>
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
            <Link href="/privacy" className="inline-block py-1.5 hover:text-cream transition-colors">Privacy</Link>
            <Link href="/terms" className="inline-block py-1.5 hover:text-cream transition-colors">Terms</Link>
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

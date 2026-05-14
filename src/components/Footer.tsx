import Link from 'next/link';
import type { SiteContent } from '@/lib/content-schema';
import { buildWhatsAppHref } from '@/lib/enquiry';
import { BrandMark } from './BrandMark';

export function Footer({ content }: { content: SiteContent }) {
  const wa = (branchSlug: string, branchName: string) =>
    buildWhatsAppHref(content.site.whatsappNumber, {
      source: 'footer',
      branch: { slug: branchSlug, name: branchName },
    });

  return (
    <footer className="mt-32 border-t border-cream/10 bg-ink-950/60">
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
                <a aria-label="Instagram" className="hover:text-cream transition-colors" href={content.site.socials.instagram} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              ) : null}
              {content.site.socials.facebook ? (
                <a aria-label="Facebook" className="hover:text-cream transition-colors" href={content.site.socials.facebook} target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              ) : null}
              {content.site.socials.youtube ? (
                <a aria-label="YouTube" className="hover:text-cream transition-colors" href={content.site.socials.youtube} target="_blank" rel="noopener noreferrer">
                  YouTube
                </a>
              ) : null}
            </div>
          </div>

          {/* Studios */}
          <div className="md:col-span-4 space-y-6">
            {content.studios.map((s) => (
              <div key={s.slug}>
                <h3 className="display text-sm uppercase tracking-widest text-cream/50">{s.name}</h3>
                <p className="mt-3 text-sm text-cream/80 leading-relaxed">{s.address}</p>
                <p className="mt-2 text-xs text-cream/50">{s.hours}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <a className="text-ember-400 hover:text-ember-300 transition-colors" href={`tel:${s.telephone.replace(/\s/g, '')}`}>
                    Call
                  </a>
                  <a className="text-ember-400 hover:text-ember-300 transition-colors" href={wa(s.slug, s.name)} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* More */}
          <div className="md:col-span-3">
            <h3 className="display text-sm uppercase tracking-widest text-cream/50">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm text-cream/80">
              <li><Link href="/about" className="hover:text-cream transition-colors">About</Link></li>
              <li><Link href="/dance-styles" className="hover:text-cream transition-colors">Dance Styles</Link></li>
              <li><Link href="/instructors" className="hover:text-cream transition-colors">Instructors</Link></li>
              <li><Link href="/batches" className="hover:text-cream transition-colors">Batches &amp; Pricing</Link></li>
              <li><Link href="/stories" className="hover:text-cream transition-colors">Blog</Link></li>
              <li><Link href="/faqs" className="hover:text-cream transition-colors">FAQs</Link></li>
              <li><Link href="/contact" className="hover:text-cream transition-colors">Contact</Link></li>
              {content.site.email ? (
                <li className="pt-2">
                  <a className="hover:text-cream transition-colors break-all" href={`mailto:${content.site.email}`}>
                    {content.site.email}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-cream/10 pt-6 text-xs text-cream/40">
          <p>© {new Date().getFullYear()} Furor Dance Studio. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-cream/70 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-cream/70 transition-colors">Terms</Link>
            <Link href="/admin" className="hover:text-cream/70 transition-colors">Studio login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

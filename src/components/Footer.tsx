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
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <BrandMark size={42} />
            <p className="mt-4 text-sm text-cream/60 max-w-xs">{content.site.footerCopy}</p>
            <div className="mt-5 flex items-center gap-3 text-cream/70">
              {content.site.socials.instagram ? (
                <a aria-label="Instagram" className="hover:text-cream" href={content.site.socials.instagram} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              ) : null}
              {content.site.socials.facebook ? (
                <a aria-label="Facebook" className="hover:text-cream" href={content.site.socials.facebook} target="_blank" rel="noopener noreferrer">
                  Facebook
                </a>
              ) : null}
              {content.site.socials.youtube ? (
                <a aria-label="YouTube" className="hover:text-cream" href={content.site.socials.youtube} target="_blank" rel="noopener noreferrer">
                  YouTube
                </a>
              ) : null}
            </div>
          </div>
          {content.studios.map((s) => (
            <div key={s.slug}>
              <h3 className="display text-sm uppercase tracking-widest text-cream/50">{s.name}</h3>
              <p className="mt-3 text-sm text-cream/80 leading-relaxed">{s.address}</p>
              <p className="mt-2 text-xs text-cream/50">{s.hours}</p>
              <div className="mt-3 flex gap-3 text-sm">
                <a className="text-ember-400 hover:text-ember-300" href={`tel:${s.telephone.replace(/\s/g, '')}`}>Call</a>
                <a className="text-ember-400 hover:text-ember-300" href={wa(s.slug, s.name)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              </div>
            </div>
          ))}
          <div>
            <h3 className="display text-sm uppercase tracking-widest text-cream/50">More</h3>
            <ul className="mt-3 space-y-2 text-sm text-cream/80">
              <li><Link href="/stories" className="hover:text-cream">Stories</Link></li>
              <li><Link href="/about" className="hover:text-cream">About</Link></li>
              {content.site.email ? <li><a className="hover:text-cream" href={`mailto:${content.site.email}`}>{content.site.email}</a></li> : null}
              <li><Link href="/admin" className="text-cream/40 hover:text-cream/70">Studio login</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-12 text-xs text-cream/40">© {new Date().getFullYear()} Furor Dance Studio. All rights reserved.</p>
      </div>
    </footer>
  );
}

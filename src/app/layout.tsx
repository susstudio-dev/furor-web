import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { Bricolage_Grotesque, Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FloatingTalkToUs } from '@/components/FloatingTalkToUs';
import { NoticeBanner } from '@/components/NoticeBanner';
import { PreviewChip } from '@/components/PreviewChip';
import { Analytics } from '@/components/Analytics';
import { JsonLd } from '@/components/JsonLd';
import { headers } from 'next/headers';
import { getContent, getPreviewInfo, getPublicContent } from '@/lib/content';
import { danceSchoolsLd, organizationLd, webSiteLd } from '@/lib/seo';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['italic'],
  weight: ['500', '600'],
  display: 'swap',
});
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicContent();
  return {
    metadataBase: new URL('https://www.dancehyderabad.com'),
    title: { default: content.site.title, template: `%s · ${content.site.title}` },
    description: content.site.tagline,
    // NB: no alternates.canonical here — layout metadata is inherited, and a
    // site-wide '/' canonical would point every page at the home page. Each
    // page declares its own.
    formatDetection: { telephone: false },
    openGraph: {
      title: content.site.title,
      description: content.site.tagline,
      type: 'website',
      siteName: content.site.title,
      // NB: no `url` here — layout openGraph is inherited wholesale by pages
      // without their own, and a fixed og:url would mark every inner page as
      // a share of the homepage.
      locale: 'en_IN',
      images: ['/og.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: content.site.title,
      description: content.site.tagline,
      images: ['/og.png'],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0709' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // On Cloudflare Workers every page renders per-request so admin edits are
  // always fresh (there is no ISR tag-cache machinery on the free plan).
  await connection();
  // The root layout wraps /admin too (no route group). The admin shell must
  // render PUBLISHED content — its editors diff against the published doc —
  // and must never wear the preview chip over its own nav.
  const isAdmin = (await headers()).get('x-admin-path') != null;
  const content = isAdmin ? await getContent() : await getPublicContent();
  const previewDraftId = isAdmin ? null : (await getPreviewInfo()).draftId;
  return (
    // data-scroll-behavior tells Next to neutralise smooth scrolling on route
    // changes while leaving hash navigation smooth. Without it, once Next 16
    // enables its router-scroll optimisation, every route change on this very
    // long page becomes a slow animated scroll to the top.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${serif.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=localStorage.getItem('theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();",
          }}
        />
        {/* No reveal-rescue <noscript> or timer here any more: scroll reveals
            are pure CSS scroll-driven animations now, declared entirely inside
            @supports (animation-timeline: view()). Browsers without support
            render the content visible and static, and nothing about the
            entrance depends on JavaScript running at all. */}
        {/* Brand entity graph: Organization + WebSite + one DanceSchool
            (LocalBusiness) node per studio, on every page. */}
        <JsonLd data={organizationLd(content)} />
        <JsonLd data={webSiteLd(content)} />
        {danceSchoolsLd(content).map((studio) => (
          <JsonLd key={String(studio['@id'])} data={studio} />
        ))}
        <Analytics />
        {/* The room: a warm stage-light wash that breathes with the tempo,
            behind everything, never interactive. */}
        <div className="stage-lights" aria-hidden />
        {previewDraftId ? <PreviewChip draftId={previewDraftId} /> : null}
        <NoticeBanner notice={content.site.notice || ''} />
        <Header content={content} />
        <main>{children}</main>
        <Footer content={content} flush={isAdmin} />
        <FloatingTalkToUs
          whatsappNumber={content.site.whatsappNumber}
          instagramHandle={content.site.instagramHandle}
          labels={content.labels}
          templates={content.site.whatsappTemplates}
        />
      </body>
    </html>
  );
}

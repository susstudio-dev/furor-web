import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FloatingTalkToUs } from '@/components/FloatingTalkToUs';
import { getContent } from '@/lib/content';

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
  const content = await getContent();
  return {
    metadataBase: new URL('https://www.dancehyderabad.com'),
    title: { default: content.site.title, template: `%s · ${content.site.title}` },
    description: content.site.tagline,
    openGraph: {
      title: content.site.title,
      description: content.site.tagline,
      type: 'website',
      siteName: content.site.title,
    },
    twitter: { card: 'summary_large_image', title: content.site.title, description: content.site.tagline },
  };
}

export const viewport: Viewport = {
  themeColor: '#fbf7f1',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getContent();
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Header content={content} />
        <main>{children}</main>
        <Footer content={content} />
        <FloatingTalkToUs
          whatsappNumber={content.site.whatsappNumber}
          instagramHandle={content.site.instagramHandle}
        />
      </body>
    </html>
  );
}

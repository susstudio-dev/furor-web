import Script from 'next/script';

// Loads GA4 when NEXT_PUBLIC_GA4_ID is configured. Without this the
// gtag('event', ...) calls sprinkled through the enquiry CTAs fire into a
// void.
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA4_ID;
  if (!id) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id.replace(/[^A-Za-z0-9_-]/g, '')}');`}
      </Script>
    </>
  );
}

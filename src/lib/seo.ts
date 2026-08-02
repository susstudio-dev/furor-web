import type { SiteContent } from './content-schema';
import { batchesForStyle } from './content-helpers';

// JSON-LD builders. Rendered via <JsonLd data={...} /> — see the layout for
// the site-wide Organization / WebSite / DanceSchool nodes; pages add their
// own Course / Article / BreadcrumbList nodes on top.

export const SITE_URL = 'https://www.dancehyderabad.com';
const ORG_ID = `${SITE_URL}/#organization`;

function sameAs(content: SiteContent): string[] {
  const s = content.site.socials || {};
  return [s.instagram, s.facebook, s.youtube].filter((v): v is string => !!v);
}

export function organizationLd(content: SiteContent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: content.site.title,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    email: content.site.email || undefined,
    sameAs: sameAs(content),
  };
}

export function webSiteLd(content: SiteContent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: content.site.title,
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
  };
}

// One DanceSchool (LocalBusiness subtype) node per studio, with real
// address/geo/telephone from the content store. priceRange derives from the
// visible batch fees.
export function danceSchoolsLd(content: SiteContent) {
  const prices = content.batches.map((b) => b.priceInr).filter((p) => p > 0);
  const priceRange =
    prices.length > 0
      ? `₹${Math.min(...prices).toLocaleString('en-IN')}–₹${Math.max(...prices).toLocaleString('en-IN')}`
      : undefined;
  return content.studios.map((s) => ({
    '@context': 'https://schema.org',
    '@type': 'DanceSchool',
    '@id': `${SITE_URL}/#studio-${s.slug}`,
    name: `${content.site.title} — ${s.name}`,
    parentOrganization: { '@id': ORG_ID },
    url: SITE_URL,
    image: s.photos?.length ? s.photos.map((p) => absoluteUrl(p)) : undefined,
    telephone: s.telephone,
    priceRange,
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.address,
      addressLocality: 'Hyderabad',
      addressRegion: 'Telangana',
      addressCountry: 'IN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: s.geo.lat,
      longitude: s.geo.lng,
    },
    openingHoursSpecification: openingHoursLd(s.hours),
    hasMap: `https://www.google.com/maps/search/?api=1&query=${s.geo.lat},${s.geo.lng}`,
    sameAs: sameAs(content),
  }));
}

const DAY_ABBRS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function to24h(h: number, m: number, ampm: string): string | undefined {
  if (h < 1 || h > 12 || m < 0 || m > 59) return undefined;
  let hh = h % 12;
  if (ampm.toUpperCase() === 'PM') hh += 12;
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// The content store keeps hours as display text ("Mon–Fri 9 AM–6 PM ·
// Sat–Sun 9:30 AM–4:30 PM"). Parse that into OpeningHoursSpecification;
// hours are admin-edited free text, so all-or-nothing: any segment that
// doesn't parse suppresses the whole property — wrong hours are worse for
// local SEO than none.
export function openingHoursLd(hours: string) {
  const segments = hours.split('·').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return undefined;
  const specs = [];
  for (const seg of segments) {
    const m = seg.match(
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:\s*[–-]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i,
    );
    if (!m) return undefined;
    const [, d1, d2, openH, openM, openAp, closeH, closeM, closeAp] = m;
    const start = DAY_ABBRS.findIndex((d) => d.toLowerCase() === d1.toLowerCase());
    const end = d2 ? DAY_ABBRS.findIndex((d) => d.toLowerCase() === d2.toLowerCase()) : start;
    if (end < start) return undefined;
    const opens = to24h(Number(openH), Number(openM ?? 0), openAp);
    const closes = to24h(Number(closeH), Number(closeM ?? 0), closeAp);
    if (!opens || !closes) return undefined;
    specs.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_ABBRS.slice(start, end + 1).map(expandDay),
      opens,
      closes,
    });
  }
  return specs;
}

export function courseLd(
  content: SiteContent,
  style: SiteContent['danceStyles'][number],
) {
  // Same visibility rules as the page (startDate >= today, not Closed) —
  // markup must never advertise batches the visitor cannot see.
  const batches = batchesForStyle(content, style.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `${style.name} classes in Hyderabad`,
    description: style.description,
    url: `${SITE_URL}/dance-styles/${style.slug}`,
    provider: { '@id': ORG_ID },
    offers:
      batches.length > 0
        ? batches.map((b) => ({
            '@type': 'Offer',
            category: 'Paid',
            price: b.priceInr,
            priceCurrency: 'INR',
            availability:
              b.status === 'Filling Fast'
                ? 'https://schema.org/LimitedAvailability'
                : 'https://schema.org/InStock',
          }))
        : undefined,
    hasCourseInstance:
      batches.length > 0
        ? batches.map((b) => {
            const studio = content.studios.find((s) => s.slug === b.branchSlug);
            return {
              '@type': 'CourseInstance',
              courseMode: 'Onsite',
              startDate: b.startDate,
              courseSchedule: {
                '@type': 'Schedule',
                repeatFrequency: 'Weekly',
                byDay: b.daysOfWeek.map((d) => `https://schema.org/${expandDay(d)}`),
              },
              location: studio
                ? {
                    '@type': 'Place',
                    name: studio.name,
                    address: studio.address,
                  }
                : undefined,
            };
          })
        : undefined,
  };
}

export function articleLd(story: SiteContent['stories'][number], content: SiteContent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: story.title,
    description: story.excerpt || undefined,
    datePublished: story.publishedAt,
    image: story.heroImage ? [absoluteUrl(story.heroImage)] : undefined,
    url: `${SITE_URL}/stories/${story.slug}`,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: `${SITE_URL}/stories/${story.slug}`,
    inLanguage: 'en',
    // keep the brand entity connected
    about: { '@type': 'Organization', name: content.site.title },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

// Meta descriptions: Google displays ~160 chars. Cut on a word boundary —
// a mid-word cut ("Puerto R…") reads broken in the SERP snippet.
export function truncateAtWord(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function expandDay(d: string): string {
  const map: Record<string, string> = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday',
  };
  return map[d] || d;
}

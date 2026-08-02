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
    sameAs: sameAs(content),
  }));
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

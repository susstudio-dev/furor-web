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

// ---------------------------------------------------------------------------
// SERP fitting.
//
// Google truncates titles around 60 characters / 561 pixels and descriptions
// around 155 characters / 985 pixels. Both limits were being blown by content
// the admin edits, not by anything hardcoded — so these helpers enforce the fit
// at render time instead of relying on whoever writes the next story title to
// remember. Budgets sit under the thresholds because the real limit is pixels,
// and a wide string hits it before the character count does.
// ---------------------------------------------------------------------------

/**
 * The character ceiling fitTitle enforces. Exported so the /admin counter and
 * the render-time trim can never drift apart — an editor who is told "57" must
 * be told the number this file actually applies.
 */
export const SEO_TITLE_CHARS = 57;
/**
 * Advisory ceiling for the admin description counter. The render-time limit is
 * DESC_PX below, because Google's real limit is pixels, not characters — but
 * pixels are not a number anyone can count while typing, and 155 is the figure
 * every SERP tool shows an editor.
 */
export const SEO_DESC_CHARS = 155;

const TITLE_CHARS = SEO_TITLE_CHARS;
const TITLE_PX = 520;
const DESC_PX = 920;
const DESC_MIN = 75;

/**
 * Approximate rendered width in a SERP, in pixels.
 *
 * Both limits Google actually applies are pixel limits, and a character count
 * is a poor proxy for them — "mmm" is over three times the width of "iii". A
 * 142-character description of ordinary prose measures ~1000px and gets cut;
 * the same character count in narrow text fits fine. These advances approximate
 * Arial 13px, the same way the audit tools do.
 */
function serpPixels(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (" iljt.,;:!|'`[](){}I".includes(ch)) w += 4;
    else if ('mwMW@%'.includes(ch)) w += 13;
    else if (ch >= 'A' && ch <= 'Z') w += 10;
    else w += 8;
  }
  return w;
}

/** Trim to a pixel budget on a word boundary, with a trailing ellipsis. */
function truncateToPixels(text: string, maxPx: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (serpPixels(clean) <= maxPx) return clean;
  const budget = maxPx - serpPixels('…');
  let out = '';
  for (const word of clean.split(' ')) {
    const next = out ? `${out} ${word}` : word;
    if (serpPixels(next) > budget) break;
    out = next;
  }
  return `${(out || clean.slice(0, 40)).trimEnd()}…`;
}

/**
 * Fit `title` plus as much brand suffix as the budget allows.
 *
 * The layout template appends " · Furor — Dance Hyderabad" — 26 characters —
 * which by itself pushed eight pages over the limit. Rather than drop the
 * brand everywhere, spend what's left: full brand, then short brand, then none.
 * Returns the shape `metadata.title` wants for an absolute (un-templated) title.
 */
export function fitTitle(title: string, brand: string): { absolute: string } {
  const clean = title.replace(/\s+/g, ' ').trim();
  // "Furor — Dance Hyderabad" -> "Furor". Derived, so it keeps working if the
  // admin renames the site.
  const short = brand.split(/[—–|·-]/)[0].trim() || brand;
  for (const suffix of [` · ${brand}`, ` · ${short}`]) {
    const candidate = clean + suffix;
    if (candidate.length <= TITLE_CHARS && serpPixels(candidate) <= TITLE_PX) {
      return { absolute: candidate };
    }
  }
  // Bare title still over budget: trim rather than ship a title the SERP cuts
  // at an arbitrary character. Nothing in the content hits this today.
  //
  // truncateAtWord (not a raw slice) here: a raw 60-char slice can land
  // mid-word, and if that slice happens to already fit TITLE_PX, the
  // truncateToPixels call below short-circuits and returns it verbatim —
  // shipping exactly the arbitrary-character cut this comment says we avoid.
  return {
    absolute: truncateToPixels(
      clean.length <= 60 ? clean : truncateAtWord(clean, 60),
      TITLE_PX,
    ),
  };
}

/**
 * Fit a meta description into the band that actually renders in a SERP.
 *
 * Under ~70 characters wastes the snippet; over ~155 gets cut mid-sentence.
 * `primary` is the admin-written copy and always wins when it is substantial
 * enough to stand alone. When it is too thin, `support` is appended rather than
 * substituted — the editor's words stay, they just stop being the whole thing.
 */
export function fitDescription(primary: string | null | undefined, support: string): string {
  const p = (primary ?? '').replace(/\s+/g, ' ').trim();
  const s = support.replace(/\s+/g, ' ').trim();
  if (!p) return truncateToPixels(s, DESC_PX);
  if (p.length >= DESC_MIN) return truncateToPixels(p, DESC_PX);
  // Admin leads do not reliably end in punctuation ("…managed by VASISHTHA
  // ENTERPRISES "), and running the two straight together produced a snippet
  // that read as one broken sentence.
  const joined = /[.!?…:—]$/.test(p) ? `${p} ${s}` : `${p}. ${s}`;
  return truncateToPixels(joined, DESC_PX);
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

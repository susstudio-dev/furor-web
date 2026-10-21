# SEO: sitelinks eligibility + local ranking — design

**Date:** 2026-08-02
**Branch:** cloudflare-migration
**Goals:** (1) restore Google indexability and maximize eligibility for sitelinks under the
brand result; (2) improve ranking for local queries like "best dance class in Hyderabad" /
"dance classes in Hyderabad".

## Context (from audit, verified 2026-08-02)

- **The live domain is DOWN.** Both apex and www return HTTP 402 `DEPLOYMENT_DISABLED`
  from Vercel. Nothing else matters until the domain serves 200s again. The user handles
  the domain/cutover themselves; this repo provides the worker and a written runbook.
- The site already emits a solid JSON-LD graph (Organization, WebSite, DanceSchool per
  studio, Course, FAQPage, Person, BlogPosting, BreadcrumbList) via `src/lib/seo.ts` +
  `src/components/JsonLd.tsx`, has a dynamic sitemap, correct robots, canonicals, and
  `metadataBase = https://www.dancehyderabad.com`.
- Decisions made with the user:
  - Domain cutover: **user handles it** — we document exact steps.
  - Homepage title: **brand + keywords** ("Furor — Dance Hyderabad | Salsa, Bachata &
    West Coast Swing Classes").
  - Google Business Profile: **exists** — checklist covers linking/consistency/reviews.
  - PUP Unleash studio: **keep**, fix pin to 17.426, 78.4005 (sourced from the venue's
    public event listing; user to confirm) and clean the address string.

## Changes

### 1. Titles & descriptions

- `src/app/page.tsx` `generateMetadata`: homepage title becomes
  `{ absolute: `${site.title} | ${styleNames} Classes` }` where `styleNames` is built
  from `content.danceStyles` sorted by `displayOrder` (e.g. "Salsa, Bachata & West Coast
  Swing"). Falls back to a hardcoded suffix if no styles exist. `title.absolute` is
  required so the layout's `%s ·` template does not double the brand.
- New helper `truncateAtWord(text, max)` in `src/lib/seo.ts` (or nearby): cuts at the
  last word boundary ≤ max chars, appends `…` only when truncated, collapses repeated
  whitespace.
- Homepage description: pass the CMS `hero.subHeadline` through `truncateAtWord(…, 160)`.
- `src/app/dance-styles/[slug]/page.tsx`: replace `.slice(0, 160)` with the same helper.

### 2. DanceSchool schema upgrades (`src/lib/seo.ts`)

- `openingHoursSpecification`: parse the free-text `studio.hours` format
  `"Mon–Fri 9 AM–6 PM · Sat–Sun 9:30 AM–4:30 PM"` — segments split on `·`, each segment
  `DayRange TimeRange`; day ranges expand via the existing day list; times converted to
  24h `HH:MM`. Tolerant: if any segment fails to parse, emit no
  `openingHoursSpecification` for that studio (never emit wrong hours). Pure function,
  unit-testable.
- `hasMap`: `https://www.google.com/maps/search/?api=1&query={lat},{lng}` from
  `studio.geo` when present.
- No Review/AggregateRating markup (self-serving reviews earn nothing and risk manual
  action).

### 3. Noindex for thin custom pages

- `src/lib/content-schema.ts`: add optional `noindex: boolean` (default false) to the
  customPages schema.
- `src/app/p/[slug]/page.tsx` `generateMetadata`: when `page.noindex`, emit
  `robots: { index: false, follow: false }`.
- `src/app/sitemap.ts`: exclude `noindex` pages from the customPages entries.
- Data: set `noindex: true` on `latinl1july2026` ("You are in - Latin L1 July 2026") in
  `data/site-content.json` and `src/data/site-content.seed.json`.
- Admins can toggle via the existing `/admin/json` editor; no new admin UI.

### 4. Real headings (visual styling unchanged)

- `src/app/faqs/page.tsx`: section labels (`Getting started`, …) become `<h2>` with the
  current classes.
- `src/app/page.tsx` Visit section: studio names become `<h3>` with the current classes.
- The hero `<h1>` (brand voice) is intentionally left as-is.

### 5. Duplicate-host protection

- `wrangler.jsonc`: add `"workers_dev": false` and `"preview_urls": false` so the
  `*.workers.dev` and preview copies are not publicly crawlable duplicates once the user
  deploys. Domain attachment itself stays with the user (runbook).

### 6. Data fixes (repo snapshot + seed)

- Studio `studio-g2e0ls` (PUP Unleash - HUDA Colony): `geo` → `{ lat: 17.426, lng:
  78.4005 }`; `address` → single line `"PUP – Paws Unleash Play, HUDA Enclave, Jubilee
  Hills, Hyderabad, Telangana 500110"` (removes embedded newline).
- Homepage `hero.subHeadline`: collapse the double space.
- **Caveat (must appear in the runbook):** production content lives in R2 and saved
  values win over the seed. These data fixes must be re-applied to the live store
  (admin panel or `scripts/` R2 migration) after cutover, or they never reach production.

### 7. User runbook — `docs/SEO-RUNBOOK.md`

Step-by-step, in priority order:
1. **Cutover** (user-owned): `wrangler deploy`, attach `www.dancehyderabad.com` as the
   worker's custom domain, DNS, Cloudflare redirect rule apex → www (301), verify with
   `curl -I` that both hosts resolve and pages return 200.
2. **Re-apply content fixes** to the live R2 store (see §6 caveat).
3. **Google Search Console**: verify domain property, submit
   `https://www.dancehyderabad.com/sitemap.xml`, use URL Inspection → Request Indexing
   on `/`, `/dance-styles`, `/batches`.
4. **Google Business Profile** (exists): website field → `https://www.dancehyderabad.com`;
   name/address/phone must match the site exactly (NAP consistency); category "Dance
   school"; hours match the site; add photos; steady review asks after class + owner
   replies.
5. **Expectations**: sitelinks are automatic for brand queries, typically within weeks of
   recrawl; "best dance class" queries are won primarily in the map pack via GBP reviews.

## Error handling

- Hours parser: parse failure → omit the property (never wrong data). No runtime throw.
- `truncateAtWord`: handles empty/short strings by returning input unchanged.
- Schema change is additive/optional → old stored content in R2 validates unchanged.

## Testing

- Unit tests for the hours parser and `truncateAtWord` if a test runner exists in the
  repo; otherwise verify via a small script + `npm run build` (GH_PAGES and default
  branches) and manual inspection of emitted JSON-LD in built HTML.
- Validate emitted LocalBusiness JSON-LD against Google's Rich Results test after
  deploy (runbook step).

## Out of scope

- Changing the hero h1 text, review/rating markup, Core Web Vitals/image optimization
  work, new admin UI for noindex, host-canonicalization middleware (superseded by
  `workers_dev: false` + user-owned domain setup).

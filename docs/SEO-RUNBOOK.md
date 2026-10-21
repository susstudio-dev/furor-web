# SEO Runbook — dancehyderabad.com

Steps only the site owner can do, in priority order. The code side (structured
data, titles, sitemap, noindex rules) is already done on the
`cloudflare-migration` branch — see the commits tagged `feat(seo)`/`fix(seo)`.

**Goals:** get the site back into Google, earn sitelinks (the section links
under the brand result), and rank for "dance classes in Hyderabad" searches.

---

## 1. Why the site is invisible right now (fix first)

As of **2 Aug 2026**, both `dancehyderabad.com` and `www.dancehyderabad.com`
return **HTTP 402 "Payment required / DEPLOYMENT_DISABLED"** from Vercel — the
old deployment is disabled and DNS still points at it. Google still shows the
cached result, but every crawl hits an error. Sites that keep erroring get
**removed from Google entirely**, and sitelinks/rankings are impossible until
this is fixed. Every other step depends on this one.

## 2. Cutover to Cloudflare

1. Deploy the worker: `npm run deploy` (requires `wrangler login`).
2. Attach the domain: Cloudflare dashboard → **Workers & Pages → furor-web →
   Settings → Domains & Routes → Add → Custom domain** →
   `www.dancehyderabad.com`. (DNS for the zone must be on Cloudflare.)
3. Redirect the bare domain: zone → **Rules → Redirect Rules** → new rule:
   when hostname equals `dancehyderabad.com` → 301 to
   `https://www.dancehyderabad.com` preserving path and query
   (dynamic expression: `concat("https://www.dancehyderabad.com", http.request.uri.path)`).
4. Verify from any terminal:
   - `curl -I https://www.dancehyderabad.com/` → `HTTP/2 200`
   - `curl -I https://dancehyderabad.com/` → `301` with a `location:` to www
   - `curl -I https://furor-web.<your-account>.workers.dev/` → should NOT
     serve the site (workers.dev is disabled in `wrangler.jsonc` so Google
     never sees a duplicate copy).

## 3. Re-apply content fixes to the live store

Production content lives in the R2 bucket and **beats the repo's seed file** —
so these fixes, already in git, must also be applied to the live store once
the admin panel is reachable:

| Fix | Where in admin |
| --- | --- |
| PUP studio map pin → `17.426, 78.4005` (was pointing at the city centre, ~9 km off) | `/admin/studios` — edit "PUP Unleash - HUDA Colony" |
| PUP address → one line: `PUP – Paws Unleash Play, HUDA Enclave, Jubilee Hills, Hyderabad, Telangana 500110` | same place |
| Homepage sub-headline: remove the double space after "Beginner-friendly." | `/admin/hero` |
| Mark the "You are in - Latin L1 July 2026" page as `noindex: true` | `/admin/json` (add `"noindex": true` to that customPages entry) |

If you are instead seeding a fresh bucket, `npm run migrate-to-r2` uploads the
repo's already-fixed content and none of the manual edits are needed.

**Double-check the PUP pin:** the coordinates came from the venue's public
event listing. Open Google Maps, search "PUP Paws Unleash Play Hyderabad",
right-click their marker → copy coordinates, and use those if they differ.

## 4. Google Search Console (free, ~15 minutes)

1. Go to search.google.com/search-console → **Add property** → type
   **Domain** → `dancehyderabad.com`. Verify via the DNS TXT record it gives
   you (added in the Cloudflare DNS panel).
2. **Sitemaps** → submit `https://www.dancehyderabad.com/sitemap.xml`.
3. **URL Inspection** → enter `https://www.dancehyderabad.com/` → **Request
   indexing**. Repeat for `/dance-styles` and `/batches`.
4. Over the next weeks, watch **Pages** (indexing report): the 402-era
   "Server error" entries should drain to zero. If any page shows "Crawled —
   currently not indexed", give it time; that resolves as the site regains
   trust.

## 5. Google Business Profile — the "best dance class in Hyderabad" lever

Searches like "best dance class in Hyderabad" are answered mostly by the
**map pack** (the top 3 businesses with stars), and that is ranked by your
Business Profile, not your website. You already have one — tune it:

- **Website field** → `https://www.dancehyderabad.com` (exactly, with www).
- **Name / address / phone** must match the site **character for character**:
  "Furor — Dance Hyderabad", the Alcazar Mall Jubilee Hills address as shown
  in the site footer, `+91 88860 72572`. Inconsistency here directly hurts
  local ranking.
- **Primary category:** Dance school. Add secondary categories if offered
  (e.g. Dance company).
- **Hours** identical to the site (Mon–Fri 9 AM–6 PM, Sat–Sun 9:30 AM–4:30 PM).
- **Photos:** upload real class/social photos monthly — profiles with fresh
  photos get materially more clicks.
- **Reviews are the single biggest factor.** Build a habit: after a student's
  first class or a batch graduation, send them the review link (Business
  Profile → "Ask for reviews" gives you a short URL; print it as a QR at the
  front desk). Reply to every review, including critical ones.
- **Posts:** announce each new batch as a profile post with the /batches link.

## 6. What sitelinks are and when to expect them

The indented section links under the main Google result are **sitelinks**.
Google generates them automatically for brand searches when it understands
the site's structure — nobody can buy or request them. The site's navigation,
headings, breadcrumb markup and sitemap now all support them. After cutover +
recrawl, expect them to reappear for searches like "furor dance hyderabad"
within a few weeks. If a wrong page ever appears as a sitelink, the fix is to
noindex or improve that page — there is no manual control.

## 7. Validate the structured data (after deploy)

Run the key pages through:

- **Google Rich Results Test** (search.google.com/test/rich-results):
  - `/` → expect Organization, WebSite, and two DanceSchool nodes **with
    opening hours and map link**
  - `/dance-styles/salsa` → Course, FAQPage, BreadcrumbList
  - `/faqs` → FAQPage
  - `/batches` → Course
- **validator.schema.org** for anything the Google tool flags.

Fix-by-editing-content: if a DanceSchool node ever loses its
`openingHoursSpecification`, the hours text in the admin no longer matches the
`Mon–Fri 9 AM–6 PM · Sat–Sun 9:30 AM–4:30 PM` pattern — restore that format.

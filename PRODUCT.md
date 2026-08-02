# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** Hyderabad adults who have never danced — often nervous about walking into a first class. The site's job is to make sending that first WhatsApp message feel easy and low-stakes.
- **Secondary (confirmed):** experienced and returning dancers checking the weekly social (La Rumba) and higher-level batches.
- **Internal:** studio staff editing all site content through `/admin` (non-developers; single JSON document, versioned, audit-logged).

## Product Purpose

The new dancehyderabad.com: the public face and enquiry funnel of Furor, a Latin dance school. Success = a visitor sends a WhatsApp message (or Instagram DM); the team converts that conversation into a trial or Foundation-batch join. There are no signup forms and no payments on the site — conversion is always a human conversation.

## Positioning

All confirmed as true, binding claims (user-verified 2026-08-02):

- **India's largest Latin dance school** and "India's most loved" — keep using.
- **Founded 2009; 16 years; 5 cities** — Hyderabad, Bangalore, Pune, Ahmedabad, Gurgaon. Hyderabad is home.
- **Built around the social:** class is one half; the weekly **La Rumba** social is where the dance becomes yours. This is the mechanism competitors can't truthfully copy.
- **True beginners welcome:** most students walked in having never danced; the Foundation track exists for exactly that.

## Operating Context

- Visitors arrive mostly on mobile, via Instagram (@furorhyd) and WhatsApp forwards.
- Enquiry routing: WhatsApp primary (`wa.me/918886072572` with context-aware prefilled message per style/branch/batch), Instagram DM secondary (deep link + message copied to clipboard). Every CTA fires GA4 `enquiry_click`.
- One studio today: **Jubilee Hills only** — 2nd Floor, Alcazar Mall, Road No. 36, Jubilee Hills, Hyderabad 500033. (Older docs mention Kondapur; it is not current.)
- Staff edit content on the deployed `/admin`; edits appear on the public site within ~30 s (per-request rendering, no redeploy).

## Capabilities and Constraints

- Styles taught: Salsa, Bachata, West Coast Swing (content model is extensible).
- Public pages: home, dance-styles (+ per-style with FAQ schema), batches (filters, transparent ₹ pricing, per-batch WhatsApp CTA), about, instructors, contact, faqs, stories (blog). Floating "Talk to us" pill on every public page.
- All public copy renders from the single Zod-validated content document (`src/lib/content-schema.ts`) — never hardcode copy that staff should be able to edit.
- Batches auto-hide when `startDate` is past.
- Hosting: Cloudflare Workers **free plan** via OpenNext; content/versions/uploads in R2. Free-plan 10 ms CPU cap is a durable constraint (e.g. PBKDF2 not bcrypt for auth).
- Performance budget (binding): LCP < 2.5 s, CLS < 0.1, INP < 200 ms on Lighthouse mobile; first-load JS < 100 KB gzip per route; hero image < 120 KB AVIF; hero video < 2 MB.

## Brand Commitments

- Name: **Furor** / "Furor — Dance Hyderabad"; domain dancehyderabad.com; motto "Dance for life."
- Voice: warm, personal, lightly poetic ("The night was made for *dancing*", "Whisper a yes — we'll take it from there on WhatsApp"). Human, never corporate.
- **La Rumba** is a named, recurring event brand (weekly social; themed editions: Christmas Ball, Pool Party).
- Assets: `public/logo-mark.png`, `public/og.png`, instructor photos.

## Evidence on Hand

All real material, cleared for use (user-verified 2026-08-02):

- **Testimonials** with real student names (Kaustavi Barman, Ranjan R A, Suhavi Jaswal, +1) in the seed document.
- **Stories/blog:** 8 real posts — competition results (2nd Runner-up, Chennai Salsa Festival), La Rumba editions, workshops.
- **Photos:** 10 real studio/social photos in `public/photos/` (DSC*.jpg), instructor portraits (`rishikesh.png`, `aditya.jpg`).
- **People:** instructors Rishikesh Chhabra and DJ Aditya.
- Live stat: `stats.studentsThisWeek` (admin-maintained).
- **Do not invent** anything beyond this: no fabricated testimonials, press, awards, student counts, or a second studio.

## Product Principles

1. **Every path ends in a conversation.** WhatsApp first, Instagram second, forms never. Each surface's job is to make that message feel one tap away and socially safe.
2. **Design for the nervous beginner, welcome the dancer.** Reduce first-class fear (Foundation track, "true beginners welcome") without hiding the depth that keeps returning dancers engaged.
3. **The social is the product.** Classes teach; La Rumba retains. Show the life around the classes, not just the syllabus.
4. **Only the truth, and all of it is editable.** Every claim and face is real; every word of copy lives in the admin-editable content document.
5. **Fast on a phone, cheap on the free plan.** The performance budget and the Workers free-plan CPU cap are product constraints, not aspirations.

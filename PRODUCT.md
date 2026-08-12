# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** Hyderabad adults who have never danced — often nervous about walking into a first class. The site's job is to make sending that first WhatsApp message feel easy and low-stakes.
- **Secondary (confirmed):** experienced and returning dancers checking the weekly social (La Rumba) and higher-level batches.
- **Internal:** studio staff editing all site content through `/admin` (non-developers; single JSON document, versioned, audit-logged).

## Product Purpose

The new dancehyderabad.com: the public face and enquiry funnel of Furor, a Latin dance school. Success = a visitor books a ₹500 trial class (Razorpay) or sends a WhatsApp message; the team converts that into a Foundation-batch join. There are no signup forms or accounts — the paid path is a one-tap Razorpay page, and every other path is a human conversation. <!-- updated 2026-08-06: Razorpay trial booking + webhook are live; the original "no payments" model is retired -->

## Positioning

All confirmed as true, binding claims (user-verified 2026-08-02):

- **India's largest Latin dance school** and "India's most loved" — keep using.
- **Founded 2009; 16 years; 5 cities** — Hyderabad, Bangalore, Pune, Ahmedabad, Gurgaon. Hyderabad is home.
- **Built around the social:** class is one half; the weekly **La Rumba** social is where the dance becomes yours. This is the mechanism competitors can't truthfully copy.
- **True beginners welcome:** most students walked in having never danced; the Foundation track exists for exactly that.

## Operating Context

- Visitors arrive mostly on mobile, via Instagram (@furorhyd) and WhatsApp forwards.
- Enquiry routing: WhatsApp primary (`wa.me/918886072572` with context-aware prefilled message per style/branch/batch), Instagram DM secondary (deep link + message copied to clipboard). Every CTA fires GA4 `enquiry_click`.
- Two venues today: **Jubilee Hills** (2nd Floor, Alcazar Mall, Road No. 36) and **PUP Unleash — HUDA Colony**. (Older docs mention Kondapur; it is not current.) <!-- updated 2026-08-06 from live content -->
- Staff edit content on the deployed `/admin`; edits appear on the public site within ~30 s (per-request rendering, no redeploy). Public routes carry a 60 s edge cache that is purged on every published save, so an owner edit is immediate; an anonymous visitor who arrives between an edit and the purge may see up to 60 s-old content.

## Capabilities and Constraints

- Styles taught: Salsa, Bachata, West Coast Swing (content model is extensible).
- Public pages: home, dance-styles (+ per-style with FAQ schema), batches (filters, transparent ₹ pricing, per-batch WhatsApp CTA), about, instructors, contact, faqs, stories (blog). Floating "Talk to us" pill on every public page.
- All public copy renders from the single Zod-validated content document (`src/lib/content-schema.ts`) — never hardcode copy that staff should be able to edit.
- Batches auto-hide when `startDate` is past.
- Hosting: Cloudflare Workers **free plan** via OpenNext; content/versions/uploads in R2. Free-plan 10 ms CPU cap is a durable constraint (e.g. PBKDF2 not bcrypt for auth).
- Performance budget (binding): LCP < 2.5 s, CLS < 0.1, INP < 200 ms on Lighthouse mobile; first-load JS **total < 115 KB gzip per route**, of which **app-authored client JS < 12 KB gzip per route** (the React/Next framework floor alone measures 100.14 KB gz, so a single sub-100 KB number was unreachable without leaving Next.js; home measured 117.51 KB total / 17.37 KB app-authored as of 2026-08-13 — down from 123.60 / 23.46 KB before Plan 1 removed zod from the client bundle — but these figures drift with every change, so treat `npm run build && npm run audit:bundle` as the source of truth, not this parenthetical); LCP image **< 45 KB AVIF at DPR ≤ 2** (measured 36,741 B for the 750w variant) and **≤ 60 KB at DPR 3** (measured 54,341 B for the 1125w variant that `sizes="100vw"` selects on the sharpest phones — the owner accepted this in Task 6 over a visible quality drop from q40 re-encoding or an upscaled DPR-1 image; `npm run audit:images` negotiates the real `<picture>` srcset per DPR and reports both figures directly — cite it for this check); hero video < 2 MB. **Three public routes breach the JS budget as of 2026-08-13** — `/` and `/dance-styles` are over both limits (117.51/17.37 KB and 115.24/15.10 KB against 115/12); `/about` is over only the app-authored limit (14.14 KB vs. 12 KB; its 114.28 KB total is under 115) — re-run `npm run audit:bundle` for current numbers.

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

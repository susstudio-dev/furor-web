# Furor — Dance Hyderabad

The new dancehyderabad.com — a WhatsApp-first, Instagram-second, JSON-edited dance studio site.

Built per the OpenSpec change at `../openspec/changes/revamp-furor-site-whatsapp-first/`.

## Stack

- **Next.js 15** (App Router, TypeScript, React 19)
- **Tailwind CSS** for styling, with a dark-warm Latin palette
- **Zod** for content validation
- **bcryptjs + jose (JWT)** for admin auth
- **Single JSON content store** (`data/site-content.json`) — edited via `/admin` or directly

## First-time setup

```bash
cd furor-web
npm install
cp .env.example .env.local
# edit .env.local — at minimum set ADMIN_OWNER_EMAIL and ADMIN_OWNER_INITIAL_PASSWORD
npm run dev
```


## Content model

Single document, see `src/lib/content-schema.ts` for the Zod schema. Top-level keys:
- `site` — title, tagline, WhatsApp number, Instagram handle, socials, footer copy, `stats.studentsThisWeek`
- `hero` — headline, sub-headline, optional video URLs, poster image
- `whyFuror` — value-prop block
- `danceStyles[]` — Salsa, Bachata, WCS (extensible)
- `studios[]` — Jubilee Hills, Kondapur (extensible)
- `batches[]` — open class batches, hidden automatically when `startDate` is in the past
- `instructors[]`, `testimonials[]`, `stories[]`

## Public pages

- `/` — cinematic hero, what-we-teach grid, next-batches strip, why-Furor, how-it-works steps, live counter, style finder, "tonight" tile, closing CTA, and a "Visit us" block that loops through every studio
- `/dance-styles` and `/dance-styles/<slug>` — per-style detail with FAQ schema, level path, upcoming batches
- `/batches` — public batch table with style/branch/level filters, transparent ₹ pricing, per-batch WhatsApp CTA
- `/about` — headline, intro paragraphs, photo gallery, stats, timeline, "beyond the classroom" cards, team teaser, closing CTA (all admin-editable)
- `/instructors` — instructor cards, featured testimonial + grid, closing CTA
- `/contact` — channel tiles (WhatsApp/email/Instagram) and "Visit our studios" loop
- `/faqs` — grouped Q&A with FAQ schema
- `/stories` and `/stories/<slug>` — blog

## Enquiry routing

Every "talk to us" CTA is **WhatsApp** (primary) or **Instagram DM** (secondary).

- WhatsApp links: `https://wa.me/<number>?text=<urlencoded prefilled message>` — message is context-aware (style / branch / batch).
- Instagram links: try `instagram://user?username=<handle>` then fall back to `https://instagram.com/<handle>`. The same prefilled message is copied to the clipboard with a toast saying "Message copied — paste in Instagram DM".
- Floating "Talk to us" pill on every public page expands to both options.
- Every click fires GA4 `enquiry_click` with `{page_path, channel, source, dance_style, branch, batch_id}` (when GA4 is configured).


- 

```bash
npm run dev                      # http://localhost:3000
npm run build                    # production build (next build)
npm run start                    # serve the production build
npm run preview                  # OpenNext build + local Workers preview (wrangler)
npm run deploy                   # OpenNext build + deploy to Cloudflare Workers
npm run hash-password -- '<pw>'  # PBKDF2 hash for ADMIN_OWNER_PASSWORD_HASH
npm run typecheck                # tsc --noEmit
npm run sync-seed                # copy data/site-content.json → src/data/site-content.seed.json
npm run sync-seed -- --check     # exit non-zero if seed and local content diverge
```

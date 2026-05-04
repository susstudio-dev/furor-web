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
cd site
npm install
cp .env.example .env.local
# edit .env.local — at minimum set ADMIN_OWNER_EMAIL and ADMIN_OWNER_INITIAL_PASSWORD
npm run dev
```

Open http://localhost:3000

The first time anything reads content, the seed at `src/data/site-content.seed.json` is copied to `data/site-content.json`. The first time anyone hits `/admin/login`, the seed owner from `.env.local` is created in `data/users.json`.

## Admin

- Login: http://localhost:3000/admin
- Default credentials come from `ADMIN_OWNER_EMAIL` / `ADMIN_OWNER_INITIAL_PASSWORD` (change them on first login by editing `data/users.json` — bcrypt UI for password change is on the v1.1 backlog)
- Editors implemented: **Dashboard**, **Site & socials** (full form), **Batches** (full per-row editor), **Raw JSON** (full doc editor with Zod validation), **Versions** (one-click restore, last 30 saves), **Audit log**, **Users** (read-only list)
- Editors stubbed (use Raw JSON in the meantime): Hero, Dance styles, Studios, Instructors, Testimonials, Stories — these all have nav entries and read content, with friendly per-field forms coming next pass

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

- `/` — cinematic hero, kinetic style strip, what-we-teach grid, next-batches strip, why-Furor, studios cards, live counter, style finder, testimonials, closing CTA
- `/dance-styles` and `/dance-styles/<slug>` — per-style detail with FAQ schema, level path, upcoming batches
- `/batches` — public batch table with style/branch/level filters, transparent ₹ pricing, per-batch WhatsApp CTA
- `/studios` and `/studios/<slug>` — branch detail with embedded map, photos, LocalBusiness JSON-LD
- `/about` — instructors grid, studio history
- `/stories` and `/stories/<slug>` — legacy blog archive

## Enquiry routing

Every "talk to us" CTA is **WhatsApp** (primary) or **Instagram DM** (secondary).

- WhatsApp links: `https://wa.me/<number>?text=<urlencoded prefilled message>` — message is context-aware (style / branch / batch).
- Instagram links: try `instagram://user?username=<handle>` then fall back to `https://instagram.com/<handle>`. The same prefilled message is copied to the clipboard with a toast saying "Message copied — paste in Instagram DM".
- Floating "Talk to us" pill on every public page expands to both options.
- Every click fires GA4 `enquiry_click` with `{page_path, channel, source, dance_style, branch, batch_id}` (when GA4 is configured).

## Production deployment

- Push to GitHub, import into Vercel.
- Set env vars in Vercel: `JWT_SECRET` (32+ random bytes), `ADMIN_OWNER_EMAIL`, `ADMIN_OWNER_INITIAL_PASSWORD`, `NEXT_PUBLIC_GA4_ID`.
- For prod content persistence, swap the local-filesystem store in `src/lib/content.ts` and `src/lib/content-write.ts` for Vercel Blob (the stub is in `readBlob()`). The shape of `site-content.json` does not change.
- Point `www.dancehyderabad.com` at Vercel after smoke-testing.

## Performance budget

- LCP < 2.5s, CLS < 0.1, INP < 200ms on Lighthouse mobile preset.
- First-load JS < 100 KB gzipped per route.
- Hero image < 120 KB AVIF; hero video (if used) < 2 MB.
- Add a Lighthouse-CI step to GitHub Actions before going live.

## Scripts

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

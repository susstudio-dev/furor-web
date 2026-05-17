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

Open http://localhost:3000

The first time anything reads content, the seed at `src/data/site-content.seed.json` is copied to `data/site-content.json`. The first time anyone hits `/admin/login`, the seed owner from `.env.local` is created in `data/users.json`.

## Editing content (the workflow)

`data/site-content.json` is **gitignored** — your admin edits stay on your machine until you opt into sharing them. The seed at `src/data/site-content.seed.json` is the version that ships in git and gets used by fresh dev / prod environments on first run.

To share your local content edits with the team and deploy them to prod:

```bash
# 1. edit content via the admin panel (http://localhost:3000/admin)
# 2. when you're happy with it:
npm run sync-seed
# 3. then commit just the seed file:
git add src/data/site-content.seed.json
git commit -m "content: ..."
git push
```

Other useful flags:
- `npm run sync-seed -- --check` — exits non-zero if your local content has diverged from the seed (good for a pre-push check or CI guard).

Pulling teammate content changes is automatic: `git pull`, then on next request the seed values fill anything missing from your local `data/site-content.json` via the deep-merge in `getContent()`. If you want a hard reset to match the seed exactly, delete `data/site-content.json` and let the dev server reseed.

## Admin

- Login: http://localhost:3000/admin/login
- Default credentials come from `ADMIN_OWNER_EMAIL` / `ADMIN_OWNER_INITIAL_PASSWORD` in `.env.local`. The owner record is seeded into `data/users.json` on first successful sign-in. To change the password later, delete `data/users.json` and update the env var, then sign in again.
- Editor sections in the sidebar:
  - **Site & socials** — title, tagline, WhatsApp/Instagram, footer, socials, notice banner, "Tonight" tile, Why Furor
  - **Hero** — headline, sub, poster image, video URLs
  - **Page copy** — per-page editors for Home, About, FAQs, Contact, Instructors, and the Dance Styles / Batches / Stories index headlines
  - **Content** — Dance styles (with FAQs + level outcomes), Studios, Batches, Instructors, Testimonials, Stories
  - **System** — Raw JSON editor, Versions (30 most recent saves with one-click restore), Users, Audit log
- Every save snapshots a version, audit-logs the actor, and calls `revalidatePath('/', 'layout')` so changes appear on the public site immediately.

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

## Production deployment

- Push to GitHub, import into Vercel.
- Set env vars in Vercel: `JWT_SECRET` (32+ random bytes), `ADMIN_OWNER_EMAIL`, `ADMIN_OWNER_INITIAL_PASSWORD` (or `ADMIN_OWNER_PASSWORD_HASH` for a pre-hashed bcrypt), `NEXT_PUBLIC_GA4_ID`.
- Link a Vercel Blob store to the project — once `BLOB_READ_WRITE_TOKEN` is present in the runtime env, [src/lib/storage.ts](src/lib/storage.ts) automatically routes JSON, version snapshots and uploaded images to Blob instead of the (read-only) Vercel filesystem.
- On first deploy with an empty Blob store, the bundled seed loads automatically.
- Point `www.dancehyderabad.com` at Vercel after smoke-testing.

Two ways to change content in prod:
1. **Recommended:** sign in to the deployed `/admin` URL and edit there — writes go to Blob, no redeploy needed.
2. **Or:** edit locally via admin, run `npm run sync-seed`, commit + push — but the deployed site will keep showing the Blob version until you also re-seed the Blob (e.g. by deleting `site-content.json` from the Blob store, which triggers a reseed).

## Performance budget

- LCP < 2.5s, CLS < 0.1, INP < 200ms on Lighthouse mobile preset.
- First-load JS < 100 KB gzipped per route.
- Hero image < 120 KB AVIF; hero video (if used) < 2 MB.
- Add a Lighthouse-CI step to GitHub Actions before going live.

## Scripts

```bash
npm run dev                      # http://localhost:3000
npm run build                    # production build
npm run start                    # serve the production build
npm run typecheck                # tsc --noEmit
npm run lint                     # next lint
npm run sync-seed                # copy data/site-content.json → src/data/site-content.seed.json
npm run sync-seed -- --check     # exit non-zero if seed and local content diverge
```

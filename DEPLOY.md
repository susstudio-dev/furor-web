# Deploying so the studio can log in and edit

The public marketing site can live on GitHub Pages (static). **The admin panel
needs a server** — deploy the full app on **Vercel** (free). The studio team
then logs in at `dancehyderabad.com/admin` and edits courses, batches/pricing,
venue, etc. with changes live in ~60 seconds.

## One-time Vercel setup (~5 min)

1. Go to https://vercel.com/new → import `susstudio-dev/furor-web`.
2. Framework auto-detects **Next.js**. Leave build settings default.
3. **Storage → Create / Connect a Blob store** (Vercel dashboard → Storage →
   Blob → Create, then connect it to this project). Vercel auto-injects
   `BLOB_READ_WRITE_TOKEN`. This is what makes admin edits persist.
4. Add **Environment Variables** (Production + Preview):
   - `JWT_SECRET` — a 32+ char random string (run `openssl rand -base64 32`).
   - `ADMIN_OWNER_EMAIL` — the studio's login email.
   - `ADMIN_OWNER_INITIAL_PASSWORD` — a strong password (or set
     `ADMIN_OWNER_PASSWORD_HASH` to a bcrypt hash instead — preferred).
   - `NEXT_PUBLIC_GA4_ID` — optional.
   - Do **not** set `GH_PAGES` or `NEXT_PUBLIC_BASE_PATH` here (those are only
     for the GitHub Pages static mirror).
5. **Deploy.** First load seeds content from `src/data/site-content.seed.json`
   into Blob automatically.
6. Point `www.dancehyderabad.com` at Vercel (Project → Settings → Domains).

## How the studio edits content (production)

1. Visit `https://www.dancehyderabad.com/admin` → log in with the owner email
   + password from the env vars above.
2. Edit:
   - **Batches & pricing** → `/admin/batches` (full per-row editor)
   - **Site, WhatsApp, Instagram, Tonight tile, counters** → `/admin/site`
   - **Courses (dance styles), venue/studio, instructors, testimonials,
     stories** → `/admin/json` (validated JSON editor)
3. **Save** → persists to Vercel Blob, snapshots the previous version
   (last 30, one-click restore at `/admin/versions`), logs to the audit
   trail, and the public pages refresh within ~60s.
4. **Images**: uploads in admin go straight to Vercel Blob and are returned
   as CDN URLs — no redeploy.

## Notes / limits (v1)

- **Owner is env-managed in production.** One owner account (the env identity).
  Editor invites + in-app password change are dev-only for now; add a real DB
  (Vercel Postgres/KV) to enable multi-user in prod — that's the only v1.1 gap.
- To rotate the prod password: update `ADMIN_OWNER_PASSWORD_HASH` (or
  `ADMIN_OWNER_INITIAL_PASSWORD`) in Vercel env and redeploy.
- GitHub Pages mirror stays static & read-only (no `/admin` there) — fine as a
  free public copy; the real site is the Vercel one.
- Dev is unchanged: no token → filesystem (`data/`, `public/uploads/`),
  `data/users.json` owner seeded from env on first run.

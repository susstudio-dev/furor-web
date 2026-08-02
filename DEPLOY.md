# Deploying so the studio can log in and edit

The site runs on **Cloudflare Workers (free plan)** via
[@opennextjs/cloudflare](https://opennext.js.org/cloudflare), with content,
version history and image uploads in a **Cloudflare R2 bucket** (free tier:
10 GB, zero egress). The studio team logs in at `dancehyderabad.com/admin`
and edits courses, batches/pricing, venue, etc. — changes are live within
~30 seconds.

## One-time Cloudflare setup (~15 min)

Prereqs: a Cloudflare account (free) and `npx wrangler login` once locally.

1. **Create the bucket** (name must match `wrangler.jsonc`):

   ```bash
   npx wrangler r2 bucket create furor-content
   ```

   Keep the bucket **private** — the app reads it through the Worker binding;
   nothing in it needs (or should have) a public URL. Do **not** enable the
   r2.dev subdomain.

2. **Set secrets** (each command prompts for the value):

   ```bash
   npx wrangler secret put JWT_SECRET                  # 32+ chars, e.g. `openssl rand -base64 32`
   npx wrangler secret put ADMIN_OWNER_EMAIL           # the studio's login email
   npm run hash-password -- 'the-strong-password'      # prints a pbkdf2$... string
   npx wrangler secret put ADMIN_OWNER_PASSWORD_HASH   # paste that string
   ```

   Notes:
   - **Use the pbkdf2 hash format on Workers.** bcrypt hashes still work in
     dev, but exceed the free plan's 10 ms CPU budget in production.
   - `ADMIN_OWNER_INITIAL_PASSWORD` (plaintext) also works as a secret if you
     prefer, but the hash is better.
   - `JWT_SECRET` must be fresh — do not reuse the old Vercel value (the
     repo's git history contained a dev fallback secret; treat that era as
     compromised and rotate).
   - Optional: `NEXT_PUBLIC_GA4_ID` must be set at **build** time (it's
     inlined into the client bundle) — set it as a GitHub Actions variable or
     in your shell before `npm run deploy`, not via `wrangler secret`.

3. **First deploy** (from a Linux/macOS machine or CI — see below):

   ```bash
   npm ci
   npm run deploy        # opennextjs-cloudflare build && deploy
   ```

   First load serves the seed content bundled from
   `src/data/site-content.seed.json`; the first admin save writes the live
   document into R2.

4. **Domain**: in the Cloudflare dashboard → Workers & Pages → dancehyderabad
   → Settings → Domains & Routes → add `www.dancehyderabad.com` (the zone must
   be on Cloudflare DNS). Then add a **Redirect Rule** (Rules → Redirect
   Rules, free): `dancehyderabad.com/*` → 301 →
   `https://www.dancehyderabad.com/$1` so the apex never serves duplicate
   content. Verify both before cutting DNS over.

### CI deploys (recommended)

`.github/workflows/deploy-cloudflare.yml` deploys on every push to `main`
once you add two repo secrets (GitHub → Settings → Secrets and variables →
Actions):

- `CLOUDFLARE_API_TOKEN` — create at dash.cloudflare.com/profile/api-tokens
  with the **Edit Cloudflare Workers** template + R2 write for the bucket.
- `CLOUDFLARE_ACCOUNT_ID` — dashboard right sidebar.

CI builds on Linux, which sidesteps the Windows/OneDrive build quirks this
repo works around in `next.config.mjs`.

### Cloudflare Workers Builds (the dashboard-connected build)

If the Worker is also connected to a git repo in the Cloudflare dashboard
(Workers & Pages → dancehyderabad → Settings → Build), that build runs *in addition*
to the GitHub Actions workflow above. Its defaults are a build command of
`npm run build` and a deploy command of `npx wrangler versions upload`.

`npm run build` is plain `next build` on purpose — the GitHub Pages export and
the quality gate both need it — and it does **not** emit
`.open-next/worker.js`, which `wrangler.jsonc` points `main` at. `wrangler
deploy` papers over that by detecting an OpenNext project and delegating to the
OpenNext CLI, but `wrangler versions upload` does not, so it would fail with:

```
✘ [ERROR] The entry-point file at ".open-next/worker.js" was not found.
```

The `build.command` in `wrangler.jsonc` closes that gap: wrangler runs
`scripts/build-worker.mjs` right before its entry-point check, which runs the
OpenNext build when `.open-next/worker.js` is missing and no-ops when it is
already there (so `npm run deploy` and the Actions workflow, which build first,
aren't slowed down). No dashboard change is required.

Two things worth knowing about this build:

- `NEXT_PUBLIC_GA4_ID` is inlined at build time, so it has to be set as a build
  variable in the dashboard too — the GitHub Actions variable does not apply.
- `versions upload` uploads a version without making it live, and
  `preview_urls` is `false` in `wrangler.jsonc`, so those versions are only
  reachable by promoting them manually. Production still goes out via the
  Actions workflow on push to `main`.

## How the studio edits content (production)

1. Visit `https://www.dancehyderabad.com/admin` → log in with the owner email
   + password from the secrets above.
2. Edit batches/pricing, site settings, page copy, JSON, etc. as before.
3. **Save** → persists to R2, snapshots the previous version (last 30,
   one-click restore at `/admin/versions`), logs to the audit trail. Public
   pages render per-request, so changes appear within ~30 s everywhere.
4. **Images**: uploads go to R2 and come back as `/uploads/<id>.<ext>` URLs
   served by the Worker with immutable caching — no redeploy.

## Migrating off Vercel (one-time checklist)

1. Deploy to Cloudflare and smoke-test on the workers.dev URL (`/`, `/admin`
   login, a save, an image upload, `/api/admin/health`).
2. **Push the restored Vercel data into R2** (already staged locally on
   2026-08-02: `data/site-content.json` + `data/versions/` + images in
   `public/uploads/`, with all Blob URLs rewritten to `/uploads/…`):

   ```bash
   npm run migrate-to-r2 -- --dry-run   # review the list
   npm run migrate-to-r2                # upload (needs `npx wrangler login`)
   ```

   The same content is also baked into the git seed, so even an empty bucket
   serves the right site — the upload just makes it the live, editable copy
   and restores version history.
3. Point DNS at the Worker (step 4 above), verify, then delete the Vercel
   project + Blob store. The old `*.vercel.app` URL should be gone or
   redirected — don't leave it serving a copy.
4. Rotate `JWT_SECRET` if you haven't already.

## Free-plan limits that shape this app

| Limit | Value | How the app fits |
|---|---|---|
| Worker requests | 100k/day | Small-traffic studio site |
| Worker CPU | 10 ms/request | PBKDF2 (not bcrypt) login; no ImageResponse; SSR pages are lean |
| Worker bundle | 3 MB gzipped | Dynamic OG image replaced by static `public/og.png` |
| R2 | 10 GB, 1M writes/mo, 10M reads/mo | One JSON doc + 30 snapshots + images; 30 s content cache bounds reads |
| Image resizing | paid | `images.unoptimized` — pre-size photos before uploading |

## Notes / limits (v1)

- **Owner is secret-managed in production.** One owner account. Editor
  invites + in-app password change are dev-only; multi-user needs a real
  user store (R2 is fine) — that's the v1.1 gap.
- To rotate the prod password: `npm run hash-password -- '<new>'` →
  `npx wrangler secret put ADMIN_OWNER_PASSWORD_HASH` → redeploy.
- Login rate limiting is per-isolate on Workers (each PoP counts its own
  5-per-10-min window). Combined with the KDF and the 300 ms response floor
  this is proportionate for a single-admin site; a KV-backed limiter is the
  upgrade path if it ever matters.
- GitHub Pages mirror stays static & read-only (no `/admin`) and is
  **noindexed** — it builds from the git seed, so it lags prod edits until
  `npm run sync-seed` + push. The real site is the Cloudflare one.
- Dev is unchanged: no bucket → filesystem (`data/`, `public/uploads/`),
  `data/users.json` owner seeded from env on first run.
- Local `npm run preview` (Windows): if the OpenNext build misbehaves on
  Windows, run it in WSL or lean on CI — known adapter rough edges.

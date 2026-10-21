# Design: Vercel → Cloudflare migration, favicon, SEO, security & governance

Date: 2026-08-02 · Status: approved for implementation (autonomous session)

## Goal

Move dancehyderabad.com off Vercel onto **Cloudflare Workers (free plan)** with
data on **Cloudflare R2 (free tier)**, while keeping the local-dev and GitHub
Pages mirror workflows intact. In the same pass: fix the favicon, bring SEO to
best-in-class for a local business, and harden security + governance.

## Constraints (verified 2026-08)

| Limit | Free-plan value | Consequence for this app |
|---|---|---|
| Workers requests | 100k/day | Fine (small-traffic studio site) |
| Workers CPU | **10 ms/request** | ❌ bcryptjs (~100 ms) cannot run → new prod credential check |
| R2 storage / ops | 10 GB, 1M writes, 10M reads /mo | Fine for one JSON doc + versions + images |
| Image resizing | Paid binding | Use `images.unoptimized` |
| R2 egress | Free | Serve uploads through the Worker |

## Architecture decisions

### 1. Runtime: `@opennextjs/cloudflare` on Workers
- `wrangler.jsonc`: `nodejs_compat` + `global_fetch_strictly_public`, assets
  binding, `WORKER_SELF_REFERENCE`, R2 buckets `NEXT_INC_CACHE_R2_BUCKET`
  (OpenNext cache) and `CONTENT_BUCKET` (app data) — one physical bucket
  `furor-content` is fine; cache uses its own key prefix.
- `open-next.config.ts` with `r2IncrementalCache`. No queue/tag-cache: public
  pages become **runtime-dynamic** (below) so ISR machinery isn't needed.
- Do **not** call `initOpenNextCloudflareForDev()` — `next dev` keeps today's
  pure-filesystem workflow (`data/`, `public/uploads/`).
- `npm run preview` / `npm run deploy` scripts; CI deploy via GitHub Actions
  with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets.

### 2. Storage: driver split in `src/lib/storage.ts`
- Same public API (`readText/writeText/readJSON/writeJSON/listKeys/deleteKey/
  writeBinary`). Driver chosen once: **R2** when running in the OpenNext
  worker (NODE_ENV=production + binding available via `getCloudflareContext`),
  **filesystem** otherwise (dev unchanged). `@vercel/blob` removed.
- R2 is strongly consistent → the cache-buster/`head` workarounds Blob needed
  disappear.
- **Uploads**: stored at `uploads/<uuid>.<ext>` in R2 and returned as a
  **relative URL `/uploads/<name>`** — the same shape dev uses. A new route
  `src/app/uploads/[file]/route.ts` streams from R2 with
  `Cache-Control: public, max-age=31536000, immutable` (uuid filenames).
  No public bucket, no r2.dev URL, zero egress cost, and content JSON stays
  portable across hosts.
- Old absolute `*.public.blob.vercel-storage.com` URLs inside previously saved
  content keep rendering until the Vercel store is deleted; DEPLOY.md gets a
  migration note (re-upload images via admin once, before deleting Vercel).

### 3. Freshness: dynamic public pages instead of ISR
- On Vercel, pages were static + `revalidatePath` after saves. On Workers
  without tag-cache/queue that breaks silently. Instead the root layout calls
  Next 15's `connection()` **guarded by `GH_PAGES !== 'true'`** → every page
  under the layout renders per-request on Workers, while the GitHub Pages
  static export stays fully static (env is inlined at build).
- `getContent()` gains a **30 s module-level TTL cache** on top of React
  `cache()` → at most 2 R2 reads/min/isolate; admin saves bust the local
  isolate cache so the editor sees changes immediately; other PoPs within 30 s.
- `revalidatePath` calls in the save route are wrapped in try/catch (harmless
  no-op on Workers, still correct in dev).
- `sitemap.ts`/`robots.ts` stay `force-static` (seed-derived at build).

### 4. Auth on a 10 ms CPU budget
- **Plaintext env password** (`ADMIN_OWNER_INITIAL_PASSWORD`): verified with
  SHA-256 + timing-safe compare (WebCrypto) — no KDF needed when the secret
  itself is env-held plaintext.
- **Hash env** (`ADMIN_OWNER_PASSWORD_HASH`): new preferred format
  `pbkdf2$sha256$<iter>$<saltB64>$<hashB64>` verified via WebCrypto
  (default 100k iterations, the workerd cap; generator:
  `npm run hash-password`). bcrypt `$2…` hashes still verify via bcryptjs
  (works in dev/Node; documented as unsupported on the Workers free plan).
- **JWT fails closed in production**: missing `JWT_SECRET` now rejects
  login/session instead of silently using the dev fallback secret.
- File-based users (`data/users.json`) stay dev-only; `fs` is
  dynamically imported inside that path so the module loads clean on workerd.
- Login rate limiting stays in-memory (per-isolate on Workers — documented
  limitation, acceptable for a single-admin site).

### 5. Images
- `images.unoptimized: true` everywhere (was already true on GH Pages).
  Free plan has no resizing; hero/gallery remotes (Unsplash/Cloudinary) are
  already CDN-optimized. `remotePatterns` kept for legacy Blob URLs during
  transition.

### 6. Favicon (the actual fix)
Root cause: only a 512px `src/app/icon.png` exists — no `/favicon.ico`
fallback (what browsers and Google's crawler request), no apple/manifest
icons. New set, all generated from the existing 512px mark:
- `src/app/favicon.ico` (16+32+48 multi-size) → served at `/favicon.ico`
- `src/app/icon.png` (512, kept) + `src/app/apple-icon.png` (180)
- `public/icons/icon-192.png`, `public/icons/icon-512.png` for the manifest
- `src/app/manifest.ts` (name, colors, icons) → PWA-ready, SEO signal

### 7. SEO (best-in-market for a local business)
- **Structured data** (JSON-LD components, data from the content store):
  - `DanceSchool`/`LocalBusiness` + `Organization` + `WebSite` site-wide
    (address, geo, telephone from `studios[]`, sameAs socials)
  - `Course` on dance-style pages, `FAQPage` kept, `Article` on stories,
    `BreadcrumbList` on nested pages
- **Per-page metadata**: every public page gets title/description +
  `alternates.canonical`; OG/Twitter inherit the dynamic OG image.
- **GA4 loader**: actually load gtag when `NEXT_PUBLIC_GA4_ID` is set
  (currently the events fire into a void).
- **GH Pages mirror noindex**: the mirror is a duplicate-content liability —
  `robots: { index: false }` + disallow-all robots.txt when `GH_PAGES=true`.
- `manifest.ts`, correct `themeColor`, `format-detection`, richer OG
  (locale, url), sitemap keeps custom pages/stories.

### 8. Security headers
Via `next.config` `headers()` (applied by the OpenNext routing layer; skipped
in static export): HSTS (with preload), X-Content-Type-Options,
X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin,
Permissions-Policy (camera/mic/geolocation off), and a pragmatic CSP
(`script-src 'self' 'unsafe-inline' https://www.googletagmanager.com` — Next
injects inline bootstrap scripts; nonce plumbing isn't worth per-request CPU
here), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
`upgrade-insecure-requests`. Admin pages additionally `X-Robots-Tag: noindex`.

### 9. Governance
- `DEPLOY.md` rewritten for Cloudflare (bucket setup, secrets via
  `wrangler secret put`, custom domain, free-plan notes, Vercel
  decommissioning checklist). README/`.env.example` updated.
- `.gitignore`: add `.open-next/`, `.wrangler/`, `.playwright-mcp/`,
  `cloudflare-env.d.ts`.
- New CI workflow `quality.yml`: typecheck + lint + build on push/PR.
  New `deploy-cloudflare.yml`: deploy on push to main (gated on secrets).
- `SECURITY.md` with reporting contact + threat-model notes.
- Health route rewritten to probe R2 instead of Vercel Blob; Vercel-specific
  error copy replaced.

## Out of scope (manual, documented in DEPLOY.md)
- DNS cutover for dancehyderabad.com and Cloudflare dashboard clicks
  (bucket + secrets creation) — step-by-step instructions provided.
- Copying live Blob data: content is re-savable via admin; images re-uploaded
  via admin (one-time).
- Multi-user admin in prod (unchanged v1 limitation).

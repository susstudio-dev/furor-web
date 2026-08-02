# Cloudflare Migration + Favicon + SEO + Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy furor-web on Cloudflare Workers (free plan) with R2 storage, working favicon set, best-in-class local-business SEO, and hardened security/governance.

**Architecture:** `@opennextjs/cloudflare` adapter; storage.ts gains an R2 driver (fs stays for dev); public pages become runtime-dynamic on Workers via a `GH_PAGES`-guarded `connection()` call; auth gets WebCrypto verification paths that fit the 10 ms CPU cap.

**Tech Stack:** Next.js 15 App Router, TypeScript, wrangler ≥3.99, @opennextjs/cloudflare, R2, jose, WebCrypto.

## Global Constraints

- Cloudflare **free plan only**: 10 ms CPU/request, no paid image resizing, R2 free tier.
- `next dev` local workflow must stay pure-filesystem (`data/`, `public/uploads/`).
- GH Pages static export (`GH_PAGES=true`) must keep building.
- No test runner exists in this repo → verification = `npm run typecheck`, `npm run build`, and `opennextjs-cloudflare preview` smoke checks.
- Verification after each task; commit after each task.

---

### Task 1: Cloudflare scaffolding
**Files:** Create `wrangler.jsonc`, `open-next.config.ts`, `.dev.vars.example`; Modify `package.json` (scripts + deps), `.gitignore`.
- [ ] `npm i @opennextjs/cloudflare@latest && npm i -D wrangler@latest`
- [ ] `wrangler.jsonc`: name `furor-web`, main `.open-next/worker.js`, compatibility_date current, flags `nodejs_compat` + `global_fetch_strictly_public`, assets binding ASSETS, `WORKER_SELF_REFERENCE` service, r2_buckets: `NEXT_INC_CACHE_R2_BUCKET` + `CONTENT_BUCKET` both → bucket `furor-content`.
- [ ] `open-next.config.ts` with `r2IncrementalCache`.
- [ ] scripts: `preview`, `deploy`, `upload`, `cf-typegen`.
- [ ] `.gitignore` += `.open-next/`, `.wrangler/`, `.dev.vars`, `.playwright-mcp/`, `cloudflare-env.d.ts`.
- [ ] Verify: `npm run typecheck` passes. Commit.

### Task 2: Storage driver split (R2 + fs)
**Files:** Modify `src/lib/storage.ts`; Create `src/app/uploads/[file]/route.ts`; Modify `.github/workflows/deploy-pages.yml` (strip uploads route); remove `@vercel/blob` dep.
**Produces:** same exported API; `isRemoteStorage: boolean` replaces `isProdStorage` (keep old name as alias export until call sites updated in Task 3).
- [ ] R2 driver via `getCloudflareContext()` (dynamic import of `@opennextjs/cloudflare` inside the branch); driver = R2 iff `NODE_ENV==='production'` and binding resolves; else fs. Binary writes store `httpMetadata.contentType`, return `/uploads/<name>`.
- [ ] `uploads/[file]` route: GET streams R2 object, 404 on miss, `Cache-Control: public, max-age=31536000, immutable`; filename sanitized `[a-zA-Z0-9._-]`.
- [ ] `StorageUnavailableError` message rewritten for Cloudflare (R2 binding missing).
- [ ] Add `rm -rf src/app/uploads` to the GH Pages strip step.
- [ ] `npm uninstall @vercel/blob`; purge imports (health route handled in Task 4).
- [ ] Verify typecheck + `npm run build`. Commit.

### Task 3: Content freshness on Workers
**Files:** Modify `src/lib/content.ts`, `src/app/layout.tsx`, `src/app/api/admin/save/route.ts`, `src/lib/content-write.ts`.
- [ ] `src/lib/content.ts`: module-level TTL cache (30 s) around `readText(CONTENT_KEY)` in production; export `bustContentCache()`; keep all existing never-clobber semantics.
- [ ] Root layout: `if (process.env.GH_PAGES !== 'true') await connection()` (from `next/server`) at top of `RootLayout`.
- [ ] Save route: wrap the `revalidatePath` block in try/catch; call `bustContentCache()` after successful save (also in restore route).
- [ ] Verify: `npm run build` (routes show ƒ dynamic), and `GH_PAGES=true` build still exports (run the strip in a temp copy — or rely on CI; minimum: confirm `connection()` is env-guarded). Commit.

### Task 4: Auth for 10 ms CPU + health route
**Files:** Modify `src/lib/auth.ts`; Create `scripts/hash-password.mjs`; Modify `src/app/api/admin/health/route.ts`, `package.json` (script `hash-password`).
**Produces:** `verifyCredentials` unchanged signature; hash formats: bcrypt `$2*` (dev), `pbkdf2$sha256$<iter>$<saltB64>$<hashB64>` (prod-preferred); plaintext env path via SHA-256 + `timingSafeEqual`-style constant-time compare (WebCrypto only, no Node crypto import at module top).
- [ ] JWT fail-closed: `getJwtSecret()` throws in production when `JWT_SECRET` unset; login returns 500 with clear message; `getSession`/middleware treat as invalid.
- [ ] `fs` usage in auth.ts moved to dynamic import inside file-user helpers.
- [ ] `hash-password.mjs`: reads password (argv or prompt), prints pbkdf2 string; iterations default 100000, `--iterations` flag.
- [ ] Health route: report storage driver, R2 probe (list 1 key), no Vercel references.
- [ ] Verify: typecheck; `node scripts/hash-password.mjs test123` produces parseable string; dev login still works (`npm run dev` + curl login). Commit.

### Task 5: Favicon set + manifest
**Files:** Create `src/app/favicon.ico`, `src/app/apple-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `src/app/manifest.ts`; keep `src/app/icon.png`.
- [ ] Generate 16/32/48/180/192/512 PNGs from `src/app/icon.png` (PowerShell System.Drawing, HighQualityBicubic); assemble `favicon.ico` as PNG-in-ICO container (Node script writes ICONDIR + entries).
- [ ] `manifest.ts`: name/short_name from "Furor — Dance Hyderabad", `display: 'standalone'`, `background_color`/`theme_color` matching `#fbf7f1` light scheme, icons 192+512 (`purpose: 'any maskable'` variants).
- [ ] Verify: `npm run build`; confirm `/favicon.ico` + `/manifest.webmanifest` in build output. Commit.

### Task 6: SEO — metadata + canonicals + GA loader
**Files:** Modify `src/app/layout.tsx` and every public `page.tsx` lacking metadata (per audit); Create `src/components/Analytics.tsx`.
- [ ] Layout metadata: add `alternates.canonical`, richer OG (url, locale `en_IN`), `robots` noindex when `GH_PAGES==='true'`, keywords omitted (obsolete), `formatDetection`, verification placeholder comment.
- [ ] Every public page: `generateMetadata` with title/description from content + `alternates.canonical` absolute URL.
- [ ] `Analytics.tsx`: `next/script` afterInteractive gtag bootstrap, rendered in layout only when `NEXT_PUBLIC_GA4_ID` set and not GH_PAGES.
- [ ] `robots.ts`: disallow-all when GH_PAGES.
- [ ] Verify: build; view-source spot-check via `npm run dev` curl for canonical + JSON-LD tags. Commit.

### Task 7: SEO — structured data
**Files:** Create `src/components/JsonLd.tsx` (helper rendering `<script type="application/ld+json">`), `src/lib/seo.ts` (builders); Modify home, contact, dance-styles/[slug], stories/[slug], batches pages.
- [ ] `seo.ts` builders: `organizationLd(content)`, `webSiteLd(content)`, `danceSchoolLd(content)` (LocalBusiness subtype `DanceSchool`; address/geo/telephone from `studios[]`, `sameAs` socials, openingHours if available), `courseLd(style)`, `articleLd(story)`, `breadcrumbLd(items)`.
- [ ] Layout: Organization + WebSite; home/contact: DanceSchool (one per studio); style pages: Course + Breadcrumb (keep existing FAQPage); story pages: Article + Breadcrumb.
- [ ] Verify: build + validate one page's JSON-LD by parsing the emitted JSON. Commit.

### Task 8: Security headers
**Files:** Modify `next.config.mjs`.
- [ ] Non-Pages branch gets `headers()`: HSTS `max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, CSP per design §8 (allow googletagmanager + google-analytics connect-src, `img-src 'self' data: https:`, style `'unsafe-inline'`), `/admin/:path*` extra `X-Robots-Tag: noindex, nofollow`.
- [ ] `images.unoptimized: true` in the non-Pages branch too.
- [ ] Verify: build; `npm run dev` curl -I shows headers. Commit.

### Task 9: Governance — docs, env, CI
**Files:** Rewrite `DEPLOY.md`; Modify `README.md`, `.env.example`; Create `SECURITY.md`, `.github/workflows/quality.yml`, `.github/workflows/deploy-cloudflare.yml`.
- [ ] DEPLOY.md: Cloudflare setup (bucket, `wrangler secret put JWT_SECRET/ADMIN_OWNER_EMAIL/ADMIN_OWNER_PASSWORD_HASH`, custom domain, GH Actions secrets), Vercel decommission checklist incl. image re-upload note, free-plan limits table.
- [ ] `.env.example`: remove `BLOB_READ_WRITE_TOKEN`, document Cloudflare secrets flow + `NEXT_PUBLIC_GA4_ID`.
- [ ] `quality.yml`: npm ci, typecheck, lint, build on push/PR.
- [ ] `deploy-cloudflare.yml`: on push main, build + `opennextjs-cloudflare deploy` with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`.
- [ ] Verify: YAML lint (actionlint or node yaml parse). Commit.

### Task 10: Full verification + review
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`.
- [ ] `npx opennextjs-cloudflare build` succeeds; `preview` boots; smoke: `/`, `/favicon.ico`, `/manifest.webmanifest`, login flow, admin save→public reflects, `/uploads/<x>` 404s cleanly.
- [ ] Adversarial review workflow over the full diff; fix confirmed findings.
- [ ] Final commit.

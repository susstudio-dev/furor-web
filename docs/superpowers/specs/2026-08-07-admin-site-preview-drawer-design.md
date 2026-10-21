# Admin site-preview drawer

**Date:** 2026-08-07
**Trigger:** owner asked for "a button in the admin page only for easy access to view it, when
clicked it can come from the right side to view and close it easily".
**Process:** brainstormed against the existing admin shell and the draft-preview machinery
already on this branch. Two decisions taken by the owner (what the panel shows; overlay vs
split); the framing mechanism was decided in-design and is recorded below with its reasoning.

---

## 1. What this is

A tab handle pinned to the right edge of every authenticated admin screen. Clicking it slides
a drawer in from the right containing an iframe of the **published public site**, opened to the
page that corresponds to the editor you are on. Esc, the backdrop, or the ✕ closes it.

It is a convenience window — "what does this page look like right now" — not an editing surface.

## 2. What it deliberately is not

**Not a live preview of unsaved edits.** Unsaved editor state lives in `localStorage`
(`src/lib/autosave.ts`); saved edits become drafts pending approval. Neither is visible to a
server render of the public site. Showing in-progress typing would mean piping editor state
into the public render path via `postMessage` plus a client-side content override — a far
larger build that touches how the live site renders. Ruled out.

**Not a replacement for draft review.** `/admin/drafts/[id]/review`
(`src/app/admin/drafts/[id]/review/SplitReview.tsx`) already provides a full-page split view that
overlays a specific draft using the `furor_preview` cookie, with approve/reject actions. This
drawer shows published content only and has no approval actions. The two do not overlap.

**Also not building:** URL bar, device-size toggles, resizable width, remembered open/closed
state.

## 3. The constraint that shapes the design

The public site sends `X-Frame-Options: DENY` and `frame-ancestors 'none'`. It becomes
frameable only when the `furor_preview` cookie is present — and `POST /api/admin/preview`
**requires a `draftId`** (`src/app/api/admin/preview/route.ts`, "draftId required"). There is no
existing way to mint a cookie meaning "just let me frame the published site".

Three ways out were considered:

| Option | Verdict |
| --- | --- |
| Extend `/api/admin/preview` with a no-draft mode | Rejected — widens a deliberately narrow 15-minute single-draft capability, and adds a token type for a UI convenience |
| Relax `frame-ancestors` site-wide | Rejected — removes clickjacking protection for every visitor |
| Header rule keyed on the admin session cookie | **Chosen** — no new endpoint, no new token, and `frame-ancestors 'self'` still permits only our own origin to frame |

## 4. Architecture

Four pieces.

### 4.1 `src/lib/admin-preview-path.ts`

```ts
export function publicPathForAdminPath(adminPath: string): string
```

Pure, no imports, unit-testable in isolation — the same shape as `roles.ts`, which the repo
already tests directly. Kept out of the component so the mapping can be exhaustively covered
without rendering anything.

Mapping:

| Admin path | Public path |
| --- | --- |
| `/admin`, `/admin/site`, `/admin/hero`, `/admin/pages/home` | `/` |
| `/admin/pages/about` | `/about` |
| `/admin/pages/faqs` | `/faqs` |
| `/admin/pages/contact` | `/contact` |
| `/admin/pages/instructors` | `/instructors` |
| `/admin/pages/dance-styles` | `/dance-styles` |
| `/admin/pages/batches` | `/batches` |
| `/admin/pages/stories` | `/stories` |
| `/admin/pages/privacy` | `/privacy` |
| `/admin/pages/terms` | `/terms` |
| `/admin/styles` | `/dance-styles` |
| `/admin/studios` | `/contact` (studios render there) |
| `/admin/batches` | `/batches` |
| `/admin/instructors` | `/instructors` |
| `/admin/testimonials` | `/instructors` (testimonials render there) |
| `/admin/stories` | `/stories` |
| anything else | `/` |

The fallback is total: system screens (`/admin/json`, `/admin/versions`, `/admin/users`,
`/admin/audit`, `/admin/drafts`, `/admin/payments`, `/admin/pages`, `/admin/pages/custom`,
`/admin/pages/welcome`) all resolve to `/`. `/admin/pages/welcome` has no single public URL —
`/welcome/[track]` needs a track — so it takes the fallback rather than guessing.

Matching is exact against the table, not prefix-based, so a future `/admin/stories/new` falls
back to `/` rather than silently inheriting `/stories`.

### 4.2 `src/components/admin/SitePreviewDrawer.tsx`

Client component. Props: none — it reads `usePathname()` itself, mirroring `AdminNav`.

- **Tab handle:** `position: fixed`, right edge, vertically centred, `z-40`.
- **Drawer:** `min(560px, 100vw)`, full width below `sm`, `z-50`.
- **Backdrop:** dims the editor, click closes.
- **Header:** the path being viewed, "Open in new tab ↗", and ✕.
- **Iframe:** `src` from `publicPathForAdminPath(pathname)`. Mounted only while open and
  unmounted on close, so nothing loads in the background and every reopen is a fresh fetch.
- **Close:** ✕, Esc, or backdrop — the same three exits `AdminNav`'s mobile drawer already
  implements. Body scroll locks while open.
- **Motion:** honours `prefers-reduced-motion`.

`z-40` for the handle is load-bearing: `SaveBar` is `sticky bottom-0 ... z-30` and spans the full
content width, so a bottom-right floating button would sit on top of the Save button.

Because the iframe is same-origin, links clicked inside it navigate normally. That is why no
URL bar is needed.

### 4.3 `src/app/admin/layout.tsx`

Render `<SitePreviewDrawer />` inside the authenticated branch — the same `subject ? … : null`
condition that already gates `AdminNav`. It must not render on `/admin/login` or
`/admin/change-password`: there is no session there, so the framing rule would not apply and the
iframe would be a dead grey box.

### 4.4 `next.config.mjs`

```js
{
  source: '/:path*',
  has: [{ type: 'cookie', key: 'furor_admin' }],
  headers: [
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Content-Security-Policy', value: CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'") },
    { key: 'Vary', value: 'Cookie' },
  ],
},
```

`furor_admin` is the session cookie name (`COOKIE_NAME` in `src/lib/auth.ts`).

Two placement constraints, both load-bearing, because later matching rules win per header key
under the OpenNext routing layer:

1. **After** the base `/:path*` rule, or `X-Frame-Options: DENY` and `frame-ancestors 'none'`
   would override it.
2. **Before** the existing `furor_preview` rule, so that when someone is previewing a draft the
   preview rule's stricter `Cache-Control: private, no-store` and `X-Robots-Tag: noindex` still win.

`Vary: Cookie` is mandatory: without it a shared cache could serve the frameable variant to a
public visitor. (Public HTML is already `private, no-store` today, so this is defence in depth
rather than a live hole — but the header must not be omitted on that basis.)

**Security note.** This makes the public site frameable for anyone holding an admin session
cookie. `frame-ancestors 'self'` still restricts framing to our own origin, so an attacker's page
cannot embed it; the exposure would require an attacker-controlled page on our own origin, which
implies an XSS foothold that already defeats the CSP.

## 5. Failure modes

| Case | Behaviour |
| --- | --- |
| Framing rule missing or not deployed | Iframe renders blank. "Open in new tab ↗" is always present in the header, so the feature degrades to a link rather than a mystery empty box. |
| Unauthenticated admin routes | Drawer is not rendered at all. |
| Public page 500s | The iframe shows the site's own error page. No special handling. |
| Draft preview cookie also present | Drawer shows the draft, because `furor_preview` overlays every public render. Acceptable and arguably correct; the existing `PreviewChip` is visible inside the iframe saying so. |

## 6. Testing

**Unit (vitest):** `publicPathForAdminPath` — one assertion per row of the mapping table, plus
unknown-path fallback cases (`/admin/json`, `/admin/audit`, `/admin/stories/new`, `''`).

The test keeps its own list of admin paths rather than importing `NAV`: `NAV` is a module-private
`const` in `src/app/admin/layout.tsx` (a server component that pulls in `headers`, `redirect` and
the auth stack), so importing it into a unit test would drag that whole graph in. The cost is that
adding an admin screen means adding a mapping row and a test row by hand; that is recorded here
so it is a known trade-off rather than a surprise.

**Manual, against the built worker:** the framing rule lives in the OpenNext routing layer, so
`next dev` cannot prove it. Verify with `opennextjs-cloudflare build` + `preview`:

1. Signed out, `curl -I /` still returns `X-Frame-Options: DENY`.
2. Signed in, `curl -I /` with the `furor_admin` cookie returns `SAMEORIGIN`,
   `frame-ancestors 'self'` and `Vary: Cookie`.
3. The drawer's iframe actually paints.

## 7. Risk to existing work

This lands on `admin-foundation`, the same branch as the SEO fixes and the drafts/preview
feature, which is 35 commits ahead of `origin`. It touches `next.config.mjs` and
`src/app/admin/layout.tsx` — both files the drafts/preview work also modified. Confirm no other
session is active before implementing.

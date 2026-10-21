# Security

## Reporting

Email security concerns to the site owner (see `ADMIN_OWNER_EMAIL` in the
deployment secrets) or open a private GitHub security advisory on this
repository. Please do not open public issues for vulnerabilities.

## Posture (what protects what)

- **Admin auth**: single owner identity held in Cloudflare Worker secrets
  (never in the store). Passwords verify via PBKDF2-SHA256 (WebCrypto) or a
  timing-safe compare for the plaintext-secret variant; bcrypt is accepted in
  dev only. Sessions are HS256 JWTs (`iss`/`aud` pinned) in an
  httpOnly/secure/lax cookie; production fails closed if `JWT_SECRET` is
  missing or short.
- **Route protection**: middleware gates `/admin/*`; every `/api/admin/*`
  route re-checks the session server-side (defence in depth), enforces
  same-origin on state changes, and caps request sizes before buffering.
  Restore is owner-only.
- **Rate limiting**: 5 attempts / 10 min per IP (CF-Connecting-IP), plus a
  300 ms response floor on login. Per-isolate on Workers — documented
  trade-off for the free plan; KV is the upgrade path.
- **Uploads**: magic-byte sniffed (JPEG/PNG/WebP/AVIF), server-generated
  UUID names, stored type comes from the sniff, and the serving route
  re-allowlists types + `nosniff` + restrictive CSP, so a hostile file can
  neither pick its name nor execute in the origin.
- **Content store**: private R2 bucket accessed only via Worker binding —
  audit log, version snapshots and users are not publicly addressable.
  Admin-editable URLs are schema-restricted to http(s)/relative (no
  `javascript:`), and the seed-merge skips `__proto__`.
- **Headers**: HSTS (preload), CSP (no eval, no external scripts beyond GA,
  frame-ancestors none), nosniff, frame deny, referrer + permissions policy;
  admin/api are `no-store` and `noindex`.
- **Audit**: admin actions and auth failures land in separate capped logs so
  a failed-login flood cannot evict the action history.

## Known limitations (accepted for v1)

- Store-backed accounts carry a `sessionVersion`: disabling an account or
  changing its password bumps it, which invalidates that user's outstanding
  tokens within the subject cache window (~5 s) on every admin surface —
  pages and all mutating API routes, uploads included. The env-configured
  owner has its own lever — set or bump `ADMIN_OWNER_TOKEN_EPOCH` (a wrangler
  secret, any string) to invalidate its outstanding tokens.
- A temp-password account (fresh invite) can reach exactly two things until
  it sets its own password: the change-password screen and the self-service
  endpoint that performs the change. Every mutating API refuses it.
- Draft preview uses its own 15-minute token (separate issuer/audience and a
  domain-separated secret — an admin session cookie replayed into the preview
  cookie does not verify). While it is set, public responses are
  private/no-store/noindex and the site is frameable by ITSELF only, for the
  admin's side-by-side review. The overlay applies to public renders only;
  admin editors, the save pipeline and the sitemap always read published
  content.
- Residual gaps, stated plainly: admin READ access is all-or-nothing — any
  signed-in admin session can view the whole content document and the
  payments log regardless of write grants; and the env break-glass owner
  bypasses policy entirely, including the id-immutability deny — it is the
  recovery account, and recovery means unconditional. Last sign-in times are
  best-effort (a storage blip may skip one).
- The env owner's sessions are otherwise 14-day JWTs; logout clears the
  cookie only. Rotating `JWT_SECRET` invalidates everything.
- The rate limiter and content cache are per-isolate on Workers.
- CSP allows `'unsafe-inline'` scripts (Next.js inline bootstrap); a
  nonce-based CSP needs middleware on every route and was traded away for
  free-plan CPU headroom.

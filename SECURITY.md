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

- Sessions are 14-day JWTs with no server-side revocation; logout clears the
  cookie only. Rotating `JWT_SECRET` invalidates everything.
- The rate limiter and content cache are per-isolate on Workers.
- CSP allows `'unsafe-inline'` scripts (Next.js inline bootstrap); a
  nonce-based CSP needs middleware on every route and was traded away for
  free-plan CPU headroom.

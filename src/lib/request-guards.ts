import 'server-only';

// CSRF belt-and-braces on state-changing routes. The session cookie is
// sameSite=lax which already blocks cross-site POSTs, but that protection is
// one config change away from disappearing — reject any request whose Origin
// header disagrees with the Host it arrived on. Requests without an Origin
// header (curl, same-origin fetches in some browsers) pass.
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // no Origin header → not a cross-site browser POST
  if (origin === 'null') return false; // opaque/sandboxed origins are rejected
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** 413-guard: reject bodies over `maxBytes` before buffering them. */
export function contentLengthWithin(req: Request, maxBytes: number): boolean {
  const len = req.headers.get('content-length');
  if (len == null) return true; // let the runtime's own limits apply
  const n = Number(len);
  return Number.isFinite(n) && n <= maxBytes;
}

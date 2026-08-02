import { NextResponse } from 'next/server';
import {
  clearAttempts,
  createSessionToken,
  recordAttempt,
  setSessionCookie,
  verifyCredentials,
} from '@/lib/auth';
import { audit } from '@/lib/audit';
import { sameOrigin } from '@/lib/request-guards';

// Every login response takes at least this long, success or failure — masks
// the timing difference between unknown-email (no KDF work) and
// known-email-wrong-password (full KDF), and slows online brute force.
const MIN_RESPONSE_MS = 300;

function clientIp(req: Request): string {
  // CF-Connecting-IP is set by the Cloudflare edge and not client-spoofable.
  // X-Forwarded-For is APPENDED to by proxies — only the LAST element can be
  // trusted; the first is attacker-controlled.
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',');
    return parts[parts.length - 1].trim() || 'local';
  }
  return 'local';
}

export async function POST(req: Request) {
  const started = Date.now();
  const respond = async (body: unknown, init?: ResponseInit) => {
    const elapsed = Date.now() - started;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
    }
    return NextResponse.json(body, init);
  };

  try {
    if (!sameOrigin(req)) {
      return respond({ error: 'Cross-origin request rejected' }, { status: 403 });
    }

    const ip = clientIp(req);
    const limit = recordAttempt(ip);
    if (!limit.allowed) {
      return respond(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'retry-after': String(limit.retryAfterSec) } },
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;
    const email = typeof body?.email === 'string' ? body.email.slice(0, 254) : '';
    const password = typeof body?.password === 'string' ? body.password.slice(0, 512) : '';
    if (!email || !password) {
      return respond({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      // Attacker-controlled identity is truncated and kept in a separate,
      // capped auth log so failed-login floods can't evict the admin-action
      // audit history.
      await audit({ actor: email.toLowerCase().slice(0, 64), action: 'login_failed' });
      return respond({ error: 'Invalid email or password' }, { status: 401 });
    }

    clearAttempts(ip);
    const token = await createSessionToken(user);
    await setSessionCookie(token);
    await audit({ actor: user.email, action: 'login' });
    return respond({ ok: true, role: user.role });
  } catch (err) {
    // Controlled failure instead of an opaque 500 — logged server-side,
    // generic to the client.
    console.error('admin login error:', err);
    return respond(
      { error: 'Sign-in is temporarily unavailable. Please try again.' },
      { status: 500 },
    );
  }
}

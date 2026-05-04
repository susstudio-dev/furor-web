import { NextResponse } from 'next/server';
import {
  clearAttempts,
  createSessionToken,
  recordAttempt,
  setSessionCookie,
  verifyCredentials,
} from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const limit = recordAttempt(ip);
  if (!limit.allowed) {
    return new NextResponse(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': String(limit.retryAfterSec) },
    });
  }
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  if (!body?.email || !body.password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }
  const user = await verifyCredentials(body.email, body.password);
  if (!user) {
    await audit({ actor: body.email.toLowerCase(), action: 'login_failed' });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  clearAttempts(ip);
  const token = await createSessionToken(user);
  await setSessionCookie(token);
  await audit({ actor: user.email, action: 'login' });
  return NextResponse.json({ ok: true, role: user.role });
}

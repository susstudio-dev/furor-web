import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'furor_admin';

// Fail closed: in production a missing JWT_SECRET must reject every session
// (null secret → verification always fails) instead of silently accepting
// tokens signed with the well-known dev fallback.
function getSecret(): Uint8Array | null {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === 'production') return null;
  return new TextEncoder().encode('dev-only-secret-change-me-in-production-32b');
}

export const config = {
  matcher: ['/admin/:path*'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();

  const toLogin = () => {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  };

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = getSecret();
  if (!token || !secret) return toLogin();
  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return toLogin();
  }
}

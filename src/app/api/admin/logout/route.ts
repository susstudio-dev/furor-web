import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST(req: Request) {
  const session = await getSession();
  if (session) await audit({ actor: session.email, action: 'logout' });
  await clearSessionCookie();
  const url = new URL('/admin/login', req.url);
  return NextResponse.redirect(url, { status: 303 });
}

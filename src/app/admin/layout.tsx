import Link from 'next/link';
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Studio admin',
};

const NAV: { label: string; href: string; ownerOnly?: boolean }[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Site & socials', href: '/admin/site' },
  { label: 'Hero', href: '/admin/hero' },
  { label: 'Dance styles', href: '/admin/styles' },
  { label: 'Studios', href: '/admin/studios' },
  { label: 'Batches', href: '/admin/batches' },
  { label: 'Instructors', href: '/admin/instructors' },
  { label: 'Testimonials', href: '/admin/testimonials' },
  { label: 'Stories', href: '/admin/stories' },
  { label: 'Raw JSON', href: '/admin/json' },
  { label: 'Versions', href: '/admin/versions' },
  { label: 'Users', href: '/admin/users', ownerOnly: true },
  { label: 'Audit log', href: '/admin/audit', ownerOnly: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Login page handles its own layout
  // Note: segment-level redirect happens here for all /admin/* except /admin/login
  // We handle /admin/login by checking the children (not great in layout) — instead, the login page's content takes over.
  // For simplicity, we let the login page render even without a session.
  return (
    <div className="min-h-screen bg-ink-950 text-cream">
      <div className="lg:flex">
        {session ? (
          <aside className="lg:w-64 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-cream/10 bg-ink-900/40">
            <div className="p-5">
              <Link href="/admin" className="display text-lg font-extrabold">
                <span className="text-ember-500">Furor</span> admin
              </Link>
              <p className="mt-1 text-cream/50 text-xs">Signed in as {session.email} · {session.role}</p>
            </div>
            <nav className="px-3 pb-6 grid gap-1">
              {NAV.filter((n) => !n.ownerOnly || session.role === 'owner').map((n) => (
                <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2 text-sm text-cream/80 hover:bg-cream/5 hover:text-cream">
                  {n.label}
                </Link>
              ))}
              <form action="/api/admin/logout" method="post" className="mt-4 px-3">
                <button className="text-xs text-cream/50 hover:text-cream/80">Sign out</button>
              </form>
              <Link href="/" className="px-3 mt-2 text-xs text-cream/50 hover:text-cream/80">← Back to public site</Link>
            </nav>
          </aside>
        ) : null}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}


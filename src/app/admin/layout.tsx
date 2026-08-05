import Link from 'next/link';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { canWrite } from '@/lib/guard';
import { resolveSubject } from '@/lib/subject';
import type { Subject } from '@/lib/authz';
import { getContentVersionToken } from '@/lib/content';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Studio admin',
};

interface NavItem {
  label: string;
  href: string;
  ownerOnly?: boolean;
  groupHeader?: boolean;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Site & socials', href: '/admin/site' },
  { label: 'Hero', href: '/admin/hero' },

  { label: 'Page copy', href: '/admin/pages', groupHeader: true },
  { label: '  Home page', href: '/admin/pages/home' },
  { label: '  About page', href: '/admin/pages/about' },
  { label: '  FAQs page', href: '/admin/pages/faqs' },
  { label: '  Contact page', href: '/admin/pages/contact' },
  { label: '  Instructors page', href: '/admin/pages/instructors' },
  { label: '  Dance Styles index', href: '/admin/pages/dance-styles' },
  { label: '  Batches index', href: '/admin/pages/batches' },
  { label: '  Stories index', href: '/admin/pages/stories' },
  { label: '  Privacy', href: '/admin/pages/privacy' },
  { label: '  Terms', href: '/admin/pages/terms' },
  { label: '  Welcome (post-payment)', href: '/admin/pages/welcome' },
  { label: '  Custom pages', href: '/admin/pages/custom' },

  { label: 'Content', href: '#', groupHeader: true },
  { label: 'Dance styles', href: '/admin/styles' },
  { label: 'Studios', href: '/admin/studios' },
  { label: 'Batches', href: '/admin/batches' },
  { label: 'Instructors', href: '/admin/instructors' },
  { label: 'Testimonials', href: '/admin/testimonials' },
  { label: 'Stories', href: '/admin/stories' },

  { label: 'Operations', href: '#', groupHeader: true },
  { label: 'Payments', href: '/admin/payments' },

  { label: 'System', href: '#', groupHeader: true },
  { label: 'Raw JSON', href: '/admin/json' },
  { label: 'Versions', href: '/admin/versions' },
  { label: 'Users', href: '/admin/users', ownerOnly: true },
  { label: 'Audit log', href: '/admin/audit', ownerOnly: true },
];

// Which content path each screen writes, so the menu can be filtered by what
// the account can actually do. Screens with no entry are always visible (the
// dashboard, the page-copy index, read-only screens).
const SECTION_FOR_HREF: Record<string, string> = {
  '/admin/site': 'site',
  '/admin/hero': 'hero',
  '/admin/pages/home': 'pages',
  '/admin/pages/about': 'pages',
  '/admin/pages/faqs': 'pages',
  '/admin/pages/contact': 'pages',
  '/admin/pages/instructors': 'pages',
  '/admin/pages/dance-styles': 'pages',
  '/admin/pages/batches': 'pages',
  '/admin/pages/stories': 'pages',
  '/admin/pages/privacy': 'pages',
  '/admin/pages/terms': 'pages',
  '/admin/pages/welcome': 'welcome',
  '/admin/pages/custom': 'customPages',
  '/admin/styles': 'danceStyles',
  '/admin/studios': 'studios',
  '/admin/batches': 'batches',
  '/admin/instructors': 'instructors',
  '/admin/testimonials': 'testimonials',
  '/admin/stories': 'stories',
};

// Routes an unauthenticated visitor must still be able to reach.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/change-password']);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get('x-admin-path') ?? '';
  const subject = await resolveSubject();

  // The authentication choke point. This layout used to read the session and
  // then render children anyway — with a comment saying so — which meant a
  // page without its own guard rendered its content to anyone who reached it.
  if (!subject && !PUBLIC_ADMIN_PATHS.has(path)) redirect('/admin/login');
  // The version of the content this page is rendering. Emitted as a meta tag
  // so every editor's save can carry it without threading a prop through all
  // twenty of them. It deliberately comes from the SAME cached read as the
  // content: a fresher token paired with older content would let a stale save
  // pass the conflict check and silently clobber someone.
  const contentVersion = subject ? await getContentVersionToken() : null;
  return (
    <div className="min-h-screen bg-ink-950 text-cream">
      {contentVersion ? <meta name="furor-content-version" content={contentVersion} /> : null}
      <div className="lg:flex">
        {subject ? (
          <aside className="lg:w-64 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-cream/10 bg-ink-900/40">
            <div className="p-5">
              <Link href="/admin" className="display text-lg font-extrabold">
                <span className="text-ember-500">Furor</span> admin
              </Link>
              <p className="mt-1 text-cream/50 text-xs">Signed in as {subject.email} · {subject.breakGlass ? 'owner' : subject.roleIds.join(', ') || 'no role'}</p>
            </div>
            <nav className="px-3 pb-6 grid gap-1">
              {NAV.filter((n) => navVisible(n, subject)).map((n) => {
                if (n.groupHeader) {
                  if (n.href === '#') {
                    return (
                      <p
                        key={n.label}
                        className="mt-3 px-3 py-1 text-[10px] uppercase tracking-widest text-cream/40"
                      >
                        {n.label}
                      </p>
                    );
                  }
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className="mt-3 rounded-xl px-3 py-2 text-[10px] uppercase tracking-widest text-cream/50 hover:text-ember-400"
                    >
                      {n.label}
                    </Link>
                  );
                }
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded-xl px-3 py-2 text-sm text-cream/80 hover:bg-cream/5 hover:text-cream whitespace-pre"
                  >
                    {n.label}
                  </Link>
                );
              })}
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

// A section-scoped account should see a short, honest menu rather than a list
// of links that redirect back to the dashboard.
function navVisible(item: NavItem, subject: Subject): boolean {
  if (item.groupHeader) return true;
  if (item.ownerOnly) return subject.breakGlass || subject.roleIds.includes('owner');
  const section = SECTION_FOR_HREF[item.href];
  return section ? canWrite(subject, section) : true;
}

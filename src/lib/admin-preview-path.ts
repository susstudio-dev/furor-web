// Which public page the admin site-preview drawer opens for a given editor.
//
// Kept as a pure function with no imports so it can be unit-tested on its own.
// The drawer reads usePathname() and asks this; nothing else depends on it.
//
// Matching is EXACT, never by prefix. A prefix rule would resolve a future
// detail route like /admin/stories/new to /stories — which looks right and
// quietly shows the wrong page. Unknown paths fall back to the homepage, so
// the drawer always has something real to render.
//
// Adding an admin screen means adding a row here and a row in the test. The
// NAV list in src/app/admin/layout.tsx is a module-private const inside a
// server component, so the test cannot import it to check coverage for us.

const PUBLIC_PATH_FOR_ADMIN_PATH: Record<string, string> = {
  // Screens whose content lands on the homepage.
  '/admin': '/',
  '/admin/site': '/',
  '/admin/hero': '/',
  '/admin/pages/home': '/',

  // Page-copy editors, one to one.
  '/admin/pages/about': '/about',
  '/admin/pages/faqs': '/faqs',
  '/admin/pages/contact': '/contact',
  '/admin/pages/instructors': '/instructors',
  '/admin/pages/dance-styles': '/dance-styles',
  '/admin/pages/batches': '/batches',
  '/admin/pages/stories': '/stories',
  '/admin/pages/privacy': '/privacy',
  '/admin/pages/terms': '/terms',

  // Content editors point at wherever that content actually surfaces —
  // testimonials render on the instructors page, studios on contact.
  '/admin/styles': '/dance-styles',
  '/admin/studios': '/contact',
  '/admin/batches': '/batches',
  '/admin/instructors': '/instructors',
  '/admin/testimonials': '/instructors',
  '/admin/stories': '/stories',
};

export function publicPathForAdminPath(adminPath: string): string {
  // usePathname() does not emit a trailing slash, but a hand-typed URL can.
  const key = adminPath.length > 1 ? adminPath.replace(/\/+$/, '') : adminPath;
  return PUBLIC_PATH_FOR_ADMIN_PATH[key] ?? '/';
}

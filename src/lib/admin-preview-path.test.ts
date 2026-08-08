import { describe, expect, it } from 'vitest';
import { publicPathForAdminPath } from './admin-preview-path';

// Which public page the admin's site-preview drawer opens for each editor.
// A wrong entry here is not a crash — it silently shows the editor's author a
// different page than the one they are editing, which is worse than showing
// nothing, so every row is pinned individually.

describe('publicPathForAdminPath', () => {
  const CASES: [admin: string, expected: string][] = [
    // Screens whose content lands on the homepage.
    ['/admin', '/'],
    ['/admin/site', '/'],
    ['/admin/hero', '/'],
    ['/admin/pages/home', '/'],

    // Page-copy editors map one-to-one.
    ['/admin/pages/about', '/about'],
    ['/admin/pages/faqs', '/faqs'],
    ['/admin/pages/contact', '/contact'],
    ['/admin/pages/instructors', '/instructors'],
    ['/admin/pages/dance-styles', '/dance-styles'],
    ['/admin/pages/batches', '/batches'],
    ['/admin/pages/stories', '/stories'],
    ['/admin/pages/privacy', '/privacy'],
    ['/admin/pages/terms', '/terms'],

    // Content editors map to wherever that content actually surfaces.
    ['/admin/styles', '/dance-styles'],
    ['/admin/studios', '/contact'],
    ['/admin/batches', '/batches'],
    ['/admin/instructors', '/instructors'],
    ['/admin/testimonials', '/instructors'],
    ['/admin/stories', '/stories'],
  ];

  it.each(CASES)('maps %s to %s', (admin, expected) => {
    expect(publicPathForAdminPath(admin)).toBe(expected);
  });

  // Screens with no single public counterpart. Falling back to the homepage is
  // deliberate: the drawer always shows something real.
  const FALLBACKS = [
    '/admin/json',
    '/admin/versions',
    '/admin/users',
    '/admin/audit',
    '/admin/drafts',
    '/admin/payments',
    '/admin/pages',
    '/admin/pages/custom',
    // /welcome/[track] needs a track, so there is no one page to show.
    '/admin/pages/welcome',
  ];

  it.each(FALLBACKS)('falls back to / for %s', (admin) => {
    expect(publicPathForAdminPath(admin)).toBe('/');
  });

  // The regression this pins: prefix matching would resolve a future detail
  // route to its index page and look correct while showing the wrong content.
  it('does not prefix-match unknown sub-routes', () => {
    expect(publicPathForAdminPath('/admin/stories/new')).toBe('/');
    expect(publicPathForAdminPath('/admin/batches/123/edit')).toBe('/');
    expect(publicPathForAdminPath('/admin/drafts/abc/review')).toBe('/');
  });

  it('tolerates a trailing slash and empty input', () => {
    expect(publicPathForAdminPath('/admin/pages/about/')).toBe('/about');
    expect(publicPathForAdminPath('/admin/')).toBe('/');
    expect(publicPathForAdminPath('')).toBe('/');
  });

  it('only ever returns a rooted public path', () => {
    for (const [admin] of CASES) {
      const out = publicPathForAdminPath(admin);
      expect(out.startsWith('/')).toBe(true);
      expect(out.startsWith('/admin')).toBe(false);
    }
  });
});

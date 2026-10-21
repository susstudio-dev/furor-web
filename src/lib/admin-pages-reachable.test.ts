import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A page editor nobody can navigate to is a page editor that does not exist.
//
// This is not hypothetical. /admin/pages/la-rumba shipped, was reviewed four
// times, and was reachable only by landing on the "Page copy" index and
// spotting its card — it was never added to the sidebar, where every one of
// the other twelve editors is listed. Each task had been reviewed against its
// own diff, and the diff that created the editor was not the file that lists
// it, so no reviewer had both halves in front of them. The owner found it.
//
// Two registries have to agree with the filesystem, and they are in different
// files from the route they describe:
//   - the sidebar        src/app/admin/layout.tsx          (NAV)
//   - the index grid     src/app/admin/pages/page.tsx      (PAGES)
//
// Deliberately hand-rolled with node:fs and a substring search, matching
// labels-wired.test.ts and client-bundle.test.ts: no new dependency, no AST
// library. Searching for the literal href is a tight enough proxy, because
// both registries write it as a plain string and nothing else in those files
// mentions these paths.

const ADMIN_PAGES_DIR = path.resolve(__dirname, '..', 'app', 'admin', 'pages');
const SIDEBAR_PATH = path.resolve(__dirname, '..', 'app', 'admin', 'layout.tsx');
const INDEX_PATH = path.join(ADMIN_PAGES_DIR, 'page.tsx');

/** Every `/admin/pages/<slug>` route that actually exists on disk. */
function routesOnDisk(): string[] {
  return readdirSync(ADMIN_PAGES_DIR)
    .filter((entry) => {
      const full = path.join(ADMIN_PAGES_DIR, entry);
      if (!statSync(full).isDirectory()) return false;
      // A directory is only a route if it renders something.
      try {
        return statSync(path.join(full, 'page.tsx')).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

describe('every admin page editor is reachable', () => {
  const slugs = routesOnDisk();
  const sidebar = readFileSync(SIDEBAR_PATH, 'utf8');
  const index = readFileSync(INDEX_PATH, 'utf8');

  it('finds the page editors at all (guards against a silent empty sweep)', () => {
    expect(slugs.length).toBeGreaterThan(8);
  });

  it.each(slugs)('/admin/pages/%s is listed in the sidebar', (slug) => {
    expect(sidebar).toContain(`/admin/pages/${slug}`);
  });

  it.each(slugs)('/admin/pages/%s is listed on the Page copy index', (slug) => {
    expect(index).toContain(`/admin/pages/${slug}`);
  });

  // The reverse direction: a registry entry pointing at a route that no longer
  // exists is a link to a 404, which is worse than a missing link because it
  // looks like it works until someone clicks it.
  it('lists no page editor that has been deleted', () => {
    const listed = [...sidebar.matchAll(/\/admin\/pages\/([a-z0-9-]+)/g)].map((m) => m[1]);
    for (const slug of new Set(listed)) {
      expect(slugs).toContain(slug);
    }
  });
});

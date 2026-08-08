import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Adding a guard helper does not retrofit anything — every admin page must call
// one, and 25 of ~27 pages historically had no server-side check at all, relying
// entirely on middleware that only verifies a JWT signature. This test is what
// stops the next new page from silently shipping unguarded.

const ADMIN_DIR = path.join(process.cwd(), 'src', 'app', 'admin');
const GUARDS = ['requireSubject', 'requireCapability', 'requireWriteAccess'];

// Only the login page is exempt from the sweep: it must render to a
// signed-out visitor by definition. (The layout also exempts
// /admin/change-password from ITS redirect, but that page still guards
// itself with requireSubject, so the sweep covers it.)
const EXEMPT = new Set(['login']);

function pageFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) pageFiles(full, acc);
    else if (entry === 'page.tsx') acc.push(full);
  }
  return acc;
}

describe('every admin page enforces access server-side', () => {
  const files = pageFiles(ADMIN_DIR);

  it('finds the admin pages at all (guards against a silent empty sweep)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [path.relative(ADMIN_DIR, f), f]))('%s', (rel, full) => {
    const segment = rel.split(path.sep)[0];
    if (EXEMPT.has(segment)) return;

    const source = readFileSync(full, 'utf8');
    const guarded =
      GUARDS.some((g) => source.includes(`${g}(`)) ||
      // A page may enforce with an explicit redirect on a resolved subject
      // instead of a helper — /admin/json does exactly that.
      (source.includes('resolveSubject') && source.includes('redirect('));

    expect(guarded, `${rel} has no server-side access check`).toBe(true);
  });
});

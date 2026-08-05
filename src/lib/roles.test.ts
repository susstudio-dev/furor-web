import { describe, expect, it } from 'vitest';
import { SECTION_PATHS, ROLES } from './roles';
import { SiteContentSchema } from './content-schema';

// `version` is a schema literal, not editable content.
const NOT_EDITABLE = new Set(['version']);

describe('SECTION_PATHS', () => {
  // The regression this pins: `/admin/site` writes trial, tonight and whyFuror
  // alongside site, and one denied leaf fails the whole envelope — so a key
  // missing here does not restrict a screen, it makes the screen unsavable for
  // every section-scoped account.
  it('covers every writable top-level key of the content document', () => {
    const covered = new Set(Object.values(SECTION_PATHS).flat());
    const topLevel = Object.keys(SiteContentSchema.shape).filter((k) => !NOT_EDITABLE.has(k));
    const uncovered = topLevel.filter((k) => !covered.has(k));
    expect(uncovered).toEqual([]);
  });

  it('does not grant paths that are not in the schema', () => {
    const topLevel = new Set(Object.keys(SiteContentSchema.shape));
    const phantom = Object.values(SECTION_PATHS)
      .flat()
      .filter((p) => !topLevel.has(p.split('.')[0]));
    expect(phantom).toEqual([]);
  });
});

describe('ROLES', () => {
  it('gives exactly one role every capability', () => {
    const owner = ROLES.find((r) => r.id === 'owner');
    expect(owner?.capabilities).toContain('users.manage');
    expect(owner?.capabilities).toContain('versions.restore');
  });

  it('does not ship a role whose approval flag nothing honours yet', () => {
    // Drafts arrive in a later plan. Until the save route can store one, a role
    // carrying requiresApproval would be refused outright rather than queued —
    // so no built-in role sets it.
    expect(ROLES.filter((r) => r.requiresApproval).map((r) => r.id)).toEqual([]);
  });
});

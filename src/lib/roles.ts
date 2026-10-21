// Built-in roles, as data rather than code branches.
//
// Custom role authoring (a policy store plus a glob-editing UI) is deliberately
// deferred: the Users screen assigns ROLES and SECTION KEYS, never raw globs.
// The evaluator stays data-driven, so adding custom roles later is additive.

export type Capability =
  | 'users.manage'
  | 'versions.restore'
  | 'media.delete'
  | 'theme.write'
  | 'campaigns.publish'
  | 'drafts.approve';

export interface Condition {
  /** Field read from the record being changed. */
  field: string;
  op: 'eqSubjectId' | 'eqSubjectAttr' | 'inSubjectAttr';
  /** Subject attribute to compare against, for the two attr operators. */
  attr?: 'instructorId' | 'branchSlugs' | 'styleSlugs';
}

export interface Rule {
  effect: 'allow' | 'deny';
  paths: string[];
  when?: Condition[];
}

export interface Role {
  id: string;
  name: string;
  rules: Rule[];
  capabilities: Capability[];
  /** Writable paths come from the user's `attrs.sections`. */
  sectionScoped?: boolean;
  /** Saves are stored as drafts rather than published directly. */
  requiresApproval?: boolean;
}

// Section keys are what the Users screen exposes. Mapping them to globs here
// is what makes a glob-authoring UI unnecessary.
//
// Every writable top-level key of the content document must appear under
// exactly one section, or a screen that edits it silently 403s for every
// section-scoped account. `/admin/site` writes trial/tonight/whyFuror
// alongside site, and one denied leaf fails the whole envelope — so omitting
// them made that screen unsavable rather than partially restricted.
// `roles.test.ts` pins this against the schema so a new key cannot repeat it.
export const SECTION_PATHS: Record<string, string[]> = {
  site: ['site', 'trial', 'tonight', 'whyFuror'],
  hero: ['hero'],
  batches: ['batches'],
  styles: ['danceStyles'],
  studios: ['studios'],
  instructors: ['instructors'],
  testimonials: ['testimonials'],
  stories: ['stories'],
  pages: ['pages'],
  customPages: ['customPages'],
  welcome: ['welcome'],
  labels: ['labels'],
};

// Ids are immutable once created — changing one silently re-points every
// reference to it, and ids are the join keys the authorizer itself uses.
const DENY_IDS: Rule = { effect: 'deny', paths: ['*.id', '*.*.id'] };

export const ROLES: Role[] = [
  {
    id: 'owner',
    name: 'Owner',
    rules: [{ effect: 'allow', paths: ['**'] }, DENY_IDS],
    capabilities: [
      'users.manage',
      'versions.restore',
      'media.delete',
      'theme.write',
      'campaigns.publish',
      'drafts.approve',
    ],
  },
  {
    id: 'manager',
    name: 'Manager',
    rules: [
      { effect: 'allow', paths: ['**'] },
      { effect: 'deny', paths: ['theme', 'theme.**'] },
      DENY_IDS,
    ],
    capabilities: ['versions.restore', 'media.delete', 'campaigns.publish', 'drafts.approve'],
  },
  {
    id: 'editor',
    name: 'Editor',
    rules: [DENY_IDS],
    capabilities: [],
    sectionScoped: true,
    // Editors stage changes; a Manager or Owner publishes them. The save route
    // stores anything flagged for approval as a draft (never publishes it, and
    // never refuses it either).
    requiresApproval: true,
  },
  {
    id: 'author',
    name: 'Author',
    rules: [
      { effect: 'allow', paths: ['stories'], when: [{ field: 'authorId', op: 'eqSubjectId' }] },
      DENY_IDS,
    ],
    capabilities: [],
  },
  {
    id: 'instructor',
    name: 'Instructor',
    rules: [
      {
        effect: 'allow',
        paths: ['instructors'],
        when: [{ field: 'id', op: 'eqSubjectAttr', attr: 'instructorId' }],
      },
      DENY_IDS,
    ],
    capabilities: [],
  },
  { id: 'viewer', name: 'Viewer', rules: [], capabilities: [] },
];

export function roleById(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id);
}

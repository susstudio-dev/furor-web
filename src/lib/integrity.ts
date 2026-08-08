// Document-level invariants that Zod cannot express per-field.
//
// These run on the WRITE path only, never inside SiteContentSchema. A schema
// refine would be evaluated by getContent() on every read, and a stored
// document that fails validation makes getContent() serve the bundled seed for
// the ENTIRE public site — turning one bad record into a site-wide outage.
// As a write-path check, the same violation merely refuses the save.

export interface IntegrityIssue {
  path: (string | number)[];
  message: string;
}

type Row = Record<string, unknown>;
type Doc = Record<string, unknown>;

const ID_COLLECTIONS = [
  'danceStyles',
  'studios',
  'batches',
  'instructors',
  'testimonials',
  'stories',
  'customPages',
  'campaigns',
] as const;

function rowsOf(doc: Doc, key: string): Row[] {
  const value = doc[key];
  return Array.isArray(value) ? (value as Row[]) : [];
}

function slugSet(doc: Doc, key: string): Set<string> {
  return new Set(
    rowsOf(doc, key)
      .map((r) => r.slug)
      .filter((s): s is string => typeof s === 'string' && s !== ''),
  );
}

function duplicates(doc: Doc, issues: IntegrityIssue[]): void {
  for (const key of ID_COLLECTIONS) {
    for (const field of ['id', 'slug'] as const) {
      const seen = new Set<string>();
      rowsOf(doc, key).forEach((row, i) => {
        const value = row?.[field];
        if (typeof value !== 'string' || value === '') return;
        if (seen.has(value)) {
          issues.push({ path: [key, i, field], message: `Duplicate ${field} "${value}"` });
        }
        seen.add(value);
      });
    }
  }
}

function references(doc: Doc, issues: IntegrityIssue[]): void {
  const styles = slugSet(doc, 'danceStyles');
  const studios = slugSet(doc, 'studios');

  const checkOne = (value: unknown, known: Set<string>, label: string, path: (string | number)[]) => {
    if (typeof value !== 'string' || value === '') return;
    if (!known.has(value)) issues.push({ path, message: `Unknown ${label} "${value}"` });
  };
  const checkMany = (value: unknown, known: Set<string>, label: string, base: (string | number)[]) => {
    if (!Array.isArray(value)) return;
    value.forEach((v, j) => checkOne(v, known, label, [...base, j]));
  };

  rowsOf(doc, 'batches').forEach((b, i) => {
    checkMany(b.styleSlugs, styles, 'dance style', ['batches', i, 'styleSlugs']);
    checkOne(b.branchSlug, studios, 'studio', ['batches', i, 'branchSlug']);
  });
  rowsOf(doc, 'studios').forEach((s, i) => {
    checkMany(s.styleSlugs, styles, 'dance style', ['studios', i, 'styleSlugs']);
  });
  rowsOf(doc, 'instructors').forEach((ins, i) => {
    checkMany(ins.branchSlugs, studios, 'studio', ['instructors', i, 'branchSlugs']);
    checkMany(ins.styleSlugs, styles, 'dance style', ['instructors', i, 'styleSlugs']);
  });
  rowsOf(doc, 'testimonials').forEach((t, i) => {
    checkOne(t.styleSlug, styles, 'dance style', ['testimonials', i, 'styleSlug']);
  });
}

/** Every invariant violation in the document. Empty means consistent. */
export function integrityIssues(doc: unknown): IntegrityIssue[] {
  if (doc == null || typeof doc !== 'object') return [];
  const issues: IntegrityIssue[] = [];
  duplicates(doc as Doc, issues);
  references(doc as Doc, issues);
  return issues;
}

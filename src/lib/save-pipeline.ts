import { authorize, type Subject } from './authz';
import { SiteContentSchema, type SiteContent } from './content-schema';
import { expandOps, type LeafChange } from './expand';
import { integrityIssues, type IntegrityIssue } from './integrity';
import { applyOps, type Op } from './patch';

// The whole save decision, as one pure function with no Next or R2 imports —
// so the route stays a thin shell and this is unit-testable without a Worker.

export type PipelineResult =
  | { status: 'ok'; next: SiteContent; changes: LeafChange[]; mayPublish: boolean }
  | { status: 'denied'; denied: { path: string; reason: string }[] }
  | { status: 'invalid'; issues: IntegrityIssue[] };

function issueKey(i: IntegrityIssue): string {
  return `${i.path.join('.')}::${i.message}`;
}

/** Issues present after the patch that were not already present before it. */
function introduced(before: IntegrityIssue[], after: IntegrityIssue[]): IntegrityIssue[] {
  const known = new Set(before.map(issueKey));
  return after.filter((i) => !known.has(issueKey(i)));
}

function zodIssues(doc: unknown): IntegrityIssue[] {
  const parsed = SiteContentSchema.safeParse(doc);
  return parsed.success
    ? []
    : parsed.error.issues.map((i) => ({ path: i.path as (string | number)[], message: i.message }));
}

export function applyAndAuthorize(doc: SiteContent, subject: Subject, ops: Op[]): PipelineResult {
  // 1. Expand FIRST. Authorization must see per-record leaf changes, never the
  //    literal patch path — a write at a parent path would otherwise escape
  //    every record-scoped rule.
  let changes: LeafChange[];
  let next: SiteContent;
  try {
    changes = expandOps(doc, ops);
    next = applyOps(doc, ops);
  } catch (err) {
    // Malformed or reserved path, unresolvable id, bad reorder — never a 500.
    return { status: 'invalid', issues: [{ path: [], message: (err as Error).message }] };
  }

  // 2. Authorize before anything else observable happens, so a subject with no
  //    write grants cannot use later responses as an information oracle.
  const decision = authorize(subject, changes);
  if (!decision.ok) return { status: 'denied', denied: decision.denied };

  // 3. Validate the WHOLE resulting document — never a fragment. Every
  //    top-level key except version/site/hero carries .default(), so parsing a
  //    fragment would silently reset all of them.
  //
  //    Only issues the patch INTRODUCED are rejected. A pre-existing invalid
  //    record must not make every screen unsavable for everyone, including the
  //    person trying to fix it. (Such a document is already serving the seed
  //    publicly; refusing saves would remove the only way out.)
  const afterZod = zodIssues(next);
  if (afterZod.length > 0) {
    const newIssues = introduced(zodIssues(doc), afterZod);
    if (newIssues.length > 0) return { status: 'invalid', issues: newIssues };
  }

  const parsed = SiteContentSchema.safeParse(next);
  const merged = parsed.success ? parsed.data : next;

  // 4. Document-level invariants Zod cannot express: unique ids/slugs and
  //    slug references that actually resolve. Two non-overlapping patches can
  //    otherwise orphan each other's references.
  const newIntegrity = introduced(integrityIssues(doc), integrityIssues(merged));
  if (newIntegrity.length > 0) return { status: 'invalid', issues: newIntegrity };

  return { status: 'ok', next: merged, changes, mayPublish: decision.mayPublish };
}

import type { LeafChange } from './expand';
import { matchPath } from './glob';
import { SECTION_PATHS, roleById, type Capability, type Condition, type Rule } from './roles';

export interface Subject {
  id: string;
  email: string;
  roleIds: string[];
  attrs: {
    instructorId?: string;
    branchSlugs?: string[];
    styleSlugs?: string[];
    /** Section keys for the section-scoped Editor role. */
    sections?: string[];
  };
  /** The env-configured break-glass owner. Resolved before any store lookup
   *  and never subject to policy — it is the account that recovers the site
   *  when the user store or a bad policy locks everyone else out. */
  breakGlass?: boolean;
  /** Temp password not yet replaced — the layout forces the change screen. */
  mustChangePassword?: boolean;
}

export interface AuthzResult {
  ok: boolean;
  denied: { path: string; reason: string }[];
  /** False routes an otherwise-permitted save to a draft awaiting approval. */
  mayPublish: boolean;
}

type Record_ = Record<string, unknown> | null | undefined;

function asRecord(value: unknown): Record_ {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function conditionHolds(cond: Condition, subject: Subject, record: Record_): boolean {
  if (!record) return false;
  const value = record[cond.field];

  if (cond.op === 'eqSubjectId') return value === subject.id;
  if (cond.op === 'eqSubjectAttr') {
    const attr = cond.attr ? subject.attrs[cond.attr] : undefined;
    return typeof attr === 'string' && value === attr;
  }
  const list = cond.attr ? subject.attrs[cond.attr] : undefined;
  return Array.isArray(list) && typeof value === 'string' && list.includes(value);
}

function rulesFor(subject: Subject): { rules: Rule[]; requiresApproval: boolean } {
  const rules: Rule[] = [];
  let requiresApproval = false;

  for (const id of subject.roleIds) {
    const role = roleById(id);
    if (!role) continue;
    if (role.requiresApproval) requiresApproval = true;
    rules.push(...role.rules);

    if (role.sectionScoped) {
      for (const section of subject.attrs.sections ?? []) {
        for (const path of SECTION_PATHS[section] ?? []) {
          rules.push({ effect: 'allow', paths: [path] });
        }
      }
    }
  }
  return { rules, requiresApproval };
}

function allows(rules: Rule[], subject: Subject, path: string, record: Record_): boolean {
  let allowed = false;

  for (const rule of rules) {
    if (!rule.paths.some((p) => matchPath(p, path))) continue;
    const conditionsHold = (rule.when ?? []).every((c) => conditionHolds(c, subject, record));

    if (rule.effect === 'deny') {
      // An unconditional deny always wins; a conditional one applies only when
      // its conditions hold.
      if (!rule.when || conditionsHold) return false;
      continue;
    }
    if (conditionsHold) allowed = true;
  }

  // A subject carrying branchSlugs is confined to those branches on any record
  // that HAS a branchSlug. Records without one are unaffected. This is not an
  // opt-in flag: an option the pipeline never passes would be dead code.
  const branches = subject.attrs.branchSlugs;
  if (allowed && branches?.length && record && Object.hasOwn(record, 'branchSlug')) {
    const slug = record.branchSlug;
    return typeof slug === 'string' && branches.includes(slug);
  }
  return allowed;
}

/**
 * Default-deny, deny-overrides authorization over expanded leaf changes.
 *
 * An UPDATE must be permitted against the record both BEFORE and AFTER the
 * envelope. Checking only one side is exploitable in opposite directions:
 * check only "after" and a subject can hop a record into their own scope and
 * edit it in the same request; check only "before" and they can hop a record
 * OUT of someone else's scope.
 */
export function authorize(subject: Subject, changes: LeafChange[]): AuthzResult {
  if (subject.breakGlass) return { ok: true, denied: [], mayPublish: true };

  const { rules, requiresApproval } = rulesFor(subject);
  const denied: { path: string; reason: string }[] = [];

  for (const change of changes) {
    let ok: boolean;

    if (change.kind === 'create') {
      // Absence of a prior record is never an absent constraint — a create is
      // allowed only if the NEW value satisfies the rule.
      ok = allows(rules, subject, change.path, asRecord(change.after));
    } else if (change.kind === 'delete') {
      ok = allows(rules, subject, change.path, asRecord(change.before));
    } else if (change.kind === 'reorder') {
      ok = allows(rules, subject, change.collection, null);
    } else {
      const before = asRecord(change.record?.before);
      const after = asRecord(change.record?.after);
      ok =
        allows(rules, subject, change.path, before) && allows(rules, subject, change.path, after);
    }

    if (!ok) denied.push({ path: change.path, reason: 'not permitted for this account' });
  }

  return {
    ok: denied.length === 0,
    denied,
    mayPublish: denied.length === 0 && !requiresApproval,
  };
}

export function hasCapability(subject: Subject, cap: Capability): boolean {
  if (subject.breakGlass) return true;
  return subject.roleIds.some((id) => roleById(id)?.capabilities.includes(cap) ?? false);
}

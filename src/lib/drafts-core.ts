import { z } from 'zod';
import type { Subject } from './authz';
import { applyAndAuthorize } from './save-pipeline';
import { expandOps, type LeafChange } from './expand';
import type { SiteContent } from './content-schema';
import type { Op } from './patch';
import type { User } from './users-schema';

// Draft lifecycle, pure. A draft stores the op envelope PLUS the authorization
// decision frozen at author time. Approval is an INTERSECTION: the frozen
// author decision must still hold under current policy AND the approver must
// be authorized for the same leaves — otherwise "approve replays with the
// approver's authority" would let an author bury site.whatsappNumber in patch
// 39 of a forty-patch "fix typos" draft.

const OpSchema = z.object({
  op: z.enum(['set', 'setList', 'insert', 'remove', 'reorder']),
  path: z.string().min(1),
  value: z.unknown().optional(),
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
});

export const DraftSchema = z.object({
  /** Server-generated (crypto.randomUUID) — never client-supplied. */
  id: z.string().min(1),
  title: z.string().default(''),
  note: z.string().default(''),
  authorId: z.string().min(1),
  authorEmail: z.string().default(''),
  /** The author's sessionVersion when the draft was created; a bump (disable,
   *  password change) makes every queued draft from that account unapprovable. */
  authorSv: z.number().int().nonnegative().default(0),
  status: z.enum(['open', 'approved', 'rejected']).default('open'),
  baseVersion: z.string().default(''),
  ops: z.array(OpSchema).default([]),
  /** The leaf paths the author's frozen decision covered — what the approver
   *  is shown, and what the approve request must echo back. */
  leafPaths: z.array(z.string()).default([]),
  /** Record ids the draft touches, for the preview published-filter. */
  touchedIds: z.array(z.string()).default([]),
  /** Serialized before-value per leaf path, captured at author time — the
   *  approval conflict check compares these against the live document. */
  leafBefore: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().default(''),
  reviewedBy: z.string().default(''),
  reviewedAt: z.string().default(''),
});

export type Draft = z.infer<typeof DraftSchema>;

export type BuildDraftResult =
  | { ok: true; draft: Draft }
  | { ok: false; error: string };

export function buildDraft(args: {
  doc: SiteContent;
  subject: Subject;
  ops: Op[];
  baseVersion: string;
  note: string;
  id: string;
  now: string;
}): BuildDraftResult {
  // Frozen decision: the author must be authorized for every leaf TODAY.
  // A draft is not a way to queue changes you were never allowed to make.
  const result = applyAndAuthorize(args.doc, args.subject, args.ops);
  if (result.status === 'denied') {
    return { ok: false, error: 'You are not permitted to change: ' + result.denied.map((d) => d.path).join(', ') };
  }
  if (result.status === 'invalid') {
    return { ok: false, error: result.issues[0]?.message ?? 'Validation failed' };
  }
  if (result.changes.length === 0) return { ok: false, error: 'Nothing changed' };

  const leafPaths = result.changes.map((c) => c.path);
  // Qualified `collection:id`, so an id from one collection can never satisfy
  // a check against another (e.g. a batch id unlocking an unpublished page).
  const touchedIds = [
    ...new Set(
      result.changes.flatMap((c) =>
        'id' in c && c.id && 'collection' in c && c.collection ? [`${c.collection}:${c.id}`] : [],
      ),
    ),
  ];
  const leafBefore: Record<string, string> = {};
  for (const c of result.changes) {
    leafBefore[c.path] = JSON.stringify('before' in c ? (c.before ?? null) : null);
  }

  return {
    ok: true,
    draft: DraftSchema.parse({
      id: args.id,
      note: args.note,
      title: leafPaths.slice(0, 3).join(', ') + (leafPaths.length > 3 ? ` +${leafPaths.length - 3}` : ''),
      authorId: args.subject.id,
      authorEmail: args.subject.email,
      authorSv: 0, // filled by the caller from the author's stored record
      baseVersion: args.baseVersion,
      ops: args.ops as Draft['ops'],
      leafPaths,
      touchedIds,
      leafBefore,
      createdAt: args.now,
    }),
  };
}

export type ApprovalAssessment =
  | { ok: true; changes: LeafChange[]; next: SiteContent }
  | { ok: false; reason: 'author-revoked' | 'author-no-longer-authorized' | 'approver-not-authorized' | 'conflict' | 'invalid' | 'echo-mismatch'; detail: string };

export function assessApproval(args: {
  draft: Draft;
  currentDoc: SiteContent;
  /** The author's CURRENT stored record — null when it no longer resolves. */
  authorRecord: Pick<User, 'status' | 'sessionVersion'> | null;
  authorSubject: Subject | null;
  approver: Subject;
  /** The leaf paths the approver's request echoed back. */
  echoedLeafPaths: string[];
}): ApprovalAssessment {
  const { draft, currentDoc, authorRecord, authorSubject, approver, echoedLeafPaths } = args;

  // A fired or suspended author's queued drafts must die with the account.
  // Deliberately STATUS-based, not sessionVersion-based: a routine password
  // change bumps the version and must not silently destroy the queue, while
  // disabling the account (the actual revocation act) still kills it.
  if (!authorRecord || authorRecord.status !== 'active') {
    return { ok: false, reason: 'author-revoked', detail: 'The author’s account was disabled after this draft was written.' };
  }

  // Both the echo and the conflict check derive from what the ops would do to
  // the LIVE document — never from the set frozen at author time. The frozen
  // set can drift under the ops (a setList replays a whole array, so a record
  // published after the draft was written becomes a delete leaf at approval):
  // deriving from the frozen set let an approval apply — and audit — changes
  // the approver was never shown.
  let changes: LeafChange[];
  try {
    changes = expandOps(currentDoc, draft.ops as Op[]);
  } catch (err) {
    return { ok: false, reason: 'invalid', detail: (err as Error).message };
  }

  // A live leaf the author's frozen decision never covered is base drift into
  // territory the author never saw. Conflict, never a silent skip.
  const conflicted: string[] = [];
  for (const c of changes) {
    const frozen = draft.leafBefore[c.path];
    if (frozen === undefined) {
      conflicted.push(c.path);
      continue;
    }
    const liveBefore = JSON.stringify('before' in c ? (c.before ?? null) : null);
    if (liveBefore !== frozen) conflicted.push(c.path);
  }
  if (conflicted.length > 0) {
    return {
      ok: false,
      reason: 'conflict',
      detail: `Changed since this draft was written: ${conflicted.join(', ')}. Ask the author to redo it against the current site.`,
    };
  }

  // The echo signs what will actually be applied NOW. sameSite=lax admits
  // top-level navigations, so a GET link would execute unseen — and an echo of
  // yesterday's list would sign yesterday's changes.
  const want = changes.map((c) => c.path).sort().join('\n');
  const got = [...echoedLeafPaths].sort().join('\n');
  if (want !== got) {
    return { ok: false, reason: 'echo-mismatch', detail: 'The change list moved since you reviewed it. Reload and review again.' };
  }

  // Author must still be authorized under CURRENT policy/attrs.
  if (!authorSubject) {
    return { ok: false, reason: 'author-revoked', detail: 'The author’s account no longer resolves.' };
  }
  const authorNow = applyAndAuthorize(currentDoc, authorSubject, draft.ops as Op[]);
  if (authorNow.status === 'denied') {
    return { ok: false, reason: 'author-no-longer-authorized', detail: authorNow.denied.map((d) => d.path).join(', ') };
  }
  if (authorNow.status === 'invalid') {
    return { ok: false, reason: 'conflict', detail: authorNow.issues[0]?.message ?? 'The site changed since this draft was written.' };
  }

  // And the approver must be authorized for the same changes.
  const approverNow = applyAndAuthorize(currentDoc, approver, draft.ops as Op[]);
  if (approverNow.status === 'denied') {
    return { ok: false, reason: 'approver-not-authorized', detail: approverNow.denied.map((d) => d.path).join(', ') };
  }
  if (approverNow.status === 'invalid') {
    return { ok: false, reason: 'invalid', detail: approverNow.issues[0]?.message ?? 'Validation failed' };
  }

  return { ok: true, changes: approverNow.changes, next: approverNow.next };
}

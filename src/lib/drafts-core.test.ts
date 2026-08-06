import { describe, expect, it } from 'vitest';
import seed from '@/data/site-content.seed.json';
import { SiteContentSchema, type SiteContent } from './content-schema';
import type { Subject } from './authz';
import { assessApproval, buildDraft, type Draft } from './drafts-core';

const doc = (): SiteContent => SiteContentSchema.parse(seed);

const editor: Subject = {
  id: 'u_ed',
  email: 'ed@x.com',
  roleIds: ['editor'],
  attrs: { sections: ['site'] },
};
const manager: Subject = { id: 'u_mgr', email: 'mgr@x.com', roleIds: ['manager'], attrs: {} };
const viewer: Subject = { id: 'u_view', email: 'v@x.com', roleIds: ['viewer'], attrs: {} };

const activeAuthor = { status: 'active' as const, sessionVersion: 0 };

function makeDraft(subject: Subject = editor): Draft {
  const r = buildDraft({
    doc: doc(),
    subject,
    ops: [{ op: 'set', path: 'site.tagline', value: 'A drafted tagline' }],
    baseVersion: 'L:1',
    note: 'test',
    id: 'd_1',
    now: '2026-08-06T00:00:00.000Z',
  });
  if (!r.ok) throw new Error(r.error);
  return r.draft;
}

describe('buildDraft', () => {
  it('freezes the author decision and the leaf paths', () => {
    const draft = makeDraft();
    expect(draft.leafPaths).toEqual(['site.tagline']);
    expect(draft.authorId).toBe('u_ed');
    expect(draft.status).toBe('open');
  });

  // A draft is not a way to queue changes you were never allowed to make.
  it('refuses a draft the author is not authorized to write', () => {
    const r = buildDraft({
      doc: doc(),
      subject: viewer,
      ops: [{ op: 'set', path: 'site.tagline', value: 'nope' }],
      baseVersion: 'L:1',
      note: '',
      id: 'd_2',
      now: '2026-08-06T00:00:00.000Z',
    });
    expect(r.ok).toBe(false);
  });

  it('refuses an empty draft', () => {
    const d = doc();
    const r = buildDraft({
      doc: d,
      subject: editor,
      ops: [{ op: 'set', path: 'site.tagline', value: d.site.tagline }],
      baseVersion: 'L:1',
      note: '',
      id: 'd_3',
      now: '2026-08-06T00:00:00.000Z',
    });
    expect(r.ok).toBe(false);
  });
});

describe('assessApproval', () => {
  const base = (over: Partial<Parameters<typeof assessApproval>[0]> = {}) => ({
    draft: makeDraft(),
    currentDoc: doc(),
    authorRecord: activeAuthor,
    authorSubject: editor,
    approver: manager,
    echoedLeafPaths: ['site.tagline'],
    ...over,
  });

  it('approves when everything still holds', () => {
    const r = assessApproval(base());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next.site.tagline).toBe('A drafted tagline');
  });

  // Queued drafts must die with the account.
  it('refuses a draft from a disabled author', () => {
    const r = assessApproval(base({ authorRecord: { status: 'disabled', sessionVersion: 0 } }));
    expect(r).toMatchObject({ ok: false, reason: 'author-revoked' });
  });

  it('refuses a draft after the author’s session version was bumped', () => {
    const r = assessApproval(base({ authorRecord: { status: 'active', sessionVersion: 1 } }));
    expect(r).toMatchObject({ ok: false, reason: 'author-revoked' });
  });

  // The intersection: authored-then-demoted must not approve.
  it('refuses when the author is no longer authorized for the leaves', () => {
    const demoted: Subject = { ...editor, roleIds: ['viewer'], attrs: {} };
    const r = assessApproval(base({ authorSubject: demoted }));
    expect(r).toMatchObject({ ok: false, reason: 'author-no-longer-authorized' });
  });

  it('refuses an approver who is not authorized for the leaves', () => {
    const r = assessApproval(base({ approver: viewer }));
    expect(r).toMatchObject({ ok: false, reason: 'approver-not-authorized' });
  });

  // The echo is the proof the approver saw the change list.
  it('refuses an approval that does not echo the exact leaf set', () => {
    const r = assessApproval(base({ echoedLeafPaths: [] }));
    expect(r).toMatchObject({ ok: false, reason: 'echo-mismatch' });
    const r2 = assessApproval(base({ echoedLeafPaths: ['site.tagline', 'site.title'] }));
    expect(r2).toMatchObject({ ok: false, reason: 'echo-mismatch' });
  });

  // The concurrent-edit case the leafBefore map exists for: same field,
  // different value since the base — approving would silently clobber it.
  it('refuses when the drafted field itself changed since the base', () => {
    const moved = doc();
    moved.site.tagline = 'Someone else edited this meanwhile';
    const r = assessApproval(base({ currentDoc: moved }));
    expect(r).toMatchObject({ ok: false, reason: 'conflict' });
    if (!r.ok) expect(r.detail).toContain('site.tagline');
  });

  // The narrower conflict rule: an UNRELATED publish must not wedge the queue.
  it('still approves after an unrelated field changed since the base', () => {
    const moved = doc();
    moved.hero.headline = 'A different headline entirely';
    const r = assessApproval(base({ currentDoc: moved }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.next.site.tagline).toBe('A drafted tagline');
      expect(r.next.hero.headline).toBe('A different headline entirely'); // not reverted
    }
  });

  // The manager's theme deny must hold at approval time too.
  it('refuses an approver denied on the drafted path', () => {
    const themed = buildDraft({
      doc: doc(),
      subject: { id: 'u_own', email: 'o@x.com', roleIds: ['owner'], attrs: {} },
      ops: [{ op: 'set', path: 'site.whatsappNumber', value: '910000000000' }],
      baseVersion: 'L:1',
      note: '',
      id: 'd_9',
      now: '2026-08-06T00:00:00.000Z',
    });
    if (!themed.ok) throw new Error('setup');
    // Manager holds ** allow, so this one passes for manager…
    const ok = assessApproval({
      draft: themed.draft,
      currentDoc: doc(),
      authorRecord: activeAuthor,
      authorSubject: { id: 'u_own', email: 'o@x.com', roleIds: ['owner'], attrs: {} },
      approver: manager,
      echoedLeafPaths: themed.draft.leafPaths,
    });
    expect(ok.ok).toBe(true);
    // …but a section-scoped editor as "approver" must be refused.
    const denied = assessApproval({
      draft: themed.draft,
      currentDoc: doc(),
      authorRecord: activeAuthor,
      authorSubject: { id: 'u_own', email: 'o@x.com', roleIds: ['owner'], attrs: {} },
      approver: { id: 'u_e2', email: 'e2@x.com', roleIds: ['editor'], attrs: { sections: ['batches'] } },
      echoedLeafPaths: themed.draft.leafPaths,
    });
    expect(denied).toMatchObject({ ok: false, reason: 'approver-not-authorized' });
  });
});

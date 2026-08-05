import { describe, expect, it } from 'vitest';
import { authorize, hasCapability, type Subject } from './authz';
import { expandOps } from './expand';

const doc = () => ({
  site: { whatsappNumber: '918886072572' },
  theme: { preset: 'furor-classic' },
  batches: [
    { id: 'b_1', branchSlug: 'jubilee-hills', razorpayLink: 'https://rzp.io/1' },
    { id: 'b_5', branchSlug: 'gachibowli', razorpayLink: 'https://rzp.io/5' },
  ],
  instructors: [
    { id: 'i_1', shortBio: 'A' },
    { id: 'i_2', shortBio: 'B' },
  ],
  stories: [
    { id: 's_1', authorId: 'u_sam', title: 'Mine' },
    { id: 's_2', authorId: 'u_neha', title: 'Theirs' },
  ],
});

const sub = (over: Partial<Subject> = {}): Subject => ({
  id: 'u_sam',
  email: 'sam@example.com',
  roleIds: ['viewer'],
  attrs: {},
  ...over,
});

describe('authorize', () => {
  it('denies by default', () => {
    const changes = expandOps(doc(), [{ op: 'set', path: 'site.whatsappNumber', value: 'x' }]);
    expect(authorize(sub(), changes).ok).toBe(false);
  });

  it('allows an owner everything except ids', () => {
    const owner = sub({ roleIds: ['owner'] });
    expect(authorize(owner, expandOps(doc(), [{ op: 'set', path: 'site.whatsappNumber', value: '9100' }])).ok).toBe(
      true,
    );
    expect(authorize(owner, expandOps(doc(), [{ op: 'set', path: 'batches[id=b_1].id', value: 'b_9' }])).ok).toBe(
      false,
    );
  });

  // Deny must beat allow even when the write targets the bare parent object.
  it('denies a manager writing the theme parent', () => {
    const manager = sub({ roleIds: ['manager'] });
    const changes = expandOps(doc(), [{ op: 'set', path: 'theme', value: { preset: 'evil' } }]);
    expect(authorize(manager, changes).ok).toBe(false);
  });

  it('scopes an editor to their assigned sections', () => {
    const editor = sub({ roleIds: ['editor'], attrs: { sections: ['batches'] } });
    expect(
      authorize(editor, expandOps(doc(), [{ op: 'set', path: 'batches[id=b_1].razorpayLink', value: null }])).ok,
    ).toBe(true);
    expect(authorize(editor, expandOps(doc(), [{ op: 'set', path: 'site.whatsappNumber', value: 'x' }])).ok).toBe(
      false,
    );
  });

  it('routes an approval-required role to a draft rather than a publish', () => {
    const editor = sub({ roleIds: ['editor'], attrs: { sections: ['batches'] } });
    const result = authorize(editor, expandOps(doc(), [{ op: 'set', path: 'batches[id=b_1].razorpayLink', value: null }]));
    expect(result.ok).toBe(true);
    expect(result.mayPublish).toBe(false);
  });

  it('scopes an instructor to their own record', () => {
    const priya = sub({ roleIds: ['instructor'], attrs: { instructorId: 'i_2' } });
    expect(
      authorize(priya, expandOps(doc(), [{ op: 'set', path: 'instructors[id=i_2].shortBio', value: 'mine' }])).ok,
    ).toBe(true);
    expect(
      authorize(priya, expandOps(doc(), [{ op: 'set', path: 'instructors[id=i_1].shortBio', value: 'theirs' }])).ok,
    ).toBe(false);
  });

  it('scopes an author to stories they own', () => {
    const sam = sub({ roleIds: ['author'] });
    expect(authorize(sam, expandOps(doc(), [{ op: 'set', path: 'stories[id=s_1].title', value: 'edit' }])).ok).toBe(
      true,
    );
    expect(authorize(sam, expandOps(doc(), [{ op: 'set', path: 'stories[id=s_2].title', value: 'edit' }])).ok).toBe(
      false,
    );
  });

  // THE regression test for the self-authorizing patch set: a subject must not
  // be able to move a record into their own scope and edit it in one envelope.
  it('refuses a change that moves a record into the subject scope', () => {
    const ravi = sub({ roleIds: ['editor'], attrs: { sections: ['batches'], branchSlugs: ['jubilee-hills'] } });
    const changes = expandOps(doc(), [
      { op: 'set', path: 'batches[id=b_5].branchSlug', value: 'jubilee-hills' },
      { op: 'set', path: 'batches[id=b_5].razorpayLink', value: 'https://pay.attacker.example' },
    ]);
    // No options argument: branch scoping engages from the subject's attrs,
    // because the production pipeline calls authorize() with two arguments.
    const result = authorize(ravi, changes);
    expect(result.ok).toBe(false);
    expect(result.denied[0].path).toContain('b_5');
  });

  it('still allows a branch-scoped subject to edit a record in their own branch', () => {
    const ravi = sub({ roleIds: ['editor'], attrs: { sections: ['batches'], branchSlugs: ['jubilee-hills'] } });
    const changes = expandOps(doc(), [{ op: 'set', path: 'batches[id=b_1].razorpayLink', value: null }]);
    expect(authorize(ravi, changes).ok).toBe(true);
  });

  it('leaves a branch-scoped subject free on records that have no branch', () => {
    const ravi = sub({ roleIds: ['editor'], attrs: { sections: ['stories'], branchSlugs: ['jubilee-hills'] } });
    const changes = expandOps(doc(), [{ op: 'set', path: 'stories[id=s_1].title', value: 'ok' }]);
    expect(authorize(ravi, changes).ok).toBe(true);
  });

  it('requires an explicit allow on the new value for a create', () => {
    const priya = sub({ roleIds: ['instructor'], attrs: { instructorId: 'i_2' } });
    const changes = expandOps(doc(), [
      { op: 'insert', path: 'instructors', value: { id: 'i_9', shortBio: 'planted' } },
    ]);
    expect(authorize(priya, changes).ok).toBe(false);
  });

  it('grants the break-glass owner everything without consulting roles', () => {
    const brk = sub({ roleIds: [], breakGlass: true });
    expect(authorize(brk, expandOps(doc(), [{ op: 'set', path: 'theme', value: { preset: 'x' } }])).ok).toBe(true);
    expect(hasCapability(brk, 'users.manage')).toBe(true);
  });
});

describe('hasCapability', () => {
  it('reads capabilities from the assigned roles', () => {
    expect(hasCapability(sub({ roleIds: ['manager'] }), 'versions.restore')).toBe(true);
    expect(hasCapability(sub({ roleIds: ['manager'] }), 'theme.write')).toBe(false);
    expect(hasCapability(sub({ roleIds: ['editor'] }), 'drafts.approve')).toBe(false);
  });
});

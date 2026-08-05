import { describe, expect, it } from 'vitest';
import { createUser, setStatus, updateUser } from './users-mutations';
import { UserSchema, type User } from './users-schema';
import type { Subject } from './authz';

const HASH = 'pbkdf2$sha256$50000$c2FsdA==$aGFzaGhhc2hoYXNoaGFzaGhhc2g=';

const user = (over: Partial<User> = {}): User =>
  UserSchema.parse({ id: 'u_1', email: 'a@b.com', name: 'A', passwordHash: HASH, ...over });

const owner: Subject = { id: 'u_owner', email: 'own@x.com', roleIds: ['owner'], attrs: {} };
const manager: Subject = { id: 'u_mgr', email: 'mgr@x.com', roleIds: ['manager'], attrs: {} };

const ctx = (actor: Subject) => ({
  actor,
  passwordHash: HASH,
  now: '2026-08-06T00:00:00.000Z',
  reservedEmails: ['owner@furor.test'],
});

describe('createUser', () => {
  it('generates the id server-side and ignores any the client supplied', () => {
    const r = createUser([], { email: 'new@x.com', name: 'New', roleIds: ['editor'], id: 'env-owner' } as never, ctx(owner));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.users[0].id).not.toBe('env-owner');
      expect(r.users[0].id.length).toBeGreaterThan(20);
    }
  });

  // A users.manage holder must not be able to mint an account that resolves to
  // the break-glass identity — which by design cannot be deleted or demoted.
  it('refuses the reserved break-glass email', () => {
    const r = createUser([], { email: 'Owner@Furor.test', name: 'X', roleIds: ['editor'] }, ctx(owner));
    expect(r.ok).toBe(false);
  });

  it('refuses a duplicate email regardless of case', () => {
    const r = createUser([user({ email: 'taken@x.com' })], { email: 'TAKEN@x.com', name: 'X', roleIds: ['editor'] }, ctx(owner));
    expect(r.ok).toBe(false);
  });

  // No privilege amplification: you cannot hand out capabilities you do not
  // hold yourself.
  it('refuses to grant a role whose capabilities the actor lacks', () => {
    // Manager lacks users.manage and theme.write, both of which Owner grants.
    const r = createUser([], { email: 'new@x.com', name: 'N', roleIds: ['owner'] }, ctx(manager));
    expect(r.ok).toBe(false);
  });

  it('lets an owner grant any role', () => {
    expect(createUser([], { email: 'new@x.com', name: 'N', roleIds: ['owner'] }, ctx(owner)).ok).toBe(true);
  });

  it('forces a password change on first sign-in', () => {
    const r = createUser([], { email: 'new@x.com', name: 'N', roleIds: ['editor'] }, ctx(owner));
    if (!r.ok) throw new Error('expected ok');
    expect(r.users[0].mustChangePassword).toBe(true);
    expect(r.users[0].createdBy).toBe(owner.email);
  });
});

describe('updateUser', () => {
  it('refuses to let a user change their own roles', () => {
    const self: Subject = { id: 'u_1', email: 'a@b.com', roleIds: ['editor'], attrs: {} };
    const r = updateUser([user()], 'u_1', { roleIds: ['owner'] }, ctx(self));
    expect(r.ok).toBe(false);
  });

  it('refuses to grant a role the actor does not hold', () => {
    const r = updateUser([user()], 'u_1', { roleIds: ['owner'] }, ctx(manager));
    expect(r.ok).toBe(false);
  });

  it('applies only the allow-listed fields', () => {
    const r = updateUser(
      [user()],
      'u_1',
      { name: 'Renamed', roleIds: ['editor'], sections: ['batches'], passwordHash: 'attacker' } as never,
      ctx(owner),
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.users[0].name).toBe('Renamed');
    expect(r.users[0].attrs.sections).toEqual(['batches']);
    expect(r.users[0].passwordHash).toBe(HASH); // untouched
  });

  it('refuses an unknown user', () => {
    expect(updateUser([user()], 'nope', { name: 'x' }, ctx(owner)).ok).toBe(false);
  });
});

describe('setStatus', () => {
  it('disables a user and bumps their session version', () => {
    const r = setStatus([user({ roleIds: ['editor'], sessionVersion: 2 })], 'u_1', 'disabled', ctx(owner));
    if (!r.ok) throw new Error('expected ok');
    expect(r.users[0].status).toBe('disabled');
    // Without the bump, an existing 14-day token keeps working.
    expect(r.users[0].sessionVersion).toBe(3);
  });

  it('refuses to disable the last remaining owner in the store', () => {
    const r = setStatus([user({ roleIds: ['owner'] })], 'u_1', 'disabled', ctx(owner));
    expect(r.ok).toBe(false);
  });

  it('allows disabling an owner while another active owner remains', () => {
    const users = [user({ id: 'u_1', roleIds: ['owner'] }), user({ id: 'u_2', email: 'b@x.com', roleIds: ['owner'] })];
    expect(setStatus(users, 'u_1', 'disabled', ctx(owner)).ok).toBe(true);
  });

  it('refuses to demote the last remaining owner', () => {
    const r = updateUser([user({ roleIds: ['owner'] })], 'u_1', { roleIds: ['editor'] }, ctx(owner));
    expect(r.ok).toBe(false);
  });
});

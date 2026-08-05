import { describe, expect, it } from 'vitest';
import { UserSchema, UserStoreSchema, findByEmail, type User } from './users-schema';

const minimal = {
  id: 'u_1',
  email: 'a@b.com',
  name: 'A',
  passwordHash: 'pbkdf2$sha256$50000$c2FsdA==$aGFzaGhhc2hoYXNoaGFzaGhhc2g=',
};

describe('UserSchema', () => {
  // Every field that governs access is defaulted, so a record missing one can
  // never resolve it through the prototype — the pollution vector the write
  // path already guards against on paths.
  it('defaults every field that governs access', () => {
    const u = UserSchema.parse(minimal);
    expect(u.roleIds).toEqual([]);
    expect(u.status).toBe('active');
    expect(u.sessionVersion).toBe(0);
    expect(u.mustChangePassword).toBe(false);
    expect(u.attrs).toEqual({});
  });

  it('lowercases the email so a lookup cannot be case-dodged', () => {
    expect(UserSchema.parse({ ...minimal, email: 'Mixed@Case.COM' }).email).toBe('mixed@case.com');
  });

  it('rejects a role id that does not exist', () => {
    expect(UserSchema.safeParse({ ...minimal, roleIds: ['superuser'] }).success).toBe(false);
  });

  it('accepts the built-in role ids', () => {
    expect(UserSchema.parse({ ...minimal, roleIds: ['editor'] }).roleIds).toEqual(['editor']);
  });

  it('rejects a status outside the known set', () => {
    expect(UserSchema.safeParse({ ...minimal, status: 'pending' }).success).toBe(false);
  });

  it('rejects a record with no password hash', () => {
    expect(UserSchema.safeParse({ ...minimal, passwordHash: '' }).success).toBe(false);
  });

  it('rejects a negative session version', () => {
    expect(UserSchema.safeParse({ ...minimal, sessionVersion: -1 }).success).toBe(false);
  });
});

describe('UserStoreSchema', () => {
  it('reads an empty store as an empty user list', () => {
    expect(UserStoreSchema.parse({}).users).toEqual([]);
  });

  it('rejects a store whose users are not a list', () => {
    expect(UserStoreSchema.safeParse({ users: { a: 1 } }).success).toBe(false);
  });
});

describe('findByEmail', () => {
  const users = [
    UserSchema.parse({ ...minimal, id: 'u_1', email: 'first@x.com' }),
    UserSchema.parse({ ...minimal, id: 'u_2', email: 'second@x.com' }),
  ] as User[];

  it('matches case-insensitively', () => {
    expect(findByEmail(users, 'SECOND@X.COM')?.id).toBe('u_2');
  });

  it('trims surrounding whitespace from the lookup', () => {
    expect(findByEmail(users, '  first@x.com ')?.id).toBe('u_1');
  });

  it('returns undefined for an unknown address', () => {
    expect(findByEmail(users, 'nobody@x.com')).toBeUndefined();
  });
});

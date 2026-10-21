import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';
import { UserSchema, type User } from '@/lib/users-schema';

// Mass-assignment regression for the one endpoint whose authorization is
// "am I this user?" rather than a capability. A body smuggling roleIds,
// status, sessionVersion, id or email alongside a legitimate password change
// must move NONE of them — this route is otherwise the shortest path from
// "can edit my profile" to "owner".

vi.mock('@/lib/subject', () => ({
  resolveSubject: vi.fn(),
  bustSubjectCache: vi.fn(),
}));
vi.mock('@/lib/users', () => ({
  readUserStore: vi.fn(),
  writeUserStore: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  createSessionToken: vi.fn(async () => 'token'),
  setSessionCookie: vi.fn(async () => undefined),
}));
vi.mock('@/lib/audit', () => ({
  audit: vi.fn(async () => undefined),
}));

import { POST } from './route';
import { resolveSubject } from '@/lib/subject';
import { readUserStore, writeUserStore } from '@/lib/users';

const mockSubject = vi.mocked(resolveSubject);
const mockRead = vi.mocked(readUserStore);
const mockWrite = vi.mocked(writeUserStore);

function post(body: unknown): Request {
  const text = JSON.stringify(body);
  return new Request('http://localhost/api/admin/me', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(text.length) },
    body: text,
  });
}

describe('POST /api/admin/me', () => {
  let stored: User;
  let written: User[] | null;

  beforeEach(async () => {
    vi.clearAllMocks();
    written = null;
    stored = UserSchema.parse({
      id: 'u_1',
      email: 'staff@x.com',
      name: 'Staff',
      passwordHash: await hashPassword('old-password-12'),
      roleIds: ['editor'],
      status: 'active',
      sessionVersion: 3,
      mustChangePassword: true,
    });
    mockSubject.mockResolvedValue({
      id: 'u_1',
      email: 'staff@x.com',
      roleIds: ['editor'],
      attrs: {},
      mustChangePassword: true,
    });
    mockRead.mockResolvedValue({ users: [stored], version: null });
    mockWrite.mockImplementation(async (users) => {
      written = users;
      return { lineage: 'L', rev: 1, etag: 'e' };
    });
  });

  it('changes the password and ONLY the password, whatever else the body smuggles', async () => {
    const res = await POST(
      post({
        currentPassword: 'old-password-12',
        newPassword: 'brand-new-password-99',
        // Every field below must be ignored.
        roleIds: ['owner'],
        status: 'disabled',
        sessionVersion: 99,
        id: 'env-owner',
        email: 'evil@x.com',
        attrs: { sections: ['site'] },
        passwordHash: 'attacker-controlled',
      }),
    );
    expect(res.status).toBe(200);
    expect(written).not.toBeNull();

    const next = written![0];
    expect(next.roleIds).toEqual(['editor']); // not owner
    expect(next.status).toBe('active'); // not disabled
    expect(next.id).toBe('u_1'); // not env-owner
    expect(next.email).toBe('staff@x.com'); // unchanged
    expect(next.attrs).toEqual({}); // unchanged
    expect(next.sessionVersion).toBe(4); // old + 1, never the smuggled 99
    expect(next.mustChangePassword).toBe(false); // the legitimate effect
    expect(await verifyPassword('brand-new-password-99', next.passwordHash)).toBe(true);
    expect(next.passwordHash).not.toBe('attacker-controlled');
  });

  it('refuses a wrong current password', async () => {
    const res = await POST(
      post({ currentPassword: 'not-the-password', newPassword: 'brand-new-password-99' }),
    );
    expect(res.status).toBe(403);
    expect(written).toBeNull();
  });

  it('refuses a too-short new password', async () => {
    const res = await POST(post({ currentPassword: 'old-password-12', newPassword: 'short' }));
    expect(res.status).toBe(400);
    expect(written).toBeNull();
  });
});

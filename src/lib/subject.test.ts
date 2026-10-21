import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bustSubjectCache, resolveSubject } from './subject';
import { getSession } from './auth';
import { readUserStore } from './users';
import { UserSchema } from './users-schema';

// The single source of authorization facts. Every assertion here pins a
// fail-closed behaviour that typecheck and build cannot see — deleting the
// sessionVersion comparison or "simplifying" the store-outage branch into a
// token fallback must turn this file red.

vi.mock('./auth', () => ({
  BREAK_GLASS_UID: 'env-owner',
  getSession: vi.fn(),
}));
vi.mock('./users', () => ({
  readUserStore: vi.fn(),
}));

const mockSession = vi.mocked(getSession);
const mockStore = vi.mocked(readUserStore);

const record = (over: Record<string, unknown> = {}) =>
  UserSchema.parse({
    id: 'u_1',
    email: 'staff@x.com',
    name: 'Staff',
    passwordHash: 'pbkdf2$sha256$50000$c2FsdA==$aGFzaGhhc2hoYXNoaGFzaGhhc2g=',
    roleIds: ['editor'],
    sessionVersion: 3,
    ...over,
  });

const claims = (over: Record<string, unknown> = {}) => ({
  uid: 'u_1',
  email: 'staff@x.com',
  roles: ['editor'],
  sv: 3,
  brk: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  bustSubjectCache();
});

describe('resolveSubject', () => {
  it('resolves break-glass WITHOUT consulting the store', async () => {
    mockSession.mockResolvedValue(claims({ uid: 'env-owner', brk: true, roles: ['owner'] }) as never);
    const subject = await resolveSubject();
    expect(subject?.breakGlass).toBe(true);
    expect(subject?.roleIds).toEqual(['owner']);
    // The whole point: a corrupt store or bad policy can never lock this
    // account out, because the store is never asked.
    expect(mockStore).not.toHaveBeenCalled();
  });

  it('takes roles and attrs from the STORED record, never the token', async () => {
    // A 14-day token cannot reflect yesterday's demotion — a token still
    // claiming owner must resolve to what the store says today.
    mockSession.mockResolvedValue(claims({ roles: ['owner'] }) as never);
    mockStore.mockResolvedValue({
      users: [record({ roleIds: ['editor'], attrs: { sections: ['batches'] } })],
      version: null,
    });
    const subject = await resolveSubject();
    expect(subject?.roleIds).toEqual(['editor']);
    expect(subject?.attrs.sections).toEqual(['batches']);
  });

  it('resolves a disabled record to null', async () => {
    mockSession.mockResolvedValue(claims() as never);
    mockStore.mockResolvedValue({ users: [record({ status: 'disabled' })], version: null });
    expect(await resolveSubject()).toBeNull();
  });

  it('resolves a session-version mismatch to null', async () => {
    // The bump on disable/password-change is the revocation mechanism; an old
    // token must die with it.
    mockSession.mockResolvedValue(claims({ sv: 2 }) as never);
    mockStore.mockResolvedValue({ users: [record({ sessionVersion: 3 })], version: null });
    expect(await resolveSubject()).toBeNull();
  });

  it('refuses EVERY non-break-glass session when the store is unreadable', async () => {
    // On Workers a broken R2 binding makes reads fail silently as empty —
    // "trust the token when the store is gone" would turn an infrastructure
    // blip into a fail-open for every logged-in session.
    mockSession.mockResolvedValue(claims({ roles: ['owner'] }) as never);
    mockStore.mockResolvedValue(null);
    expect(await resolveSubject({ fresh: true })).toBeNull();
  });

  it('carries mustChangePassword through so the layout can enforce it', async () => {
    mockSession.mockResolvedValue(claims() as never);
    mockStore.mockResolvedValue({ users: [record({ mustChangePassword: true })], version: null });
    expect((await resolveSubject({ fresh: true }))?.mustChangePassword).toBe(true);
  });

  it('resolves null when there is no session at all', async () => {
    mockSession.mockResolvedValue(null);
    expect(await resolveSubject()).toBeNull();
    expect(mockStore).not.toHaveBeenCalled();
  });
});

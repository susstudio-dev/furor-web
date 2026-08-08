import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
import { StorageUnavailableError } from '@/lib/storage';
import { bustSubjectCache, resolveSubject } from '@/lib/subject';
import { readUserStore, writeUserStore } from '@/lib/users';
import { UserSchema } from '@/lib/users-schema';

const MAX_BODY_BYTES = 8 * 1024;
const MIN_PASSWORD_LENGTH = 12; // matches scripts/hash-password.mjs

/**
 * Self-service profile.
 *
 * This is the one endpoint whose authorization is "am I this user?" rather
 * than a capability — a freshly invited account must reach it before it holds
 * anything. That makes it the shortest path from "can edit my profile" to
 * "owner" if it ever merges a client object into the stored record, so it
 * accepts an explicit allow-list and rebuilds the record server-side.
 */
export async function POST(req: Request) {
  const subject = await resolveSubject({ fresh: true });
  if (!subject) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  if (!contentLengthWithin(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Body too large' }, { status: 413 });
  }
  if (subject.breakGlass) {
    return NextResponse.json(
      {
        error:
          'The owner account is configured in the environment. Rotate it with `wrangler secret put ADMIN_OWNER_PASSWORD_HASH`.',
      },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
    name?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const wantsPasswordChange = typeof body.newPassword === 'string' && body.newPassword.length > 0;
  const wantsRename = typeof body.name === 'string';
  if (!wantsPasswordChange && !wantsRename) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  }
  if (wantsPasswordChange && String(body.newPassword).length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const state = await readUserStore();
      if (state == null) {
        return NextResponse.json({ error: 'The user store could not be read.' }, { status: 503 });
      }
      const index = state.users.findIndex((u) => u.id === subject.id);
      if (index === -1) return NextResponse.json({ error: 'No such account' }, { status: 404 });
      const current = state.users[index];

      if (wantsPasswordChange) {
        const ok = await verifyPassword(String(body.currentPassword ?? ''), current.passwordHash);
        if (!ok) {
          await audit({ actor: subject.email, action: 'password_change_failed' });
          return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
        }
      }

      // Rebuilt from the STORED record. Only these three fields can move; a
      // body carrying roleIds, attrs, status, sessionVersion, id or email
      // changes nothing.
      const parsed = UserSchema.safeParse({
        ...current,
        name: wantsRename ? String(body.name).trim() : current.name,
        passwordHash: wantsPasswordChange
          ? await hashPassword(String(body.newPassword))
          : current.passwordHash,
        mustChangePassword: wantsPasswordChange ? false : current.mustChangePassword,
        // A password change signs out this account's OTHER sessions.
        sessionVersion: wantsPasswordChange ? current.sessionVersion + 1 : current.sessionVersion,
      });
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid change' }, { status: 400 });
      }

      const users = [...state.users];
      users[index] = parsed.data;
      const written = await writeUserStore(users, state.version);
      if (written === null) continue;

      bustSubjectCache();

      // The bump above invalidated the caller's own token too, so re-issue it —
      // otherwise changing your password logs you out mid-flow.
      if (wantsPasswordChange) {
        await setSessionCookie(
          await createSessionToken({
            uid: parsed.data.id,
            email: parsed.data.email,
            roles: parsed.data.roleIds,
            sv: parsed.data.sessionVersion,
            brk: false,
          }),
        );
        await audit({ actor: subject.email, action: 'password_changed' });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Conflicting change — try again.' }, { status: 409 });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('admin me error:', err);
    return NextResponse.json({ error: 'Request failed — see server logs' }, { status: 500 });
  }
}

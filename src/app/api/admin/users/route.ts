import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { hasCapability } from '@/lib/authz';
import { hashPassword } from '@/lib/password';
import { contentLengthWithin, sameOrigin } from '@/lib/request-guards';
import { StorageUnavailableError } from '@/lib/storage';
import { bustSubjectCache, resolveMutationSubject } from '@/lib/subject';
import { readUserStore, writeUserStore } from '@/lib/users';
import { createUser, setStatus, updateUser, type MutationResult } from '@/lib/users-mutations';

const MAX_BODY_BYTES = 16 * 1024;
const TEMP_PASSWORD_BYTES = 12;

/** A generated temp password, shown to the inviter exactly once and stored
 *  only as a hash. Unambiguous alphabet — this gets read aloud or typed from
 *  a WhatsApp message. */
function tempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(TEMP_PASSWORD_BYTES));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function reservedEmails(): string[] {
  return [(process.env.ADMIN_OWNER_EMAIL || '').trim().toLowerCase()].filter(Boolean);
}

export async function POST(req: Request) {
  return handle(req, 'create');
}

export async function PATCH(req: Request) {
  return handle(req, 'update');
}

async function handle(req: Request, kind: 'create' | 'update') {
  const gate = await resolveMutationSubject();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const subject = gate.subject;
  if (!hasCapability(subject, 'users.manage')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  if (!contentLengthWithin(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Body too large' }, { status: 413 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const state = await readUserStore();
      if (state == null) {
        return NextResponse.json(
          { error: 'The user store could not be read — refusing to write over it.' },
          { status: 503 },
        );
      }

      const plain = kind === 'create' ? tempPassword() : '';
      const ctx = {
        actor: subject,
        passwordHash: plain ? await hashPassword(plain) : '',
        now: new Date().toISOString(),
        reservedEmails: reservedEmails(),
      };

      let result: MutationResult;
      if (kind === 'create') {
        result = createUser(state.users, {
          email: String(body.email ?? ''),
          name: String(body.name ?? ''),
          roleIds: Array.isArray(body.roleIds) ? (body.roleIds as string[]) : [],
          sections: Array.isArray(body.sections) ? (body.sections as string[]) : undefined,
          instructorId: typeof body.instructorId === 'string' ? body.instructorId : undefined,
          branchSlugs: Array.isArray(body.branchSlugs) ? (body.branchSlugs as string[]) : undefined,
        }, ctx);
      } else if (body.status === 'active' || body.status === 'disabled') {
        result = setStatus(state.users, String(body.id ?? ''), body.status, ctx);
      } else {
        result = updateUser(state.users, String(body.id ?? ''), {
          name: typeof body.name === 'string' ? body.name : undefined,
          roleIds: Array.isArray(body.roleIds) ? (body.roleIds as string[]) : undefined,
          sections: Array.isArray(body.sections) ? (body.sections as string[]) : undefined,
          instructorId: typeof body.instructorId === 'string' ? body.instructorId : undefined,
          branchSlugs: Array.isArray(body.branchSlugs) ? (body.branchSlugs as string[]) : undefined,
        }, ctx);
      }

      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

      const written = await writeUserStore(result.users, state.version);
      if (written === null) continue; // someone else wrote first — re-read once

      bustSubjectCache();
      await audit({
        actor: subject.email,
        action: kind === 'create' ? 'user_created' : 'user_updated',
        detail: String(body.email ?? body.id ?? ''),
      });

      // The temp password is returned ONCE and never stored in the clear.
      return NextResponse.json({ ok: true, ...(plain ? { tempPassword: plain } : {}) });
    }
    return NextResponse.json({ error: 'Conflicting change — reload and try again.' }, { status: 409 });
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('admin users error:', err);
    return NextResponse.json({ error: 'Request failed — see server logs' }, { status: 500 });
  }
}

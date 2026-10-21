import 'server-only';
import { BREAK_GLASS_UID, getSession } from './auth';
import type { Subject } from './authz';
import { readUserStore } from './users';
import { findByEmail } from './users-schema';

// Resolving the acting subject is the ONLY place authorization facts come
// from. The JWT's `roles` claim is a hint for display; it is minted for 14 days
// and cannot reflect a demotion that happened yesterday.

// A short per-isolate cache keeps page renders from re-reading the store on
// every component. Five seconds bounds how long a suspension or demotion lags;
// a longer window is the difference between "revoked" and "revoked eventually".
// Mutating routes pass { fresh: true } and never consult it.
const SUBJECT_TTL_MS = 5_000;
let cache: { at: number; byUid: Map<string, Subject | null> } | null = null;

function cached(uid: string): Subject | null | undefined {
  if (!cache || Date.now() - cache.at > SUBJECT_TTL_MS) return undefined;
  return cache.byUid.get(uid);
}

function remember(uid: string, subject: Subject | null): void {
  if (!cache || Date.now() - cache.at > SUBJECT_TTL_MS) {
    cache = { at: Date.now(), byUid: new Map() };
  }
  cache.byUid.set(uid, subject);
}

export function bustSubjectCache(): void {
  cache = null;
}

export async function resolveSubject(opts: { fresh?: boolean } = {}): Promise<Subject | null> {
  const session = await getSession();
  if (!session) return null;

  // Break-glass resolves BEFORE any store lookup, and its identity comes from
  // the token's own claim rather than from a record. That is what keeps it
  // working when the store is missing, corrupt or locked out by a bad policy —
  // and a store record cannot impersonate it, because ids are server-generated
  // UUIDs and this uid is not one.
  if (session.brk && session.uid === BREAK_GLASS_UID) {
    return {
      id: BREAK_GLASS_UID,
      email: session.email,
      roleIds: ['owner'],
      attrs: {},
      breakGlass: true,
    };
  }

  if (!opts.fresh) {
    const hit = cached(session.uid);
    if (hit !== undefined) return hit;
  }

  const state = await readUserStore();
  if (state == null) {
    // Store unreadable. Everyone except break-glass is refused: on Workers a
    // broken R2 binding makes reads fail silently as empty, so "trust the
    // token's claims when the store is gone" would turn an infrastructure blip
    // into a fail-open for every logged-in session.
    return null;
  }

  const record = state.users.find((u) => u.id === session.uid) ?? findByEmail(state.users, session.email);
  let subject: Subject | null = null;

  if (record && record.status === 'active' && record.sessionVersion === session.sv) {
    subject = {
      id: record.id,
      email: record.email,
      roleIds: record.roleIds,
      attrs: record.attrs,
      ...(record.mustChangePassword ? { mustChangePassword: true } : {}),
    };
  }

  remember(session.uid, subject);
  return subject;
}

/** Subject resolution for MUTATING API routes: always fresh (never a subject
 *  cached before a demotion landed), and a temp-password account is refused —
 *  the layout redirect alone made mustChangePassword a UI courtesy, leaving a
 *  forwarded WhatsApp invite as a fully privileged 14-day credential for
 *  anyone who never loads a page. /api/admin/me is the one exemption: it is
 *  how the flag gets cleared. */
export async function resolveMutationSubject(): Promise<
  | { ok: true; subject: Subject }
  | { ok: false; status: 401 | 403; error: string }
> {
  const subject = await resolveSubject({ fresh: true });
  if (!subject) return { ok: false, status: 401, error: 'Unauthorized' };
  if (subject.mustChangePassword) {
    return { ok: false, status: 403, error: 'Set your own password before making changes.' };
  }
  return { ok: true, subject };
}

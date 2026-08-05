import 'server-only';
import { getSession } from './auth';
import type { Subject } from './authz';
import { SECTION_PATHS } from './roles';

/**
 * Resolves the acting subject for a request.
 *
 * Plan 1 derives it from the existing single-role JWT so the authorization
 * pipeline is exercisable today. Plan 2 replaces the BODY of this function
 * with a `users.json` lookup (roles, attrs, status, sessionVersion) — every
 * caller keeps working because the signature does not change.
 *
 * Note the current owner is the env-configured break-glass account: it is the
 * only identity that exists in production today, and it must keep working even
 * when a user store is added and something goes wrong with it.
 */
export async function resolveSubject(): Promise<Subject | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.role === 'owner') {
    return {
      id: session.email,
      email: session.email,
      roleIds: ['owner'],
      attrs: {},
      breakGlass: true,
    };
  }

  // The only other role the current JWT can carry. Until real users exist it
  // gets every section, so behaviour is unchanged for existing accounts —
  // what changes is that the write is now authorized at all.
  return {
    id: session.email,
    email: session.email,
    roleIds: ['editor'],
    attrs: { sections: Object.keys(SECTION_PATHS) },
  };
}

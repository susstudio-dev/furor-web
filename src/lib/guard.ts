import 'server-only';
import { redirect } from 'next/navigation';
import { hasCapability, type Subject } from './authz';
import { matchPath } from './glob';
import { SECTION_PATHS, roleById, type Capability } from './roles';
import { resolveSubject } from './subject';

// Guards for server components. Adding these helpers does not retrofit
// anything — each admin page must call one. `admin-pages-guarded.test.ts`
// fails the build-adjacent test run if a page ships without one.

/** Redirects to the login page unless a live subject exists. */
export async function requireSubject(): Promise<Subject> {
  const subject = await resolveSubject();
  if (!subject) redirect('/admin/login');
  return subject;
}

/** Redirects to the dashboard unless the subject holds `cap`. */
export async function requireCapability(cap: Capability): Promise<Subject> {
  const subject = await requireSubject();
  if (!hasCapability(subject, cap)) redirect('/admin');
  return subject;
}

/** True when the subject may write anywhere under `path`. Used both by the
 *  page guard and by the sidebar, so the menu shows what the account can
 *  actually do rather than a list of dead ends. */
export function canWrite(subject: Subject, path: string): boolean {
  if (subject.breakGlass) return true;

  for (const roleId of subject.roleIds) {
    const role = roleById(roleId);
    if (!role) continue;

    for (const rule of role.rules) {
      if (rule.effect !== 'allow') continue;
      if (rule.paths.some((p) => matchPath(p, path) || matchPath(path, p))) return true;
    }
    if (role.sectionScoped) {
      for (const section of subject.attrs.sections ?? []) {
        for (const granted of SECTION_PATHS[section] ?? []) {
          if (matchPath(granted, path) || matchPath(path, granted)) return true;
        }
      }
    }
  }
  return false;
}

/** Redirects unless the subject may write at least one of `paths`. */
export async function requireWriteAccess(...paths: string[]): Promise<Subject> {
  const subject = await requireSubject();
  if (!paths.some((p) => canWrite(subject, p))) redirect('/admin');
  return subject;
}

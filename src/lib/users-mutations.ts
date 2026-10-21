import type { Subject } from './authz';
import { ROLES, roleById, type Capability } from './roles';
import { UserSchema, findByEmail, type User } from './users-schema';

// Pure mutation helpers for the user store. Every one of these is an
// authorization decision as much as a data change, which is why they live here
// with tests rather than inline in a route handler.

export type MutationResult =
  | { ok: true; users: User[]; created?: User }
  | { ok: false; error: string };

export interface MutationContext {
  actor: Subject;
  /** Hash of the generated temp password (create) — never the password itself. */
  passwordHash: string;
  now: string;
  /** Addresses no store record may claim (the break-glass owner's). */
  reservedEmails: string[];
}

export interface CreateUserInput {
  email: string;
  name: string;
  roleIds: string[];
  sections?: string[];
  instructorId?: string;
  branchSlugs?: string[];
}

/** Allow-listed update fields. Anything else in the request body is ignored —
 *  never merged — so a stray `passwordHash` or `sessionVersion` cannot ride
 *  along with a legitimate rename. */
export interface UpdateUserInput {
  name?: string;
  roleIds?: string[];
  sections?: string[];
  instructorId?: string;
  branchSlugs?: string[];
}

function capabilitiesOf(subject: Subject): Set<Capability> {
  if (subject.breakGlass) return new Set(ROLES.flatMap((r) => r.capabilities));
  return new Set(subject.roleIds.flatMap((id) => roleById(id)?.capabilities ?? []));
}

/** You may not hand out a capability you do not hold. Without this, a
 *  `users.manage` holder could grant themselves — or a confederate — every
 *  other capability in one call. */
function mayGrant(actor: Subject, roleIds: string[]): boolean {
  const held = capabilitiesOf(actor);
  const isOwner = actor.breakGlass || actor.roleIds.includes('owner');

  for (const id of roleIds) {
    const role = roleById(id);
    if (!role) return false;
    if (id === 'owner' && !isOwner) return false;
    if (!role.capabilities.every((c) => held.has(c))) return false;
  }
  return true;
}

function activeOwners(users: User[]): User[] {
  return users.filter((u) => u.status === 'active' && u.roleIds.includes('owner'));
}

function attrsFrom(input: { sections?: string[]; instructorId?: string; branchSlugs?: string[] }) {
  return {
    ...(input.sections ? { sections: input.sections } : {}),
    ...(input.instructorId ? { instructorId: input.instructorId } : {}),
    ...(input.branchSlugs ? { branchSlugs: input.branchSlugs } : {}),
  };
}

export function createUser(
  users: User[],
  input: CreateUserInput,
  ctx: MutationContext,
): MutationResult {
  const email = input.email.trim().toLowerCase();
  if (!email) return { ok: false, error: 'An email address is required' };

  // The break-glass identity must be unforgeable from the store.
  if (ctx.reservedEmails.some((r) => r.trim().toLowerCase() === email)) {
    return { ok: false, error: 'That address belongs to the owner account configured in the environment' };
  }
  if (findByEmail(users, email)) return { ok: false, error: 'A user with that email already exists' };
  if (!mayGrant(ctx.actor, input.roleIds)) {
    return { ok: false, error: 'You cannot grant a role with capabilities you do not hold' };
  }

  const parsed = UserSchema.safeParse({
    // Server-generated, always. A client-supplied id is impersonation.
    id: crypto.randomUUID(),
    email,
    name: input.name.trim(),
    passwordHash: ctx.passwordHash,
    roleIds: input.roleIds,
    attrs: attrsFrom(input),
    status: 'active',
    mustChangePassword: true,
    sessionVersion: 0,
    createdAt: ctx.now,
    createdBy: ctx.actor.email,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid user' };

  return { ok: true, users: [...users, parsed.data], created: parsed.data };
}

export function updateUser(
  users: User[],
  id: string,
  input: UpdateUserInput,
  ctx: MutationContext,
): MutationResult {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return { ok: false, error: 'No such user' };
  const current = users[index];

  if (input.roleIds) {
    // Self-elevation is the shortest path from "can edit my profile" to owner.
    if (ctx.actor.id === id) return { ok: false, error: 'You cannot change your own roles' };
    if (!mayGrant(ctx.actor, input.roleIds)) {
      return { ok: false, error: 'You cannot grant a role with capabilities you do not hold' };
    }
    const losesOwner = current.roleIds.includes('owner') && !input.roleIds.includes('owner');
    // Count the owners who would REMAIN — a disabled sole owner holds no live
    // power and must stay demotable, or the store wedges.
    const otherActiveOwners = activeOwners(users).filter((u) => u.id !== id).length;
    if (losesOwner && current.status === 'active' && otherActiveOwners === 0) {
      return { ok: false, error: 'The last remaining owner cannot be demoted' };
    }
  }

  // Rebuilt from the STORED record, never merged from the request — so no
  // field outside the allow-list above can ride along.
  const nextRoles = input.roleIds ?? current.roleIds;
  const attrs =
    input.sections || input.instructorId || input.branchSlugs
      ? { ...current.attrs, ...attrsFrom(input) }
      : { ...current.attrs };
  // Attributes follow roles: a demoted editor must not keep dormant section
  // grants that a later role change would silently resurrect.
  if (!nextRoles.some((r) => roleById(r)?.sectionScoped)) delete attrs.sections;
  if (!nextRoles.includes('instructor')) delete attrs.instructorId;

  const next: User = {
    ...current,
    name: input.name?.trim() ?? current.name,
    roleIds: nextRoles,
    attrs,
  };

  const parsed = UserSchema.safeParse(next);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid user' };

  const copy = [...users];
  copy[index] = parsed.data;
  return { ok: true, users: copy };
}

export function setStatus(
  users: User[],
  id: string,
  status: 'active' | 'disabled',
  ctx: MutationContext,
): MutationResult {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return { ok: false, error: 'No such user' };
  const current = users[index];

  if (status === 'disabled') {
    if (ctx.actor.id === id) return { ok: false, error: 'You cannot disable your own account' };
    const otherActiveOwners = activeOwners(users).filter((u) => u.id !== id).length;
    if (current.roleIds.includes('owner') && current.status === 'active' && otherActiveOwners === 0) {
      return { ok: false, error: 'The last remaining owner cannot be disabled' };
    }
  }

  const copy = [...users];
  copy[index] = {
    ...current,
    status,
    // Without the bump the user keeps working for up to 14 days on the token
    // they already hold — "disabled" would mean "disabled eventually".
    sessionVersion: current.sessionVersion + 1,
  };
  return { ok: true, users: copy };
}

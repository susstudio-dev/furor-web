import { z } from 'zod';
import { ROLES } from './roles';

// The user store's shape. Pure Zod — no server imports — so it can be unit
// tested and reused by both the store reader and the mutation helpers.
//
// EVERY field that governs access carries a default. A record missing `status`
// or `sessionVersion` must read as active/0 from its own data, never resolve
// the value through the prototype chain.

const ROLE_IDS = ROLES.map((r) => r.id) as [string, ...string[]];

export const UserAttrsSchema = z
  .object({
    /** Links a user to the instructor record they may edit. */
    instructorId: z.string().optional(),
    branchSlugs: z.array(z.string()).optional(),
    styleSlugs: z.array(z.string()).optional(),
    /** Section keys for the section-scoped Editor role (see SECTION_PATHS). */
    sections: z.array(z.string()).optional(),
  })
  .default({});

export const UserSchema = z.object({
  /** Always server-generated. A client-supplied id is break-glass impersonation. */
  id: z.string().min(1),
  email: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  name: z.string().default(''),
  passwordHash: z.string().min(1),
  // An unknown role id is refused outright rather than silently ignored: a
  // typo must not quietly produce an account with no rules (or, worse, be
  // treated as a role that later exists.)
  roleIds: z.array(z.enum(ROLE_IDS)).default([]),
  attrs: UserAttrsSchema,
  status: z.enum(['active', 'disabled']).default('active'),
  mustChangePassword: z.boolean().default(false),
  /** Bumped on password change or suspension; invalidates outstanding tokens. */
  sessionVersion: z.number().int().nonnegative().default(0),
  createdAt: z.string().default(''),
  createdBy: z.string().default(''),
  lastLoginAt: z.string().default(''),
});

export const UserStoreSchema = z
  .object({
    users: z.array(UserSchema).default([]),
  })
  .default({ users: [] });

export type User = z.infer<typeof UserSchema>;
export type UserStore = z.infer<typeof UserStoreSchema>;

/** Case- and whitespace-insensitive lookup — the same normalisation the schema
 *  applies on write, so a stored address and a typed one always agree. */
export function findByEmail(users: User[], email: string): User | undefined {
  const wanted = email.trim().toLowerCase();
  return users.find((u) => u.email === wanted);
}

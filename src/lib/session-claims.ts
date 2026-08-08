import { z } from 'zod';

// The JWT payload, validated rather than cast.
//
// The previous code did `payload.role as Role`, an unchecked cast: a
// correctly-signed but malformed token (one minted by an older build, or with
// a claim removed) produced `undefined` and flowed on, so whether that failed
// open depended on how each downstream check happened to be written.
//
// `roles` here is a HINT for display and for cheap edge checks only. Every
// authorization decision reads the server-resolved subject instead, because a
// 14-day token cannot reflect a demotion that happened yesterday.
export const SessionClaimsSchema = z.object({
  uid: z.string().min(1),
  email: z.string().min(1),
  roles: z.array(z.string()).default([]),
  /** Session version at mint time; a bump in the store invalidates this token. */
  sv: z.number().int().nonnegative().default(0),
  /** The env-configured break-glass owner, resolved before any store lookup. */
  brk: z.boolean().default(false),
  /** Break-glass revocation lever: must match ADMIN_OWNER_TOKEN_EPOCH. */
  epoch: z.string().optional(),
});

export type SessionClaims = z.infer<typeof SessionClaimsSchema>;

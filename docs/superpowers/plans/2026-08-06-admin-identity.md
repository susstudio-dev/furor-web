# Admin Identity & Roles (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make real, revocable user accounts possible in production — so the authorization engine built in Plan 1 has actual subjects to authorize, and so every admin page enforces rather than decorates.

**Architecture:** A `users.json` document in R2 (filesystem in dev), written through the same compare-and-swap helpers as the content document. `resolveSubject()` — the seam Plan 1 deliberately left — swaps its body from "read the JWT's single role" to "look the user up in the store". The env-configured owner stays as an unforgeable break-glass account resolved *before* any store lookup, so a corrupt store or a bad policy can never lock everyone out. Authentication becomes a choke point in the admin layout; authorization becomes one explicit line per admin page.

**Tech Stack:** Next.js 15.5 App Router, React 19, Zod 3, `@opennextjs/cloudflare` 1.20 on Cloudflare Workers (free plan), R2. Tests: vitest.

**Spec:** [`docs/superpowers/specs/2026-08-02-admin-cms-abac-design.md`](../specs/2026-08-02-admin-cms-abac-design.md) §5.1, §5.2
**Predecessor:** [`2026-08-02-admin-foundation.md`](2026-08-02-admin-foundation.md) — merged, independently reviewed, 119 tests.

---

## Global Constraints

- **No new runtime dependencies.** vitest is dev-only.
- **PBKDF2 iterations stay at 50 000.** [hash-password.mjs:14-18](../../../scripts/hash-password.mjs#L14-L18) records why not workerd's 100 000 cap: at the cap a login brushes the 10 ms CPU limit and 500s. In-app hashing MUST use the same number and the same `pbkdf2$sha256$<iter>$<saltB64>$<hashB64>` format.
- **Workers free plan: 10 ms CPU per invocation.** Hash exactly once per login. Never hash on a page render.
- **Never accept a client-supplied user `id`, and never accept `email === ADMIN_OWNER_EMAIL`.** Both are break-glass impersonation.
- **Never merge a client object into a stored record.** Every endpoint takes an explicit allow-list of fields.
- **The JWT's `roles` claim is a hint, never a decision.** Every authorization decision reads the server-resolved subject.
- **Store unavailable ⇒ only break-glass resolves.** On Workers with a broken binding, reads fail *silently as empty* ([storage.ts:85-90](../../../src/lib/storage.ts#L85-L90)); "trust the token when the store is gone" would turn that into a fail-open.
- **Middleware stays authentication-only** (JWT signature/iss/aud). It runs on every `/admin/*` navigation; a store read there costs CPU and subrequests per navigation, and `getCloudflareContext()` throws in `next dev` because `initOpenNextCloudflareForDev()` is not called in next.config.mjs.
- Stage explicit paths; the working tree may contain unrelated in-progress work. Never `git add -A`.
- Commit after every task. Conventional-commit prefixes.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/password.ts` | PBKDF2 hash + verify + format parsing. Pure, WebCrypto only, unit-tested. |
| `src/lib/users-schema.ts` | Zod schema for the user store. Every optional field defaulted, so a missing key can never resolve through the prototype. |
| `src/lib/users.ts` | Store read/write (CAS), list/create/update/disable, invariant enforcement. |
| `src/lib/guard.ts` | `requireSubject()` / `requireCapability(cap)` for server components. |
| `src/app/api/admin/users/route.ts` | Create / update / disable, gated on `users.manage`. |
| `src/app/api/admin/me/route.ts` | Self-service: own name, own password. Allow-list only. |
| `src/app/admin/users/UsersEditor.tsx` | The Users screen. |
| `src/app/admin/change-password/page.tsx` | Forced first-login password change. |

**Modified:** `src/lib/auth.ts` (claims + store-backed credentials), `src/lib/subject.ts` (store lookup), `src/app/admin/layout.tsx` (authn choke point), `src/app/admin/users/page.tsx`, `src/app/api/admin/login/route.ts` (session version, lastLoginAt, mustChangePassword), the ~25 thin admin page shells (one guard line each), `DEPLOY.md` + `SECURITY.md`.

---

## Task 1: Password hashing as a pure module

**Files:** Create `src/lib/password.ts`, `src/lib/password.test.ts`

**Interfaces produced:** `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, stored: string): Promise<boolean>`, `PBKDF2_ITERATIONS`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { PBKDF2_ITERATIONS, hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('uses the iteration count the Workers CPU budget allows', () => {
    // NOT workerd's 100k cap: at the cap a login brushes the 10ms limit and 500s.
    expect(PBKDF2_ITERATIONS).toBe(50_000);
  });

  it('produces the stored format the env owner already uses', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^pbkdf2\$sha256\$50000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('round-trips a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it.each([
    '',
    'plaintext',
    'pbkdf2$sha256$50000$onlythreeparts',
    'pbkdf2$sha512$50000$c2FsdA==$aGFzaA==',
    'pbkdf2$sha256$999$c2FsdA==$aGFzaA==',
    'pbkdf2$sha256$500000$c2FsdA==$aGFzaA==',
  ])('refuses the malformed or out-of-range stored hash %j', async (stored) => {
    expect(await verifyPassword('anything', stored)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/lib/password.test.ts` → FAIL, cannot resolve `./password`.

- [ ] **Step 3: Implement**

Mirror the verification already in [auth.ts:68-97](../../../src/lib/auth.ts#L68-L97) exactly — same format, same clamps (1000..100000), same constant-time compare — and add the hashing half:

```ts
export const PBKDF2_ITERATIONS = 50_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await derive(plain, salt, PBKDF2_ITERATIONS, KEY_BYTES);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}
```

`derive()` wraps `crypto.subtle.importKey('raw', …, 'PBKDF2', false, ['deriveBits'])` +
`deriveBits({name:'PBKDF2', hash:'SHA-256', salt, iterations}, key, bytes*8)`.
`verifyPassword` parses the five `$`-separated parts, rejects a non-`sha256` digest or an
iteration count outside 1000..100000, derives with the stored salt/iterations, and compares with
the existing constant-time byte fold.

- [ ] **Step 4: Run, confirm green.** `npx vitest run src/lib/password.test.ts`
- [ ] **Step 5: Commit** — `git add src/lib/password.ts src/lib/password.test.ts && git commit -m "feat: PBKDF2 password hashing as a pure module"`

---

## Task 2: The user store

**Files:** Create `src/lib/users-schema.ts`, `src/lib/users.ts`, `src/lib/users-schema.test.ts`

**Interfaces produced:** `UserSchema`, `UserStoreSchema`, `type User`, `readUserStore()`, `writeUserStore(next, expected)`, `findByEmail(email)`

- [ ] **Step 1: Write the failing schema test**

```ts
import { describe, expect, it } from 'vitest';
import { UserSchema, UserStoreSchema } from './users-schema';

const minimal = {
  id: 'u_1',
  email: 'a@b.com',
  name: 'A',
  passwordHash: 'pbkdf2$sha256$50000$c2FsdA==$aGFzaA==',
};

describe('UserSchema', () => {
  // Every optional field is defaulted so no property is ever resolved through
  // the prototype — a record missing `status` must not inherit one.
  it('defaults every field that governs access', () => {
    const u = UserSchema.parse(minimal);
    expect(u.roleIds).toEqual([]);
    expect(u.status).toBe('active');
    expect(u.sessionVersion).toBe(0);
    expect(u.mustChangePassword).toBe(false);
    expect(u.attrs).toEqual({});
  });

  it('lowercases the email so lookups cannot be case-dodged', () => {
    expect(UserSchema.parse({ ...minimal, email: 'Mixed@Case.COM' }).email).toBe('mixed@case.com');
  });

  it('rejects an unknown role id', () => {
    expect(UserSchema.safeParse({ ...minimal, roleIds: ['superuser'] }).success).toBe(false);
  });

  it('rejects a status outside the known set', () => {
    expect(UserSchema.safeParse({ ...minimal, status: 'pending' }).success).toBe(false);
  });

  it('reads an empty store as an empty user list', () => {
    expect(UserStoreSchema.parse({}).users).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement the schema.** `roleIds: z.array(z.enum([...ROLES.map(r => r.id)])).default([])` built from `roles.ts` so a role that does not exist cannot be assigned. `attrs` mirrors `Subject['attrs']`, every member optional with defaults. `status: z.enum(['active','disabled']).default('active')`.
- [ ] **Step 4: Implement the store** in `users.ts` on top of `readDocWithVersion('users.json')` / `writeDocIfMatch`. Reads parse through `UserStoreSchema`; a parse failure returns `null` (store unavailable), never a partially-typed object.
- [ ] **Step 5: Run, confirm green. Commit.**

---

## Task 3: Session claims and credential verification

**Files:** Modify `src/lib/auth.ts`; create `src/lib/session-claims.test.ts`

- [ ] **Step 1: Write the failing test** for a Zod-validated JWT payload: `uid`, `email`, `roles: string[]`, `sv: number`, `brk: boolean`. Assert that a payload missing `uid` or with a non-array `roles` is REJECTED rather than cast — today `payload.role as Role` is an unchecked cast, so a malformed-but-signed token flows through with `undefined` and whether that fails open depends on how each check is written.
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement.** `createSessionToken(user)` mints the new claims. `getSession()` verifies the signature then parses the payload with Zod, returning `null` on mismatch. Break-glass tokens carry `brk: true` plus an epoch from `ADMIN_OWNER_TOKEN_EPOCH`, giving that account the revocation lever it otherwise lacks (it has no store record whose `sessionVersion` could be bumped).
- [ ] **Step 4: Extend `verifyCredentials`** to check the env owner FIRST (unchanged), then the store: look up by lowercased email, refuse `status === 'disabled'`, verify with `verifyPassword`.
- [ ] **Step 5: Run the whole suite, typecheck, commit.**

---

## Task 4: `resolveSubject()` reads the store

**Files:** Modify `src/lib/subject.ts`; create `src/lib/subject.test.ts`

- [ ] **Step 1: Write the failing test** covering, with a stubbed store reader:
  - a break-glass token resolves WITHOUT consulting the store (assert the reader was not called)
  - a store record resolves to its `roleIds` and `attrs`, ignoring the token's `roles` claim entirely — assert a token claiming `['owner']` against a stored `['editor']` record resolves to editor
  - `status: 'disabled'` resolves to `null`
  - a `sv` mismatch between token and record resolves to `null`
  - **store unavailable resolves ONLY break-glass; every other session is `null`**
- [ ] **Step 2: Run it, confirm it fails.**
- [ ] **Step 3: Implement**, with a short (5 s) per-isolate cache for page renders and a `{ fresh: true }` option that bypasses it. Mutating routes always pass `fresh`. A 5 s window bounds how long a demotion or suspension lags; a longer TTL is the difference between "revoked" and "revoked eventually".
- [ ] **Step 4: Run, typecheck, commit.**

---

## Task 5: Authentication choke point + guard helpers

**Files:** Create `src/lib/guard.ts`; modify `src/app/admin/layout.tsx`

- [ ] **Step 1: Implement `guard.ts`.**

```ts
/** Redirects unless a live subject exists. Returns it for the caller to use. */
export async function requireSubject(): Promise<Subject> { … redirect('/admin/login') … }

/** Redirects to /admin unless the subject holds `cap`. */
export async function requireCapability(cap: Capability): Promise<Subject> { … }

/** Redirects unless the subject may write at least one of `paths`. */
export async function requireWriteAccess(...paths: string[]): Promise<Subject> { … }
```

- [ ] **Step 2: Make the admin layout enforce.** It currently reads the session and then renders children anyway ([admin/layout.tsx:56-60](../../../src/app/admin/layout.tsx#L56-L60)) — with a comment saying so. It must redirect when the subject is absent, disabled or session-version-stale, EXCEPT on `/admin/login` and `/admin/change-password`.
- [ ] **Step 3: Filter the nav by write access**, not by an `ownerOnly` boolean — a section-scoped account should see a short, honest menu.
- [ ] **Step 4: Verify manually in dev**, then commit.

---

## Task 6: Guard every admin page

**Files:** the ~25 thin server shells under `src/app/admin/**/page.tsx`

- [ ] **Step 1: Enumerate them.** `grep -rL "requireSubject\|requireCapability\|requireWriteAccess" src/app/admin --include=page.tsx`
- [ ] **Step 2: Add exactly one line to each**, matching the section it edits — e.g. `/admin/batches` → `await requireWriteAccess('batches')`, `/admin/audit` → `await requireCapability('users.manage')`. Adding a helper does not retrofit anything; each page must be edited.
- [ ] **Step 3: Assert the sweep is complete** with a test that walks `src/app/admin/**/page.tsx` and fails on any file (other than `login` and `change-password`) with no guard call. This is the only thing that stops the next new page from silently shipping unguarded.
- [ ] **Step 4: Run, build, commit.**

---

## Task 7: User management API

**Files:** Create `src/app/api/admin/users/route.ts`; create `src/lib/users-mutations.test.ts`

- [ ] **Step 1: Write the failing tests** for the pure mutation helpers:
  - creating a user generates the id **server-side** (a client-supplied `id` is ignored, not honoured)
  - creating with `email === ADMIN_OWNER_EMAIL` is refused — otherwise a `users.manage` holder mints an account that resolves to the undeletable break-glass identity
  - granting a role the actor does not themselves hold is refused (no privilege amplification)
  - the last remaining owner cannot be disabled or demoted
  - a user cannot change their own `roleIds`
- [ ] **Step 2: Run, confirm failing.**
- [ ] **Step 3: Implement** the helpers, then the route: `requireCapability('users.manage')` + `sameOrigin` + size guard + CAS write of the store. The temp password is generated server-side, returned **once** in the response, and stored only as a hash.
- [ ] **Step 4: Run, typecheck, commit.**

---

## Task 8: Self-service `/api/admin/me`

**Files:** Create `src/app/api/admin/me/route.ts`, `src/app/admin/change-password/page.tsx`

- [ ] **Step 1: Write the failing test** proving the allow-list: a body carrying `roleIds`, `attrs`, `status`, `sessionVersion`, `id` or `email` alongside a legitimate password change must leave every one of those fields untouched. A newly invited user is forced through this endpoint before holding any capability, so "am I this user?" is its only authorization — mass assignment here is a straight path to owner.
- [ ] **Step 2: Run, confirm failing.**
- [ ] **Step 3: Implement.** Accepts exactly `{ currentPassword, newPassword }` and `{ name }`. Reconstructs the record server-side from the loaded one. A successful password change bumps `sessionVersion`, invalidating that user's other sessions.
- [ ] **Step 4: Wire the forced change** — `mustChangePassword` redirects every admin route to `/admin/change-password` until cleared.
- [ ] **Step 5: Run, build, commit.**

---

## Task 9: The Users screen

**Files:** Rewrite `src/app/admin/users/page.tsx`; create `src/app/admin/users/UsersEditor.tsx`

- [ ] **Step 1: Implement the screen** — list users with role, sections, status, last login; invite (email + name + role + sections, temp password shown once with a copy button); change role/sections; disable/enable. Section keys come from `SECTION_PATHS`, never raw globs.
- [ ] **Step 2: Replace the stale copy** at [users/page.tsx:24-26](../../../src/app/admin/users/page.tsx#L24-L26), which tells the reader invites are "on the v1.1 backlog" and to hand-edit `data/users.json`.
- [ ] **Step 3: Verify in dev**: invite a user, log in as them, confirm the forced password change, confirm a section they lack is refused with the path named.
- [ ] **Step 4: Commit.**

---

## Task 10: Documentation and the stale user-file path

**Files:** `DEPLOY.md`, `SECURITY.md`, `README.md`, `src/lib/auth.ts`

- [ ] **Step 1: Delete the dead file-based user path.** `ensureSeedOwner()` / `inviteEditor()` / the fs `readUsers` in [auth.ts:113-148](../../../src/lib/auth.ts#L113-L148) are unreachable: `verifyCredentials` returns early for the env owner and never reaches them, which is why `data/users.json` is never created. Replace with the store.
- [ ] **Step 2: Correct the docs.** README claims a `data/users.json` flow that does not happen; DEPLOY.md documents password rotation as `wrangler secret put` + redeploy; SECURITY.md's session model predates `sessionVersion`. State the real model: break-glass owner in env, everyone else in the store, revocation via `sessionVersion` within the 5 s subject-cache window.
- [ ] **Step 3: Document the residual gaps** honestly: read access is all-or-nothing for any admin session, and the break-glass owner bypasses policy including the id-immutability deny.
- [ ] **Step 4: Full verification** — `npm test`, `npm run typecheck`, `npm run build` — then commit.

---

## Self-Review

**Spec coverage:** §5.1 identity (Tasks 1, 2, 3, 7, 8), break-glass (3, 4, 7), store-unavailable behaviour (4), §5.2 roles + enforcement (5, 6), Users screen (9), docs (10).

**Deferred by design:** drafts/approval/preview and `useEditor` (Plan 3); media, blocks, scheduling, theming, campaigns (Plan 4). Read-side scoping stays out of scope and is documented as such.

**Naming consistency:** `resolveSubject`, `requireSubject`, `requireCapability`, `requireWriteAccess`, `hashPassword`, `verifyPassword`, `readUserStore`, `writeUserStore` are used identically throughout.

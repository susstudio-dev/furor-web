import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { isRemoteStorage } from './storage';

// In production (Cloudflare Workers / no writable disk) the owner account is
// defined by environment secrets — we never persist password hashes remotely.
// Supported credential formats, in order of preference:
//   1. ADMIN_OWNER_PASSWORD_HASH = pbkdf2$sha256$<iter>$<saltB64>$<hashB64>
//      (generate with `npm run hash-password`; verified via WebCrypto — fits
//      the Workers free plan's 10 ms CPU budget, unlike bcrypt)
//   2. ADMIN_OWNER_PASSWORD_HASH = bcrypt "$2..." (works in dev/Node; too
//      CPU-heavy for the Workers free plan — do not use there)
//   3. ADMIN_OWNER_INITIAL_PASSWORD = plaintext (compared timing-safely via
//      SHA-256 digests; acceptable because the reference value itself lives
//      in the same secret store an attacker would have to compromise anyway)
// Read at call time, never module scope: on Cloudflare Workers the OpenNext
// shim copies the Worker env into process.env only once the first request
// arrives, so a module-scope capture can permanently see '' depending on
// bundle import order. Trimmed because pasting a secret into the dashboard
// or piping it into `wrangler secret put` easily smuggles in a trailing
// newline — which would 401 every login with no diagnostic anywhere.
function envOwnerEmail(): string {
  return (process.env.ADMIN_OWNER_EMAIL || '').trim().toLowerCase();
}

const COOKIE_NAME = 'furor_admin';
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_PBKDF2_ITER = 100_000; // workerd's PBKDF2 cap

// Fail closed: production must never fall back to the well-known dev secret,
// which would make admin session tokens forgeable.
function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is not configured (needs 32+ chars; set it with `wrangler secret put JWT_SECRET`).',
    );
  }
  return new TextEncoder().encode('dev-only-secret-change-me-in-production-32b');
}

export type Role = 'owner' | 'editor';
export interface User {
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}
interface UsersFile {
  users: User[];
}

// ---- constant-time comparison helpers (WebCrypto, workerd-safe) ------------

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Compare two secrets without leaking match position via timing: hash both,
// compare digests with a constant-time fold.
async function timingSafeStringEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return equalBytes(new Uint8Array(da), new Uint8Array(db));
}

async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$'); // pbkdf2 $ sha256 $ iter $ salt $ hash
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > MAX_PBKDF2_ITER) {
    return false;
  }
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = new Uint8Array(Buffer.from(parts[3], 'base64'));
    expected = new Uint8Array(Buffer.from(parts[4], 'base64'));
  } catch {
    return false;
  }
  if (expected.length < 16) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    expected.length * 8,
  );
  return equalBytes(new Uint8Array(bits), expected);
}

async function verifyAgainstStoredHash(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('pbkdf2$')) return verifyPbkdf2(password, hash);
  if (hash.startsWith('$2')) {
    // bcrypt — dev/Node only (exceeds the Workers free plan CPU budget).
    const bcrypt = (await import('bcryptjs')).default;
    return bcrypt.compare(password, hash);
  }
  return false;
}

// ---- file-based users (dev convenience only) -------------------------------
// fs is imported lazily so this module loads cleanly on workerd, where these
// code paths are never taken (prod owner is env-based).

async function readUsers(): Promise<UsersFile> {
  const { promises: fs } = await import('fs');
  const path = await import('path');
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'users.json'), 'utf8');
    return JSON.parse(raw);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return { users: [] };
    throw err;
  }
}

async function writeUsers(file: UsersFile): Promise<void> {
  const { promises: fs } = await import('fs');
  const path = await import('path');
  const usersPath = path.join(process.cwd(), 'data', 'users.json');
  await fs.mkdir(path.dirname(usersPath), { recursive: true });
  await fs.writeFile(usersPath, JSON.stringify(file, null, 2), 'utf8');
}

export async function ensureSeedOwner(): Promise<void> {
  if (await isRemoteStorage()) return; // prod owner is env-based; no file to seed
  const email = process.env.ADMIN_OWNER_EMAIL;
  const pw = process.env.ADMIN_OWNER_INITIAL_PASSWORD;
  if (!email || !pw) return;
  const file = await readUsers();
  if (file.users.some((u) => u.role === 'owner')) return;
  const bcrypt = (await import('bcryptjs')).default;
  file.users.push({
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(pw, 10),
    role: 'owner',
    createdAt: new Date().toISOString(),
  });
  await writeUsers(file);
}

// In-memory rate limit. On Workers this is per-isolate (each PoP/isolate has
// its own window) — weaker than a shared store, but combined with the KDF it
// is proportionate for a single-admin site on the free plan.
const attempts = new Map<string, number[]>();
export function recordAttempt(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = (attempts.get(ip) || []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  arr.push(now);
  attempts.set(ip, arr);
  if (arr.length > MAX_ATTEMPTS) {
    const earliest = arr[0];
    const retryAfter = Math.ceil((ATTEMPT_WINDOW_MS - (now - earliest)) / 1000);
    return { allowed: false, retryAfterSec: retryAfter };
  }
  return { allowed: true, retryAfterSec: 0 };
}
export function clearAttempts(ip: string) {
  attempts.delete(ip);
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  // Trim the typed email too — mobile keyboards append a space on
  // autocomplete. (The password is NOT trimmed: whitespace there is legal.)
  const lower = email.trim().toLowerCase();

  // Env-based owner is the primary path — works in prod and dev alike.
  const ownerEmail = envOwnerEmail();
  if (ownerEmail && lower === ownerEmail) {
    const hash = (process.env.ADMIN_OWNER_PASSWORD_HASH || '').trim();
    if (hash) {
      const ok = await verifyAgainstStoredHash(password, hash);
      return ok ? { email: ownerEmail, passwordHash: '', role: 'owner', createdAt: '' } : null;
    }
    const plain = (process.env.ADMIN_OWNER_INITIAL_PASSWORD || '').trim();
    if (plain) {
      const ok = await timingSafeStringEqual(password, plain);
      return ok ? { email: ownerEmail, passwordHash: '', role: 'owner', createdAt: '' } : null;
    }
    return null;
  }

  // File-based users (dev convenience / invited editors). Any storage error
  // must yield 401, never a 500.
  try {
    await ensureSeedOwner();
    const { users } = await readUsers();
    const user = users.find((u) => u.email === lower);
    if (!user) return null;
    const ok = await verifyAgainstStoredHash(password, user.passwordHash);
    return ok ? user : null;
  } catch {
    return null;
  }
}

export const JWT_ISSUER = 'furor-web';
export const JWT_AUDIENCE = 'furor-admin';

export async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime('14d')
    .sign(getJwtSecret());
}

export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getSession(): Promise<{ email: string; role: Role } | null> {
  try {
    const c = await cookies();
    const token = c.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return { email: String(payload.email), role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function listUsers(): Promise<User[]> {
  if (await isRemoteStorage()) {
    const ownerEmail = envOwnerEmail();
    return ownerEmail
      ? [{ email: ownerEmail, passwordHash: '', role: 'owner', createdAt: '' }]
      : [];
  }
  const { users } = await readUsers();
  return users;
}

export async function inviteEditor(email: string, password: string): Promise<void> {
  if (await isRemoteStorage()) {
    throw new Error('In production the owner is managed via environment secrets.');
  }
  const file = await readUsers();
  const lower = email.toLowerCase();
  if (file.users.some((u) => u.email === lower)) throw new Error('User already exists');
  const bcrypt = (await import('bcryptjs')).default;
  file.users.push({
    email: lower,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'editor',
    createdAt: new Date().toISOString(),
  });
  await writeUsers(file);
}

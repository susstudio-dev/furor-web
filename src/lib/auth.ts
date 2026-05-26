import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { isProdStorage } from './storage';

// In production (Vercel Blob / read-only FS) the owner account is defined by
// environment variables — we never persist password hashes to a public blob.
// `ADMIN_OWNER_PASSWORD_HASH` (a bcrypt hash) is preferred; otherwise the
// plaintext `ADMIN_OWNER_INITIAL_PASSWORD` is accepted and hashed in-memory.
const ENV_OWNER_EMAIL = (process.env.ADMIN_OWNER_EMAIL || '').toLowerCase();
let envOwnerHash: string | null = null;
function getEnvOwnerHash(): string | null {
  if (envOwnerHash) return envOwnerHash;
  const h = process.env.ADMIN_OWNER_PASSWORD_HASH;
  if (h) {
    envOwnerHash = h;
    return h;
  }
  const pw = process.env.ADMIN_OWNER_INITIAL_PASSWORD;
  if (pw) {
    envOwnerHash = bcrypt.hashSync(pw, 10);
    return envOwnerHash;
  }
  return null;
}

const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');
const COOKIE_NAME = 'furor_admin';
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-only-secret-change-me-in-production-32b',
);
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

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

async function readUsers(): Promise<UsersFile> {
  try {
    const raw = await fs.readFile(USERS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return { users: [] };
    throw err;
  }
}

async function writeUsers(file: UsersFile): Promise<void> {
  await fs.mkdir(path.dirname(USERS_PATH), { recursive: true });
  await fs.writeFile(USERS_PATH, JSON.stringify(file, null, 2), 'utf8');
}

export async function ensureSeedOwner(): Promise<void> {
  if (isProdStorage) return; // prod owner is env-based; no file to seed
  const email = process.env.ADMIN_OWNER_EMAIL;
  const pw = process.env.ADMIN_OWNER_INITIAL_PASSWORD;
  if (!email || !pw) return;
  const file = await readUsers();
  if (file.users.some((u) => u.role === 'owner')) return;
  file.users.push({
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(pw, 10),
    role: 'owner',
    createdAt: new Date().toISOString(),
  });
  await writeUsers(file);
}

// In-memory rate limit (acceptable for single-instance dev / single-region prod)
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
  const lower = email.toLowerCase();

  // Env-based owner is the primary path — works in prod whether or not the
  // Blob store is connected, and in dev. NOT gated on isProdStorage, because
  // gating it there meant a deploy without the Blob token fell through to the
  // filesystem path and 500'd writing users.json on Vercel's read-only FS.
  const envHash = getEnvOwnerHash();
  if (ENV_OWNER_EMAIL && envHash && lower === ENV_OWNER_EMAIL) {
    const ok = await bcrypt.compare(password, envHash);
    return ok
      ? { email: ENV_OWNER_EMAIL, passwordHash: '', role: 'owner', createdAt: '' }
      : null;
  }

  // File-based users (dev convenience / invited editors). A read-only FS or
  // any storage error must yield 401, never a 500.
  try {
    await ensureSeedOwner();
    const { users } = await readUsers();
    const user = users.find((u) => u.email === lower);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  } catch {
    return null;
  }
}

export async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(SECRET);
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
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { email: String(payload.email), role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function listUsers(): Promise<User[]> {
  if (isProdStorage) {
    return ENV_OWNER_EMAIL
      ? [{ email: ENV_OWNER_EMAIL, passwordHash: '', role: 'owner', createdAt: '' }]
      : [];
  }
  const { users } = await readUsers();
  return users;
}

export async function inviteEditor(email: string, password: string): Promise<void> {
  if (isProdStorage) {
    throw new Error('In production the owner is managed via environment variables.');
  }
  const file = await readUsers();
  const lower = email.toLowerCase();
  if (file.users.some((u) => u.email === lower)) throw new Error('User already exists');
  file.users.push({
    email: lower,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'editor',
    createdAt: new Date().toISOString(),
  });
  await writeUsers(file);
}

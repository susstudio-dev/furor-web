import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

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
  await ensureSeedOwner();
  const { users } = await readUsers();
  const user = users.find((u) => u.email === email.toLowerCase());
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
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
  const { users } = await readUsers();
  return users;
}

export async function inviteEditor(email: string, password: string): Promise<void> {
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

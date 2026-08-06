import 'server-only';
import {
  readDocWithVersion,
  storageMisconfigured,
  writeDocIfMatch,
  writeText,
  type DocVersion,
} from './storage';
import { UserStoreSchema, type User } from './users-schema';

// The user store lives beside the content document in the same private R2
// bucket (filesystem `data/` in dev). It is never web-reachable: the only
// route that serves bucket bytes forces an `uploads/` key prefix
// (storage.ts writeBinary/readBinary), and the bucket has no public
// r2.dev subdomain (see DEPLOY.md).

export const USERS_KEY = 'users.json';

export interface UserStoreState {
  users: User[];
  /** null when the document does not exist yet (no users invited). */
  version: DocVersion | null;
}

/**
 * Reads the store.
 *
 * Returns `null` for "the store could not be read" — a throwing read or bytes
 * that do not parse. That is deliberately distinct from an ABSENT document,
 * which is a legitimate empty store and returns `{ users: [], version: null }`.
 *
 * The distinction matters because on Workers with a broken R2 binding reads
 * fail SILENTLY AS EMPTY (storage.ts:85-90). If "unreadable" and "empty" were
 * the same value, a misconfigured binding would look like "no users exist yet"
 * and the caller could not tell that it must fall back to break-glass only.
 */
export async function readUserStore(): Promise<UserStoreState | null> {
  let doc: Awaited<ReturnType<typeof readDocWithVersion>>;
  try {
    doc = await readDocWithVersion(USERS_KEY);
  } catch {
    return null;
  }
  if (doc == null) {
    // Absent document ≠ broken store. On Workers with the binding missing the
    // read falls through to a filesystem that cannot exist there and comes
    // back null — reporting that as "no users invited yet" would show the
    // owner an empty roster during exactly the incident this distinction was
    // written for.
    return (await storageMisconfigured()) ? null : { users: [], version: null };
  }

  try {
    const parsed = UserStoreSchema.parse(JSON.parse(doc.text));
    return { users: parsed.users, version: doc.version };
  } catch {
    // Corrupt or schema-violating store. Refusing to guess is the point: a
    // partially-parsed roster would hand out roles nobody granted.
    return null;
  }
}

/**
 * Writes the store with compare-and-swap. Returns the new version, or `null`
 * when someone else wrote first (the caller re-reads and retries).
 *
 * `expected: null` creates the document. That path has an unavoidable
 * first-write race; it happens once, when the first user is invited.
 */
export async function writeUserStore(
  users: User[],
  expected: DocVersion | null,
): Promise<DocVersion | null> {
  const text = JSON.stringify({ users }, null, 2);
  if (expected == null) {
    await writeText(USERS_KEY, text);
    const created = await readDocWithVersion(USERS_KEY);
    return created?.version ?? null;
  }
  return writeDocIfMatch(USERS_KEY, text, expected);
}

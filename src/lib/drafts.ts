import 'server-only';
import { deleteKey, listKeys, readText, writeText } from './storage';
import { DraftSchema, type Draft } from './drafts-core';

// Draft persistence. Ids are server-generated UUIDs and validated on the way
// back in — a client-influenced id would be a path component, and in dev the
// filesystem backend resolves keys with path.join.

const PREFIX = 'drafts/';
const ID_RE = /^[a-zA-Z0-9-]+$/;

export function newDraftId(): string {
  return crypto.randomUUID();
}

export async function readDraft(id: string): Promise<Draft | null> {
  if (!ID_RE.test(id)) return null;
  const raw = await readText(`${PREFIX}${id}.json`);
  if (raw == null) return null;
  try {
    return DraftSchema.parse(JSON.parse(raw));
  } catch {
    // A corrupt draft is unreviewable, not a crash.
    return null;
  }
}

export async function writeDraft(draft: Draft): Promise<void> {
  if (!ID_RE.test(draft.id)) throw new Error('Invalid draft id');
  await writeText(`${PREFIX}${draft.id}.json`, JSON.stringify(draft, null, 2));
}

export async function deleteDraft(id: string): Promise<void> {
  if (!ID_RE.test(id)) return;
  await deleteKey(`${PREFIX}${id}.json`);
}

/** Every stored draft, newest first. The volume is a handful of staff's
 *  pending edits — no pagination needed at this scale. */
export async function listDrafts(): Promise<Draft[]> {
  const keys = await listKeys(PREFIX);
  const out: Draft[] = [];
  for (const k of keys) {
    const id = k.key.slice(PREFIX.length).replace(/\.json$/, '');
    const draft = await readDraft(id);
    if (draft) out.push(draft);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

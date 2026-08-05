import 'server-only';
import { readDocWithVersion, readJSON, writeDocIfMatch, writeText } from './storage';

// Two separate capped logs: pre-auth events (login_failed) carry
// attacker-controlled actors and could otherwise be flooded to evict the
// genuine admin-action history from a single shared log.
const AUDIT_KEY = 'audit.json';
const AUTH_AUDIT_KEY = 'audit-auth.json';
const CAP = 500;

const PRE_AUTH_ACTIONS = new Set(['login_failed']);

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
  detail?: string;
}

// Audit is best-effort: it must NEVER throw and break the action it records
// (login, save, etc.). A storage hiccup just drops the entry.
//
// The append is compare-and-swap with one retry. Read-modify-write without it
// silently drops entries under exactly the concurrency the audit log exists to
// explain — and it does so invisibly, because the whole body is swallowed.
export async function audit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  const key = PRE_AUTH_ACTIONS.has(entry.action) ? AUTH_AUDIT_KEY : AUDIT_KEY;
  const row: AuditEntry = {
    ts: new Date().toISOString(),
    ...entry,
    actor: entry.actor.slice(0, 64),
    detail: entry.detail?.slice(0, 256),
  };

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await readDocWithVersion(key);
      const log: AuditEntry[] = current ? (JSON.parse(current.text) as AuditEntry[]) : [];
      log.push(row);
      if (log.length > CAP) log.splice(0, log.length - CAP);

      const text = JSON.stringify(log, null, 2);
      if (!current) {
        // First ever entry: there is no version to swap against.
        await writeText(key, text);
        return;
      }
      const written = await writeDocIfMatch(key, text, current.version);
      if (written !== null) return;
    }
    // Both attempts lost the race. Surface it rather than dropping it silently
    // — wrangler observability is the only place this becomes visible.
    console.error('audit: lost the write race twice, entry dropped', row.action, row.actor);
  } catch (err) {
    // An authorization denial that goes unrecorded is the one case where a
    // silent drop is genuinely misleading, so it is always logged.
    if (row.action === 'authz_denied') {
      console.error('audit: failed to record an authorization denial', row.actor, row.detail, err);
    }
  }
}

export async function readAudit(limit = 100): Promise<AuditEntry[]> {
  try {
    const [admin, auth] = await Promise.all([
      readJSON<AuditEntry[]>(AUDIT_KEY),
      readJSON<AuditEntry[]>(AUTH_AUDIT_KEY),
    ]);
    return [...(admin ?? []), ...(auth ?? [])]
      .sort((a, b) => (a.ts < b.ts ? -1 : 1))
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}

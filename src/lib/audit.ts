import 'server-only';
import { readJSON, writeJSON } from './storage';

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
export async function audit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  try {
    const key = PRE_AUTH_ACTIONS.has(entry.action) ? AUTH_AUDIT_KEY : AUDIT_KEY;
    const log = (await readJSON<AuditEntry[]>(key)) ?? [];
    log.push({
      ts: new Date().toISOString(),
      ...entry,
      actor: entry.actor.slice(0, 64),
      detail: entry.detail?.slice(0, 256),
    });
    if (log.length > CAP) log.splice(0, log.length - CAP);
    await writeJSON(key, log);
  } catch {
    /* swallow — auditing must not break the request */
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

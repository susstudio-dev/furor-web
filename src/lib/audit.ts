import 'server-only';
import { readJSON, writeJSON } from './storage';

const AUDIT_KEY = 'audit.json';
const CAP = 500; // keep the most recent N entries

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
  detail?: string;
}

// Audit is best-effort: it must NEVER throw and break the action it records
// (login, save, etc.). A read-only FS or Blob hiccup just drops the entry.
export async function audit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  try {
    const log = (await readJSON<AuditEntry[]>(AUDIT_KEY)) ?? [];
    log.push({ ts: new Date().toISOString(), ...entry });
    if (log.length > CAP) log.splice(0, log.length - CAP);
    await writeJSON(AUDIT_KEY, log);
  } catch {
    /* swallow — auditing must not break the request */
  }
}

export async function readAudit(limit = 100): Promise<AuditEntry[]> {
  try {
    const log = (await readJSON<AuditEntry[]>(AUDIT_KEY)) ?? [];
    return log.slice(-limit).reverse();
  } catch {
    return [];
  }
}

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

export async function audit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  const log = (await readJSON<AuditEntry[]>(AUDIT_KEY)) ?? [];
  log.push({ ts: new Date().toISOString(), ...entry });
  if (log.length > CAP) log.splice(0, log.length - CAP);
  await writeJSON(AUDIT_KEY, log);
}

export async function readAudit(limit = 100): Promise<AuditEntry[]> {
  const log = (await readJSON<AuditEntry[]>(AUDIT_KEY)) ?? [];
  return log.slice(-limit).reverse();
}

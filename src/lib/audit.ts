import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'data', 'audit.log');

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
  detail?: string;
}

export async function audit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
  await fs.appendFile(LOG_PATH, line, 'utf8');
}

export async function readAudit(limit = 100): Promise<AuditEntry[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((l) => JSON.parse(l) as AuditEntry);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw err;
  }
}

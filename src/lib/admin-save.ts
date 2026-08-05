interface Issue {
  path: (string | number)[];
  message: string;
}

export class SaveConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveConflictError';
  }
}

// The version token the page was rendered from. The admin layout emits it as a
// meta tag rather than threading a prop through every editor, and it comes from
// the same cached read as the content itself — a fresher token paired with
// older content is exactly the shape of a silent clobber.
function baseVersion(): string | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('meta[name="furor-content-version"]')?.getAttribute('content') ?? null;
}

export async function saveSiteContent(payload: unknown): Promise<void> {
  const res = await fetch('/api/admin/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baseVersion: baseVersion(), document: payload }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    issues?: Issue[];
    denied?: { path: string; reason: string }[];
    version?: string;
  };
  if (res.ok) {
    // Keep the page's token current so a second save from the same page does
    // not report a conflict against its own write.
    const meta = document.querySelector('meta[name="furor-content-version"]');
    if (meta && j.version) meta.setAttribute('content', j.version);
    return;
  }

  if (res.status === 409) {
    throw new SaveConflictError(j.error || 'Someone else saved while you were editing.');
  }

  if (res.status === 403 && j.denied?.length) {
    const where = j.denied.slice(0, 3).map((d) => d.path).join(', ');
    const extra = j.denied.length > 3 ? ` (+${j.denied.length - 3} more)` : '';
    throw new Error(`You don't have permission to change ${where}${extra}`);
  }

  if (j.issues?.length) {
    const summary = j.issues
      .slice(0, 4)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join(' · ');
    const extra = j.issues.length > 4 ? ` (+${j.issues.length - 4} more)` : '';
    throw new Error(`${j.error || 'Validation failed'} — ${summary}${extra}`);
  }
  throw new Error(j.error || 'Save failed');
}

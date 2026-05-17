interface ZodIssue {
  path: (string | number)[];
  message: string;
}

export async function saveSiteContent(payload: unknown): Promise<void> {
  const res = await fetch('/api/admin/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    issues?: ZodIssue[];
  };
  if (res.ok) return;

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

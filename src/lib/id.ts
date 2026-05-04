export function randomId(prefix: string): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${r}`;
}

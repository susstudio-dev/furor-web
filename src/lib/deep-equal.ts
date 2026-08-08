// Key-order-insensitive structural equality.
//
// A client that re-serialises a record with its keys in a different order has
// not changed anything, and treating that as a change would demand
// authorization for records the user never touched.
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ka = Object.keys(ao);
  if (ka.length !== Object.keys(bo).length) return false;
  return ka.every((k) => Object.hasOwn(bo, k) && deepEqual(ao[k], bo[k]));
}

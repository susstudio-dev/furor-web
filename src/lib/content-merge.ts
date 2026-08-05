// Deep merge: saved values win, seed fills in anything missing. Arrays are
// taken whole from saved (we never splice seed items in behind the admin's
// back) — only missing object keys fall back to seed. This protects against
// schema additions making old saves render blank.
//
// Extracted from content.ts so it can be unit-tested: content.ts imports
// `server-only`, which throws outside a server bundle.

// Keys that must come ONLY from the saved document, never from the seed.
// `npm run sync-seed` copies a developer's live local content into the seed,
// so seeding these would publish someone's laptop promos or theme the moment
// an owner restores a snapshot that predates the feature.
const NEVER_SEED = new Set(['campaigns', 'theme']);

export function mergeWithSeed(saved: unknown, seed: unknown, depth = 0): unknown {
  if (Array.isArray(saved)) return saved;
  if (
    saved === null ||
    saved === undefined ||
    typeof saved !== 'object' ||
    typeof seed !== 'object' ||
    seed === null
  ) {
    return saved ?? seed;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(seed as Record<string, unknown>)) {
    // NEVER_SEED applies at the top level only — a nested key that happens to
    // share the name is unrelated.
    if (depth === 0 && NEVER_SEED.has(k)) continue;
    out[k] = v;
  }

  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    // JSON.parse yields __proto__ as an OWN key; assigning it here would
    // pollute Object.prototype for the whole isolate. This runs BEFORE zod
    // validation, so the schema's unknown-key stripping can't protect it.
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = mergeWithSeed(v, (seed as Record<string, unknown>)[k], depth + 1);
  }
  return out;
}

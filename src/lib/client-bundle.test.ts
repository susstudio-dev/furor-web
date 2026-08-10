import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the invariant that regressed once mid-branch and was caught only by
// a manual build inspection (typecheck and the full test suite both stayed
// green): no public 'use client' component may transitively VALUE-import
// `zod` or `@/lib/content-schema`. That chain adds ~13KB gz to every route
// because zod (and the 700+ line schema built on it) rides along in the
// client bundle even though nothing at runtime ever needs it there — see the
// comment above `LABEL_DEFAULT_LITERALS` in label-defaults.ts for the exact
// incident this replays.
//
// `import type { X }` and inline `import { type X }` specifiers are erased
// by the TypeScript compiler and never reach the emitted JS, so they are not
// value imports and must not be treated as graph edges here.
//
// Deliberately hand-rolled with node:fs/node:path only — no new dependency,
// no TS compiler API, no AST library. This is a lightweight, self-contained
// safety net, not a full bundler; see resolveModule/extractValueImportSpecifiers
// below for exactly what it does and does not understand.

const SRC_DIR = path.resolve(__dirname, '..');
const ADMIN_DIR = path.join(SRC_DIR, 'app', 'admin') + path.sep;
const CONTENT_SCHEMA_PATH = path.join(SRC_DIR, 'lib', 'content-schema.ts');

// ── File discovery ──────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// The directive must be the first statement in the file (optionally preceded
// by comments/blank lines) per Next.js's own rule — matching that rule here
// means this stays in sync with what Next.js actually treats as a client
// entry, rather than a looser "mentions 'use client' somewhere" heuristic.
const USE_CLIENT_RE = /^(\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/|\s*\n)*\s*['"]use client['"]/;

function isPublicClientRoot(file: string): boolean {
  if (file.startsWith(ADMIN_DIR)) return false;
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) return false;
  const content = fs.readFileSync(file, 'utf8');
  return USE_CLIENT_RE.test(content);
}

// ── Comment/string-aware stripping ──────────────────────────────────────────
// Strips // and /* */ comments while preserving string/template contents
// (which is where module specifiers live) and newline positions (so a
// stripped comment can't accidentally splice two statements together).

function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      out += ' '.repeat(j - i);
      i = j;
      continue;
    }
    if (c === '/' && c2 === '*') {
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
      j = Math.min(j + 2, n);
      for (let k = i; k < j; k++) out += src[k] === '\n' ? '\n' : ' ';
      i = j;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, n);
      out += src.slice(i, j);
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// ── Import extraction ───────────────────────────────────────────────────────

// Whether an import/export clause (the part between `import`/`export` and
// `from`) carries at least one binding that is NOT erased at compile time.
// `import type X from 'm'` and whole-statement `export type * from 'm'` are
// filtered by the caller before this runs (via the leading `type` keyword);
// this only has to resolve the mixed case: a default/namespace binding, or a
// `{ ... }` list where individual members may each be prefixed `type `.
function clauseHasValueBinding(clause: string): boolean {
  const braceIdx = clause.indexOf('{');
  const outside = (braceIdx === -1 ? clause : clause.slice(0, braceIdx))
    .trim()
    .replace(/,$/, '')
    .trim();
  if (outside) return true; // default import/export or `*`/`* as ns`
  if (braceIdx === -1) return clause.trim().length > 0;
  const closeIdx = clause.lastIndexOf('}');
  const inner = clause.slice(braceIdx + 1, closeIdx === -1 ? undefined : closeIdx);
  const items = inner
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return false; // `{}` — nothing bound
  return items.some((item) => !/^type\s/.test(item));
}

const SIDE_EFFECT_RE = /^[ \t]*import\s*['"]([^'"]+)['"]\s*;?/gm;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const FROM_RE = /^[ \t]*(?:import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/gm;

/**
 * Every module specifier this file reaches through a value (non-erased)
 * import, in the order each first appears in the source. Order is preserved
 * (rather than collected by regex category) so a DFS over these edges
 * explores the file top-to-bottom like a reader would — which is what makes
 * the "known chain" test below deterministic instead of depending on which
 * of several real bad paths a Set's insertion order happened to surface
 * first.
 */
function extractValueImportSpecifiers(rawContent: string): string[] {
  const src = stripComments(rawContent);
  const hits: { index: number; specifier: string }[] = [];

  // Side-effect-only imports (`import 'server-only';`) always execute the
  // target module, so they count as a value edge regardless of bindings.
  for (const m of src.matchAll(SIDE_EFFECT_RE)) hits.push({ index: m.index ?? 0, specifier: m[1] });
  const withoutSideEffects = src.replace(SIDE_EFFECT_RE, (m) => m.replace(/[^\n]/g, ' '));

  for (const m of withoutSideEffects.matchAll(DYNAMIC_IMPORT_RE)) {
    hits.push({ index: m.index ?? 0, specifier: m[1] });
  }

  for (const m of withoutSideEffects.matchAll(FROM_RE)) {
    const [, typeKeyword, clause, specifier] = m;
    if (typeKeyword) continue; // `import type {...}` / `export type {...}` — fully erased
    if (clauseHasValueBinding(clause)) hits.push({ index: m.index ?? 0, specifier });
  }

  hits.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const hit of hits) {
    if (seen.has(hit.specifier)) continue;
    seen.add(hit.specifier);
    ordered.push(hit.specifier);
  }
  return ordered;
}

// ── Module resolution ───────────────────────────────────────────────────────

type Resolved = { kind: 'zod' } | { kind: 'file'; path: string } | null;

function resolveModule(fromFile: string, specifier: string): Resolved {
  if (specifier === 'zod') return { kind: 'zod' };

  let base: string;
  if (specifier.startsWith('@/')) {
    base = path.join(SRC_DIR, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = path.join(path.dirname(fromFile), specifier);
  } else {
    return null; // bare package specifier other than 'zod' — out of scope, not traversed
  }

  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { kind: 'file', path: candidate };
    }
  }
  return null; // e.g. a .css/.json/image import, or genuinely missing
}

// ── Graph walk ───────────────────────────────────────────────────────────────

/**
 * DFS from `startFile` following only value-import edges. Returns the chain
 * of file paths (ending in either the literal 'zod' or content-schema.ts's
 * path) the first time it finds one, or null if `startFile` never reaches
 * either through a value import.
 */
function findValueChainToBadTarget(startFile: string): string[] | null {
  const visiting = new Set<string>();

  function dfs(file: string): string[] | null {
    if (visiting.has(file)) return null; // circular import — don't loop forever
    if (!/\.tsx?$/.test(file)) return null; // non-TS leaf (css/json/etc.)
    visiting.add(file);
    const content = fs.readFileSync(file, 'utf8');
    for (const specifier of extractValueImportSpecifiers(content)) {
      const resolved = resolveModule(file, specifier);
      if (!resolved) continue;
      if (resolved.kind === 'zod') return [file, 'zod'];
      if (resolved.path === CONTENT_SCHEMA_PATH) return [file, resolved.path];
      const sub = dfs(resolved.path);
      if (sub) return [file, ...sub];
    }
    visiting.delete(file);
    return null;
  }

  return dfs(startFile);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('client bundle stays zod-free', () => {
  const allFiles = walk(SRC_DIR);
  const publicClientRoots = allFiles.filter(isPublicClientRoot);

  it('found at least one public use-client root (test is not vacuous on discovery)', () => {
    // If this ever hits zero, the USE_CLIENT_RE / walk() pairing broke and
    // every other assertion below would trivially, silently pass.
    expect(publicClientRoots.length).toBeGreaterThan(0);
  });

  it.each(publicClientRoots.map((f) => [path.relative(SRC_DIR, f), f] as const))(
    '%s never value-imports zod or @/lib/content-schema',
    (_label, file) => {
      const chain = findValueChainToBadTarget(file);
      expect(chain, chain ? `value-import chain: ${chain.join(' -> ')}` : undefined).toBeNull();
    },
  );

  // Proof the walker actually detects a real bad chain, not just an absence
  // of them. Two links, each checked deterministically:
  //
  //  1. content.ts value-imports `SiteContentSchema` (a value, not just the
  //     `SiteContent` type) from content-schema.ts — its very first resolvable
  //     specifier once `server-only` and `react` (bare, non-'zod' specifiers)
  //     are skipped, so the walker hits it immediately rather than wandering
  //     into one of content.ts's several OTHER genuine paths to zod (e.g.
  //     through the dynamic `import('./drafts')` deeper in the file).
  //  2. content-schema.ts's own first import is `{ z } from 'zod'`.
  //
  // Together these are exactly the known-bad chain
  // content.ts -> content-schema.ts -> zod. A guard that can never fail is
  // worse than none.
  it('detects the known chain: content.ts -> content-schema.ts', () => {
    const chain = findValueChainToBadTarget(path.join(SRC_DIR, 'lib', 'content.ts'));
    expect(chain).toEqual([path.join(SRC_DIR, 'lib', 'content.ts'), CONTENT_SCHEMA_PATH]);
  });

  it('detects the known chain: content-schema.ts -> zod', () => {
    const chain = findValueChainToBadTarget(CONTENT_SCHEMA_PATH);
    expect(chain).toEqual([CONTENT_SCHEMA_PATH, 'zod']);
  });

  // `import type` / inline `import { type X }` must NOT be graph edges: this
  // module has zero value imports (LABEL_DEFAULT_LITERALS has none, by its
  // own doc comment), but plenty of files import its `Labels` *type* from
  // content-schema.ts — if the parser mistook those for value imports, this
  // would falsely flag every one of them.
  it('does not treat `import type` as a value edge', () => {
    const clientLabelsImporter = publicClientRoots.find((f) =>
      fs.readFileSync(f, 'utf8').includes("from '@/lib/labels'"),
    );
    expect(clientLabelsImporter, 'expected at least one public client component importing @/lib/labels').toBeDefined();
    expect(findValueChainToBadTarget(clientLabelsImporter!)).toBeNull();
  });
});

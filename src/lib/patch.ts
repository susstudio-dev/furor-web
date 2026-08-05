import { collectionIdField } from './collections';
import { parsePath, type PathSegment } from './patch-path';

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

// The wire format for an admin save. `setList` exists because mergeWithSeed
// replaces arrays wholesale and every list editor does add/remove/reorder —
// a whole array is the only thing those editors can honestly produce. The
// server expands it into per-record changes before authorizing (see expand.ts),
// so the convenience of the wire format never reaches the authorizer.
export type Op =
  | { op: 'set'; path: string; value: Json }
  | { op: 'setList'; path: string; value: Json[] }
  | { op: 'insert'; path: string; value: Json }
  | { op: 'remove'; path: string; id: string }
  | { op: 'reorder'; path: string; ids: string[] };

export class PatchError extends Error {
  constructor(
    public readonly path: string,
    reason: string,
  ) {
    super(`Cannot apply ${path}: ${reason}`);
    this.name = 'PatchError';
  }
}

type Obj = Record<string, unknown>;

function idOf(record: unknown, field: string): string | undefined {
  if (record == null || typeof record !== 'object') return undefined;
  const v = (record as Obj)[field];
  return typeof v === 'string' ? v : undefined;
}

function dottedKeys(segments: PathSegment[], upto: number): string {
  return segments
    .slice(0, upto + 1)
    .map((s) => s.key)
    .join('.');
}

/** Reads the value at `segments[0..upto)`. Every intermediate must already
 *  exist — this never creates containers implicitly. */
function walk(root: unknown, segments: PathSegment[], upto: number, path: string): unknown {
  let cursor: unknown = root;

  for (let i = 0; i < upto; i++) {
    const seg = segments[i];
    if (cursor == null || typeof cursor !== 'object') {
      throw new PatchError(path, `${seg.key} has no parent object`);
    }
    const holder = cursor as Obj;
    if (!Object.hasOwn(holder, seg.key)) throw new PatchError(path, `missing key ${seg.key}`);
    const value = holder[seg.key];

    if (seg.kind === 'key') {
      cursor = value;
      continue;
    }
    if (!Array.isArray(value)) throw new PatchError(path, `${seg.key} is not an array`);

    if (seg.kind === 'index') {
      if (seg.index >= value.length) throw new PatchError(path, `index ${seg.index} out of range`);
      cursor = value[seg.index];
      continue;
    }
    const field = collectionIdField(dottedKeys(segments, i));
    if (!field) throw new PatchError(path, `${dottedKeys(segments, i)} is not an id-addressed collection`);
    const found = value.find((r) => idOf(r, field) === seg.id);
    if (found === undefined) throw new PatchError(path, `no record with ${field}=${seg.id}`);
    cursor = found;
  }
  return cursor;
}

/** Resolves the array a list op targets, plus its id field. */
function collectionAt(
  root: unknown,
  segments: PathSegment[],
  path: string,
): { arr: unknown[]; field: string; holder: Obj; key: string } {
  const last = segments[segments.length - 1];
  if (last.kind !== 'key') throw new PatchError(path, 'a list op must target the collection itself');

  const parent = walk(root, segments, segments.length - 1, path);
  if (parent == null || typeof parent !== 'object') throw new PatchError(path, 'parent is not an object');

  const holder = parent as Obj;
  const arr = holder[last.key];
  if (!Array.isArray(arr)) throw new PatchError(path, `${last.key} is not an array`);

  const field = collectionIdField(dottedKeys(segments, segments.length - 1));
  if (!field) throw new PatchError(path, `${path} is not an id-addressed collection`);
  return { arr, field, holder, key: last.key };
}

function assign(root: unknown, segments: PathSegment[], path: string, value: Json): void {
  const last = segments[segments.length - 1];
  const parent = walk(root, segments, segments.length - 1, path);
  if (parent == null || typeof parent !== 'object') throw new PatchError(path, 'parent is not an object');
  const holder = parent as Obj;

  if (last.kind === 'key') {
    holder[last.key] = value;
    return;
  }
  const arr = holder[last.key];
  if (!Array.isArray(arr)) throw new PatchError(path, `${last.key} is not an array`);

  if (last.kind === 'index') {
    if (last.index >= arr.length) throw new PatchError(path, `index ${last.index} out of range`);
    arr[last.index] = value;
    return;
  }
  const field = collectionIdField(dottedKeys(segments, segments.length - 1));
  if (!field) throw new PatchError(path, `${path} is not an id-addressed collection`);
  const i = arr.findIndex((r) => idOf(r, field) === last.id);
  if (i === -1) throw new PatchError(path, `no record with ${field}=${last.id}`);
  arr[i] = value;
}

/** Applies ops to a DEEP CLONE — the input document is never mutated, so a
 *  caller can always diff pre- against post-patch state. */
export function applyOps<T>(doc: T, ops: Op[]): T {
  const next = structuredClone(doc) as unknown;

  for (const op of ops) {
    // Throws InvalidPathError on reserved (__proto__/constructor/prototype)
    // or malformed segments, before anything is written.
    const segments = parsePath(op.path);

    if (op.op === 'set' || op.op === 'setList') {
      assign(next, segments, op.path, op.value as Json);
      continue;
    }

    const { arr, field } = collectionAt(next, segments, op.path);

    if (op.op === 'insert') {
      arr.push(op.value);
      continue;
    }
    if (op.op === 'remove') {
      const i = arr.findIndex((r) => idOf(r, field) === op.id);
      if (i === -1) throw new PatchError(op.path, `no record with ${field}=${op.id}`);
      arr.splice(i, 1);
      continue;
    }

    const byId = new Map<string | undefined, unknown>(arr.map((r) => [idOf(r, field), r]));
    if (byId.size !== arr.length) throw new PatchError(op.path, 'duplicate ids in collection');
    if (op.ids.length !== arr.length) throw new PatchError(op.path, 'reorder must list every id exactly once');
    const reordered = op.ids.map((id) => {
      const r = byId.get(id);
      if (r === undefined) throw new PatchError(op.path, `no record with ${field}=${id}`);
      return r;
    });
    arr.splice(0, arr.length, ...reordered);
  }

  return next as T;
}

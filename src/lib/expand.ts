import { collectionIdField } from './collections';
import { applyOps, type Json, type Op } from './patch';
import { formatPath, parsePath, type PathSegment } from './patch-path';

// A leaf change is what the authorizer actually sees. Expansion turns a
// convenient wire op (often a whole array) into the per-record changes it
// implies, so a write at a parent path cannot escape a record-scoped rule and
// every condition has a record to bind to.
export type LeafChange =
  | {
      kind: 'update';
      path: string;
      before: Json;
      after: Json;
      collection?: string;
      id?: string;
      /** The containing record, before and after the WHOLE envelope. */
      record?: { before: Json; after: Json };
    }
  | { kind: 'create'; path: string; collection: string; id: string; after: Json }
  | { kind: 'delete'; path: string; collection: string; id: string; before: Json }
  | { kind: 'reorder'; path: string; collection: string; before: string[]; after: string[] };

type Obj = Record<string, unknown>;

// Key-order-insensitive: a client that re-serialises a record with its keys in
// a different order has not changed anything, and treating that as a change
// would demand authorization for records the user never touched.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a as Obj);
  const kb = Object.keys(b as Obj);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.hasOwn(b as Obj, k) && deepEqual((a as Obj)[k], (b as Obj)[k]));
}

/** Tolerant reader: returns undefined instead of throwing when the path does
 *  not resolve (a record may exist on only one side of the diff). */
function readAt(root: unknown, segments: PathSegment[]): unknown {
  let cursor: unknown = root;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (cursor == null || typeof cursor !== 'object') return undefined;
    const value = (cursor as Obj)[seg.key];

    if (seg.kind === 'key') {
      cursor = value;
      continue;
    }
    if (!Array.isArray(value)) return undefined;
    if (seg.kind === 'index') {
      cursor = value[seg.index];
      continue;
    }
    const field = collectionIdField(segments.slice(0, i + 1).map((s) => s.key).join('.')) ?? 'id';
    cursor = value.find((r) => (r as Obj | null)?.[field] === seg.id);
  }
  return cursor;
}

function idsOf(arr: unknown[], field: string): string[] {
  return arr.map((r) => String((r as Obj | null)?.[field]));
}

function diffCollection(
  beforeDoc: unknown,
  afterDoc: unknown,
  segments: PathSegment[],
  collection: string,
  field: string,
): LeafChange[] {
  const beforeArr = (readAt(beforeDoc, segments) as unknown[]) ?? [];
  const afterArr = (readAt(afterDoc, segments) as unknown[]) ?? [];

  const beforeById = new Map(beforeArr.map((r) => [String((r as Obj)?.[field]), r] as const));
  const afterById = new Map(afterArr.map((r) => [String((r as Obj)?.[field]), r] as const));

  const changes: LeafChange[] = [];

  for (const [id, after] of afterById) {
    const path = `${collection}[id=${id}]`;
    const before = beforeById.get(id);
    if (before === undefined) {
      changes.push({ kind: 'create', path, collection, id, after: after as Json });
    } else if (!deepEqual(before, after)) {
      changes.push({
        kind: 'update',
        path,
        collection,
        id,
        before: before as Json,
        after: after as Json,
        record: { before: before as Json, after: after as Json },
      });
    }
  }
  for (const [id, before] of beforeById) {
    if (!afterById.has(id)) {
      changes.push({
        kind: 'delete',
        path: `${collection}[id=${id}]`,
        collection,
        id,
        before: before as Json,
      });
    }
  }

  // Order is only a change for records present on both sides; creations and
  // deletions already have their own leaves.
  const commonBefore = idsOf(beforeArr, field).filter((id) => afterById.has(id));
  const commonAfter = idsOf(afterArr, field).filter((id) => beforeById.has(id));
  if (!deepEqual(commonBefore, commonAfter)) {
    changes.push({
      kind: 'reorder',
      path: collection,
      collection,
      before: idsOf(beforeArr, field),
      after: idsOf(afterArr, field),
    });
  }
  return changes;
}

/**
 * Expands an op envelope into the leaf changes it implies.
 *
 * The whole envelope is applied once up front, so `before`/`after` always
 * describe the NET effect. That matters for authorization: a patch that hops a
 * record into the subject's scope in op 1 and edits it in op 2 must be judged
 * against the record as it was BEFORE the envelope, not after op 1.
 */
export function expandOps(base: unknown, ops: Op[]): LeafChange[] {
  const after = applyOps(base, ops);
  const changes: LeafChange[] = [];
  const seenCollections = new Set<string>();
  const seenPaths = new Set<string>();

  for (const op of ops) {
    const segments = parsePath(op.path);
    const last = segments[segments.length - 1];
    const dotted = segments.map((s) => s.key).join('.');

    // A write that targets an id-addressed collection ARRAY — whatever the op
    // kind — is diffed per record.
    const field = last.kind === 'key' ? collectionIdField(dotted) : null;
    if (field) {
      if (seenCollections.has(dotted)) continue;
      seenCollections.add(dotted);
      changes.push(...diffCollection(base, after, segments, dotted, field));
      continue;
    }

    const canonical = formatPath(segments);
    if (seenPaths.has(canonical)) continue;
    seenPaths.add(canonical);

    const before = readAt(base, segments) as Json;
    const afterValue = readAt(after, segments) as Json;
    if (deepEqual(before, afterValue)) continue;

    const recordIdx = segments.findIndex((s) => s.kind === 'id');
    if (recordIdx === -1) {
      changes.push({ kind: 'update', path: canonical, before, after: afterValue });
      continue;
    }

    const recordSegments = segments.slice(0, recordIdx + 1);
    const idSeg = segments[recordIdx] as Extract<PathSegment, { kind: 'id' }>;
    changes.push({
      kind: 'update',
      path: canonical,
      collection: recordSegments.map((s) => s.key).join('.'),
      id: idSeg.id,
      before,
      after: afterValue,
      record: {
        before: readAt(base, recordSegments) as Json,
        after: readAt(after, recordSegments) as Json,
      },
    });
  }

  return changes;
}

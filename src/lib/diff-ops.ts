import { collectionIdField } from './collections';
import { deepEqual } from './deep-equal';
import type { Json, Op } from './patch';

// Turns "here is the whole document I want" into the ops that describe the
// change. Every admin editor still holds and submits the entire SiteContent
// (that is what all 20 of them do today), so the server derives the ops by
// diffing against the document it just loaded.
//
// This is what keeps a whole-document POST from being an authorization bypass:
// the submitted document never becomes a single write at the root, it becomes
// the top-level changes it implies, which expand.ts then breaks down per
// record before anything is authorized.

// `version` is a schema literal, not data — it is never a change.
const NOT_DATA = new Set(['version']);

type Obj = Record<string, unknown>;

export function diffToOps(base: unknown, next: unknown): Op[] {
  if (base == null || typeof base !== 'object' || next == null || typeof next !== 'object') return [];
  const b = base as Obj;
  const n = next as Obj;
  const ops: Op[] = [];

  for (const key of Object.keys(n)) {
    if (NOT_DATA.has(key)) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (deepEqual(b[key], n[key])) continue;

    if (collectionIdField(key) && Array.isArray(n[key])) {
      ops.push({ op: 'setList', path: key, value: n[key] as Json[] });
    } else {
      ops.push({ op: 'set', path: key, value: n[key] as Json });
    }
  }
  return ops;
}

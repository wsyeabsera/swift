/** Op log + branches (design: docs/oplog-design.md, step 1). Pure data: no DOM, no storage. Every op carries what its own undo needs, so undo never needs a snapshot.
 *  Defaults chosen for the draft's open questions: Keep = fast-forward main to the branch; undo stops at the branch's base; one-way project-file upgrade (persistence comes in a later step). */
import type { FrameDef } from './canvas/fixtures';
export type Placed = { def: FrameDef; index: number }; // a frame and where it sat in the list
export type Op = (
  | { kind: 'set'; frame: string; el: string; prop: string; before: string; after: string }
  | { kind: 'text'; frame: string; el: string; before: string; after: string }
  | { kind: 'add'; frame: string; parent: string; html: string }
  | { kind: 'remove'; frame: string; parent: string; html: string }
  | { kind: 'snap'; frame: string; before: string; after: string } // whole-frame markup change (Say, drag, resize, delete, library insert): one undo step
  | { kind: 'frameDel' | 'frameAdd'; frame: string; def: FrameDef; index: number }
  | { kind: 'discard' | 'restore'; frame: string; items: Placed[] } // Spark takes discarded / brought back
  | { kind: 'rename'; frame: string; before: string; after: string }
  | { kind: 'brand'; name: string; before: string; after: string } // one brand-kit token changed (the Brand editor / a colour token request)
  | { kind: 'group'; label: string; ops: Op[] } // several ops = one undo step
) & { rec?: number }; // telemetry record this op belongs to (Pulse marks it undone)
export type Branch = { parent: string | null; at: number; ops: Op[] }; // `at` = how many of the parent's ops were applied when this branch forked
export type Log = { branches: Record<string, Branch>; current: string; head: number }; // head = applied ops of the CURRENT branch's own list
export const MAIN = 'main';
export const emptyLog = (): Log => ({ branches: { [MAIN]: { parent: null, at: 0, ops: [] } }, current: MAIN, head: 0 });

/** The op that exactly undoes `op` (groups invert in reverse order). */
export function invert(op: Op): Op {
  switch (op.kind) {
    case 'set': return { ...op, before: op.after, after: op.before };
    case 'text': return { ...op, before: op.after, after: op.before };
    case 'add': return { ...op, kind: 'remove' };
    case 'remove': return { ...op, kind: 'add' };
    case 'snap': return { ...op, before: op.after, after: op.before };
    case 'frameDel': return { ...op, kind: 'frameAdd' };
    case 'frameAdd': return { ...op, kind: 'frameDel' };
    case 'discard': return { ...op, kind: 'restore' };
    case 'restore': return { ...op, kind: 'discard' };
    case 'rename': return { ...op, before: op.after, after: op.before };
    case 'brand': return { ...op, before: op.after, after: op.before };
    case 'group': return { ...op, ops: [...op.ops].reverse().map(invert) };
  }
}
const own = (log: Log): Branch => log.branches[log.current]!;
/** All ops from the root to `name`'s first `count` own ops (parents' prefixes first). */
function path(log: Log, name: string, count: number): Op[] {
  const b = log.branches[name]!; const base = b.parent === null ? [] : path(log, b.parent, b.at); return [...base, ...b.ops.slice(0, count)];
}
/** Record a new op on the current branch; anything undone beyond the head on THIS branch is dropped (it was the redo tail). */
export function push(log: Log, op: Op): Log {
  const b = own(log); return { ...log, head: log.head + 1, branches: { ...log.branches, [log.current]: { ...b, ops: [...b.ops.slice(0, log.head), op] } } };
}
export const canUndo = (log: Log): boolean => log.head > 0; // stops at the branch base
export const canRedo = (log: Log): boolean => log.head < own(log).ops.length;
/** Move the head back one op: `apply` is what to run on the design (null when at the base). */
export function undo(log: Log): { log: Log; apply: Op | null } { if (!canUndo(log)) return { log, apply: null }; return { log: { ...log, head: log.head - 1 }, apply: invert(own(log).ops[log.head - 1]!) }; }
export function redo(log: Log): { log: Log; apply: Op | null } { if (!canRedo(log)) return { log, apply: null }; return { log: { ...log, head: log.head + 1 }, apply: own(log).ops[log.head]! }; }
/** Fork the current branch at its head under a new name and switch to it (the design does not change). Forking is a new divergence point, so undone steps beyond the head (the redo tail) are dropped, as a new edit would; refused when another branch forks from inside that tail. */
export function fork(log: Log, name: string): { ok: true; log: Log } | { ok: false; error: string } {
  const n = name.trim(); if (!n || n.length > 40) return { ok: false, error: 'branch name must be 1-40 characters' }; if (log.branches[n]) return { ok: false, error: `branch "${n}" already exists` };
  const cur = own(log); const orphan = Object.entries(log.branches).find(([, b]) => b.parent === log.current && b.at > log.head); if (orphan) return { ok: false, error: `branch "${orphan[0]}" forks from a step you have undone; redo first` };
  return { ok: true, log: { branches: { ...log.branches, [log.current]: { ...cur, ops: cur.ops.slice(0, log.head) }, [n]: { parent: log.current, at: log.head, ops: [] } }, current: n, head: 0 } };
}
/** Switch to another branch (at its tip): `steps` are the ops to apply to the design, in order (undo what the current state has beyond the shared past, then replay the target). */
export function switchTo(log: Log, name: string): { log: Log; steps: Op[] } | { error: string } {
  const t = log.branches[name]; if (!t) return { error: `no branch "${name}"` }; if (name === log.current) return { log, steps: [] };
  const from = path(log, log.current, log.head); const to = path(log, name, t.ops.length); let k = 0; while (k < from.length && k < to.length && from[k] === to[k]) k++; // ops are shared by reference up the parent chain
  return { log: { ...log, current: name, head: t.ops.length }, steps: [...from.slice(k).reverse().map(invert), ...to.slice(k)] };
}
/** Keep: fast-forward main to `name`'s ops. Only when main has not moved since the fork (otherwise merging is needed, #1743); the design already equals the branch tip, so nothing to apply. */
export function keep(log: Log, name: string): { ok: true; log: Log } | { ok: false; error: string } {
  const b = log.branches[name]; if (!b || name === MAIN) return { ok: false, error: `cannot keep "${name}"` }; if (b.parent !== MAIN) return { ok: false, error: 'only a branch forked from main can be kept' };
  const main = log.branches[MAIN]!; if (main.ops.length !== b.at) return { ok: false, error: 'main has changed since this branch was forked (merge needed)' }; if (log.current !== name) return { ok: false, error: 'switch to the branch before keeping it' };
  const branches: Record<string, Branch> = { ...log.branches, [MAIN]: { ...main, ops: [...main.ops, ...b.ops] } }; delete branches[name];
  for (const [n, o] of Object.entries(branches)) if (o.parent === name) branches[n] = { ...o, parent: MAIN, at: main.ops.length + o.at }; // children of the kept branch re-hang on main
  return { ok: true, log: { branches, current: MAIN, head: main.ops.length + b.ops.length } };
}
/** Delete a branch: never main, never the current one, never one that other branches fork from. */
export function remove(log: Log, name: string): { ok: true; log: Log } | { ok: false; error: string } {
  if (name === MAIN) return { ok: false, error: 'main cannot be deleted' }; if (!log.branches[name]) return { ok: false, error: `no branch "${name}"` }; if (name === log.current) return { ok: false, error: 'switch away from the branch first' };
  if (Object.values(log.branches).some((b) => b.parent === name)) return { ok: false, error: 'other branches fork from this one' };
  const branches = { ...log.branches }; delete branches[name]; return { ok: true, log: { ...log, branches } };
}
/** The op the head sits on (what undo reverses) and the one redo would apply. */
export const lastApplied = (log: Log): Op | undefined => own(log).ops[log.head - 1];
export const nextRedo = (log: Log): Op | undefined => own(log).ops[log.head];
/** Replace the last applied op (e.g. coalesce rapid nudges into one step); anything after the head is dropped, like a push. Returns null when there is no op to amend or `fn` declines. */
export function amendLast(log: Log, fn: (last: Op) => Op | null): Log | null {
  const last = lastApplied(log); const next = last ? fn(last) : null; if (!next) return null; const b = own(log);
  return { ...log, branches: { ...log.branches, [log.current]: { ...b, ops: [...b.ops.slice(0, log.head - 1), next] } } };
}
/** Drop ops of the current branch that match (their frame is gone); the head counts only the kept ops that were applied. */
export function prune(log: Log, drop: (op: Op) => boolean): Log {
  const b = own(log); const kept = b.ops.filter((o) => !drop(o)); const head = b.ops.slice(0, log.head).filter((o) => !drop(o)).length;
  return { ...log, head, branches: { ...log.branches, [log.current]: { ...b, ops: kept } } };
}

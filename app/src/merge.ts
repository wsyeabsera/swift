/** Three-way merge of a branch into the branch it forked from, over the op log (design: docs/oplog-design.md). Pure.
 *  base = the shared past, ours = ops the target gained since the fork, theirs = the branch's ops. Per-property ops (set, text, rename, brand) conflict only when both
 *  sides changed the SAME property of the SAME element; whole-frame ops (snap, add, remove, frame add/delete, discard/restore) own the whole frame (`frame/*`).
 *  Non-overlapping changes merge automatically as ONE group op, so a single undo restores the target exactly. The merged branch is removed, like Keep. */
import type { Branch, Log, Op } from './oplog';
import { MAIN } from './oplog';
export type Choice = 'ours' | 'theirs';
export type Conflict = { key: string; ours: string; theirs: string }; // both sides, described for the sheet
const leaves = (o: Op): Op[] => (o.kind === 'group' ? o.ops.flatMap(leaves) : [o]);
/** What an op changes: a per-property key, or `frame/*` for a whole-frame change. */
export function keyOf(o: Op): string {
  switch (o.kind) {
    case 'set': return `${o.frame}/${o.el}/${o.prop}`; case 'text': return `${o.frame}/${o.el}/text`; case 'rename': return `${o.frame}/title`; case 'brand': return `brand/${o.name}`;
    case 'group': return o.ops.map(keyOf).join('|'); default: return `${o.frame}/*`;
  }
}
const touches = (a: string, b: string): boolean => a === b || (a.endsWith('/*') && b.startsWith(a.slice(0, -1))) || (b.endsWith('/*') && a.startsWith(b.slice(0, -1)));
const describe = (o: Op): string => { switch (o.kind) { case 'set': return `${o.prop}: ${o.after}`; case 'text': return `text: ${o.after}`; case 'rename': return `title: ${o.after}`; case 'brand': return `${o.name}: ${o.after}`; case 'snap': return 'changed the whole frame'; case 'add': return 'added an element'; case 'remove': return 'removed an element'; default: return o.kind; } };
const last = (ops: Op[], key: string): Op | undefined => [...ops].reverse().find((o) => touches(keyOf(o), key));

export type MergeResult =
  | { ok: true; log: Log; apply: Op | null } // apply = the group to run on the design (null when the branch had nothing left to add)
  | { ok: false; error: string }
  | { ok: false; conflicts: Conflict[] };
/** Merge `name` into the current branch. Without `choices`, conflicts are returned; with one choice per conflict key it completes. */
export function merge(log: Log, name: string, choices: Record<string, Choice> = {}): MergeResult {
  const b = log.branches[name]; if (!b || name === log.current) return { ok: false, error: `cannot merge "${name}"` }; if (b.parent !== log.current) return { ok: false, error: `"${name}" forks from ${b.parent ?? 'nothing'}: switch to it first` };
  const target = log.branches[log.current]!; if (log.head !== target.ops.length) return { ok: false, error: 'redo or discard your undone steps before merging' };
  if (Object.values(log.branches).some((x) => x.parent === name)) return { ok: false, error: 'other branches fork from this one' };
  const ours = target.ops.slice(b.at).flatMap(leaves); const theirs = b.ops.flatMap(leaves);
  const conflicts = new Map<string, Conflict>(); for (const t of theirs) for (const o of ours) { const k = touches(keyOf(t), keyOf(o)) ? (keyOf(t).endsWith('/*') ? keyOf(t) : keyOf(o).endsWith('/*') ? keyOf(o) : keyOf(t)) : ''; if (k && !conflicts.has(k)) conflicts.set(k, { key: k, ours: describe(last(ours, k)!), theirs: describe(last(theirs, k)!) }); }
  const open = [...conflicts.values()].filter((c) => !choices[c.key]); if (open.length) return { ok: false, conflicts: open };
  const keep: Op[] = []; // their ops that survive, with `before` re-based onto what the target holds now
  for (const t of theirs) {
    const k = [...conflicts.keys()].find((c) => touches(keyOf(t), c)); if (!k) { keep.push(t); continue; } if (choices[k] === 'ours') continue;
    const o = last(ours, k)!; // take theirs: its undo must restore the TARGET's value, not the fork-time one
    if (t.kind === 'set' && o.kind === 'set') keep.push({ ...t, before: o.after }); else if ((t.kind === 'text' || t.kind === 'rename' || t.kind === 'brand') && o.kind === t.kind) keep.push({ ...t, before: (o as typeof t).after });
    else if (t.kind === 'snap' && o.kind === 'snap') keep.push({ ...t, before: o.after }); else return { ok: false, error: `"${k}": the two sides changed it in different ways, so theirs cannot be taken automatically: keep ours` };
  }
  const group: Op | null = keep.length ? { kind: 'group', label: `merge ${name}`, ops: keep } : null; const ops = group ? [...target.ops, group] : target.ops;
  const branches: Record<string, Branch> = { ...log.branches, [log.current]: { ...target, ops } }; delete branches[name];
  return { ok: true, apply: group, log: { ...log, branches, head: ops.length } };
}
export const canMerge = (log: Log, name: string): boolean => name !== log.current && log.branches[name]?.parent === log.current && name !== MAIN;

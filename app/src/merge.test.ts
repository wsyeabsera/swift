import { expect, test } from 'vitest';
import * as L from './oplog';
import { merge, keyOf } from './merge';
import type { Op } from './oplog';
const set = (el: string, prop: string, before: string, after: string, frame = 'f'): Op => ({ kind: 'set', frame, el, prop, before, after });
const build = (onMain: Op[], onBranch: Op[]) => { let l = L.emptyLog(); const f = L.fork(l, 'b'); if (!f.ok) throw new Error('fork'); l = f.log; for (const o of onBranch) l = L.push(l, o); const back = L.switchTo(l, 'main'); if ('error' in back) throw new Error(back.error); l = back.log; for (const o of onMain) l = L.push(l, o); return l; };
test('non-overlapping changes merge automatically as one group, the branch goes away', () => {
  const r = merge(build([set('a', 'color', 'red', 'blue')], [set('b', 'color', 'red', 'green'), set('a', 'width', '1px', '2px')]), 'b'); expect(r.ok).toBe(true); if (!r.ok || !('log' in r)) return;
  expect(r.apply).toMatchObject({ kind: 'group', label: 'merge b' }); expect(r.log.branches['b']).toBeUndefined(); expect(r.log.head).toBe(2); expect(L.invert(r.apply!)).toMatchObject({ kind: 'group' }); // one undo step
});
test('the same property of the same element is a conflict, listed with both sides', () => {
  const r = merge(build([set('a', 'color', 'red', 'blue')], [set('a', 'color', 'red', 'green')]), 'b'); expect(r.ok).toBe(false); expect('conflicts' in r && r.conflicts).toEqual([{ key: 'f/a/color', ours: 'color: blue', theirs: 'color: green' }]);
});
test('keep ours drops their change; take theirs re-bases `before` onto what main holds so undo restores main exactly', () => {
  const l = build([set('a', 'color', 'red', 'blue')], [set('a', 'color', 'red', 'green')]);
  const ours = merge(l, 'b', { 'f/a/color': 'ours' }); expect(ours.ok && 'log' in ours && ours.apply).toBeNull();
  const theirs = merge(l, 'b', { 'f/a/color': 'theirs' }); expect(theirs.ok && 'log' in theirs && theirs.apply).toMatchObject({ ops: [{ kind: 'set', before: 'blue', after: 'green' }] });
});
test('a whole-frame change owns every element of that frame; other frames are free', () => {
  expect(keyOf({ kind: 'snap', frame: 'f', before: '', after: '' })).toBe('f/*');
  const r = merge(build([{ kind: 'snap', frame: 'f', before: 'a', after: 'b' }], [set('a', 'color', 'red', 'green')]), 'b'); expect('conflicts' in r && r.conflicts[0]!.key).toBe('f/*');
  const free = merge(build([{ kind: 'snap', frame: 'f', before: 'a', after: 'b' }], [set('a', 'color', 'red', 'green', 'other')]), 'b'); expect(free.ok).toBe(true);
});
test('taking theirs across different kinds of change is refused, nothing half-applied', () => {
  const l = build([{ kind: 'snap', frame: 'f', before: 'a', after: 'b' }], [set('a', 'color', 'red', 'green')]); const r = merge(l, 'b', { 'f/*': 'theirs' }); expect(r.ok === false && 'error' in r && r.error).toMatch(/keep ours/);
});
test('refusals: not the parent, a child branch, undone steps pending, unknown branch', () => {
  const l = build([], [set('a', 'color', 'red', 'green')]); expect(merge(l, 'nope').ok).toBe(false); expect(merge(l, 'main').ok).toBe(false);
  const undone = L.undo(L.push(l, set('q', 'p', '1', '2'))).log; expect(merge(undone, 'b')).toMatchObject({ ok: false, error: expect.stringMatching(/redo/) });
});
test('merge into an empty-on-main branch equals keep: all their ops arrive', () => { const r = merge(build([], [set('a', 'x', '1', '2'), set('a', 'y', '1', '2')]), 'b'); expect(r.ok && 'log' in r && (r.apply as Extract<Op, { kind: 'group' }>).ops).toHaveLength(2); });

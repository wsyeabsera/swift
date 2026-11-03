import { expect, test } from 'vitest';
import { amendLast, canRedo, canUndo, emptyLog, fork, invert, keep, lastApplied, MAIN, nextRedo, prune, push, redo, remove, switchTo, undo, type Log, type Op } from './oplog';
import type { FrameDef } from './canvas/fixtures';
// A tiny design: properties and a set of added html fragments, so replay can be checked by state, not by shape.
type D = { props: Record<string, string>; added: string[] };
const apply = (d: D, op: Op): D => { switch (op.kind) {
  case 'set': return { ...d, props: { ...d.props, [`${op.el}.${op.prop}`]: op.after } };
  case 'text': return { ...d, props: { ...d.props, [`${op.el}.text`]: op.after } };
  case 'add': return { ...d, added: [...d.added, op.html] };
  case 'remove': return { ...d, added: d.added.filter((h) => h !== op.html) };
  case 'group': return op.ops.reduce(apply, d);
  default: return d; } }; // snap / frame ops are not modelled by this tiny design
const run = (d: D, ops: Op[]) => ops.reduce(apply, d);
const set = (prop: string, before: string, after: string): Op => ({ kind: 'set', frame: 'tv', el: 'clock', prop, before, after });
const d0: D = { props: { 'clock.color': 'white' }, added: [] };

test('push / undo / redo move the head; undo stops at the base; a new op drops the redo tail', () => {
  let l = push(emptyLog(), set('color', 'white', 'red')); l = push(l, set('color', 'red', 'blue')); expect(l.head).toBe(2);
  let d = run(d0, [set('color', 'white', 'red'), set('color', 'red', 'blue')]); expect(d.props['clock.color']).toBe('blue');
  const u1 = undo(l); d = apply(d, u1.apply!); l = u1.log; expect(d.props['clock.color']).toBe('red'); expect(canRedo(l)).toBe(true);
  const u2 = undo(l); d = apply(d, u2.apply!); l = u2.log; expect(d.props['clock.color']).toBe('white'); expect(canUndo(l)).toBe(false); expect(undo(l).apply).toBeNull();
  const r = redo(l); d = apply(d, r.apply!); l = r.log; expect(d.props['clock.color']).toBe('red'); l = push(l, set('color', 'red', 'green')); expect(canRedo(l)).toBe(false); expect(l.branches[MAIN]!.ops).toHaveLength(2);
});
test('a group (one Say) undoes as one step, in reverse', () => {
  const g: Op = { kind: 'group', label: 'make it warm', ops: [set('color', 'white', 'orange'), set('color', 'orange', 'brown'), { kind: 'add', frame: 'tv', parent: 'tv', html: '<b id="x"/>' }] };
  let d = apply(d0, g); expect(d.props['clock.color']).toBe('brown'); expect(d.added).toEqual(['<b id="x"/>']);
  const u = undo(push(emptyLog(), g)); d = apply(d, u.apply!); expect(d).toEqual(d0); expect(apply(apply(d0, g), invert(g))).toEqual(d0);
});
test('fork keeps main intact; switching replays exactly the difference both ways', () => {
  let l: Log = push(emptyLog(), set('color', 'white', 'red')); const f = fork(l, 'try-warm'); expect(f.ok).toBe(true); if (!f.ok) return; l = f.log; l = push(l, set('color', 'red', 'orange')); l = push(l, set('size', '1', '2'));
  let d = run(d0, [set('color', 'white', 'red'), set('color', 'red', 'orange'), set('size', '1', '2')]); expect(d.props['clock.color']).toBe('orange');
  const back = switchTo(l, MAIN); if ('error' in back) throw new Error(back.error); d = run(d, back.steps); l = back.log; expect(d.props['clock.color']).toBe('red'); expect(d.props['clock.size']).toBe('1');
  const again = switchTo(l, 'try-warm'); if ('error' in again) throw new Error(again.error); d = run(d, again.steps); expect(d.props['clock.color']).toBe('orange'); expect(d.props['clock.size']).toBe('2'); expect(again.log.head).toBe(2); expect(again.log.branches[MAIN]!.ops).toHaveLength(1);
  expect('error' in switchTo(l, 'nope')).toBe(true); expect(switchTo(l, l.current)).toMatchObject({ steps: [] });
});
test('switching between two sibling branches undoes one and replays the other', () => {
  let l: Log = emptyLog(); const a = fork(l, 'a'); if (!a.ok) return; l = push(a.log, set('color', 'white', 'red'));
  const m = switchTo(l, MAIN); if ('error' in m) return; l = m.log; const b = fork(l, 'b'); if (!b.ok) return; l = push(b.log, set('color', 'white', 'blue'));
  let d = run(d0, [set('color', 'white', 'blue')]); const s = switchTo(l, 'a'); if ('error' in s) throw new Error(s.error); d = run(d, s.steps); expect(d.props['clock.color']).toBe('red');
  const s2 = switchTo(s.log, 'b'); if ('error' in s2) throw new Error(s2.error); d = run(d, s2.steps); expect(d.props['clock.color']).toBe('blue');
});
test('undo on a branch stops at its base (never walks into main)', () => {
  let l: Log = push(emptyLog(), set('color', 'white', 'red')); const f = fork(l, 't'); if (!f.ok) return; l = push(f.log, set('color', 'red', 'blue')); l = undo(l).log; expect(canUndo(l)).toBe(false); expect(undo(l).apply).toBeNull(); expect(l.branches[MAIN]!.ops).toHaveLength(1);
});
test('keep fast-forwards main when main did not move; refuses otherwise; children re-hang', () => {
  let l: Log = push(emptyLog(), set('color', 'white', 'red')); const f = fork(l, 't'); if (!f.ok) return; l = push(f.log, set('color', 'red', 'blue'));
  const k = keep(l, 't'); expect(k.ok).toBe(true); if (!k.ok) return; expect(k.log.current).toBe(MAIN); expect(k.log.head).toBe(2); expect(k.log.branches.t).toBeUndefined(); expect(k.log.branches[MAIN]!.ops).toHaveLength(2);
  // main moved after the fork -> refused
  let m: Log = push(emptyLog(), set('color', 'white', 'red')); const f2 = fork(m, 't2'); if (!f2.ok) return; m = f2.log; const back = switchTo(m, MAIN); if ('error' in back) return; m = push(back.log, set('color', 'red', 'green')); const s = switchTo(m, 't2'); if ('error' in s) return;
  expect(keep(s.log, 't2')).toEqual({ ok: false, error: 'main has changed since this branch was forked (merge needed)' }); expect(keep(l, MAIN).ok).toBe(false);
  // a child of the kept branch becomes a child of main at the right offset
  let c: Log = emptyLog(); const t = fork(c, 't'); if (!t.ok) return; c = push(t.log, set('color', 'white', 'red')); const ch = fork(c, 'child'); if (!ch.ok) return; c = push(ch.log, set('color', 'red', 'pink'));
  const s2 = switchTo(c, 't'); if ('error' in s2) return; const k2 = keep(s2.log, 't'); expect(k2.ok).toBe(true); if (!k2.ok) return; expect(k2.log.branches.child).toMatchObject({ parent: MAIN, at: 1 });
  const s3 = switchTo(k2.log, 'child'); if ('error' in s3) return; expect(run(run(d0, [set('color', 'white', 'red')]), s3.steps).props['clock.color']).toBe('pink');
});
test('fork and delete refuse bad requests with a reason; delete never touches main', () => {
  const l = emptyLog(); expect(fork(l, ' ')).toEqual({ ok: false, error: 'branch name must be 1-40 characters' }); expect(fork(l, MAIN)).toMatchObject({ ok: false });
  const f = fork(l, 'x'); if (!f.ok) return; expect(remove(f.log, 'x')).toEqual({ ok: false, error: 'switch away from the branch first' }); const m = switchTo(f.log, MAIN); if ('error' in m) return;
  const del = remove(m.log, 'x'); expect(del.ok).toBe(true); expect(remove(m.log, MAIN)).toMatchObject({ ok: false }); expect(remove(m.log, 'zz')).toMatchObject({ ok: false });
  const a = fork(m.log, 'a'); if (!a.ok) return; const b = fork(a.log, 'b'); if (!b.ok) return; const ma = switchTo(b.log, MAIN); if ('error' in ma) return; expect(remove(ma.log, 'a')).toEqual({ ok: false, error: 'other branches fork from this one' });
});

const fd: FrameDef = { id: 'f1', root: 'f1', title: 'T', x: 0, y: 0, w: 1, h: 1, html: '' };
test('frame-level and snapshot ops invert to their partners and keep the telemetry tag', () => {
  const ops: Op[] = [{ kind: 'snap', frame: 'f1', before: 'a', after: 'b', rec: 7 }, { kind: 'frameDel', frame: 'f1', def: fd, index: 2 }, { kind: 'discard', frame: 'f1', items: [{ def: fd, index: 1 }] }, { kind: 'rename', frame: 'f1', before: 'x', after: 'y' }];
  expect(invert(ops[0]!)).toEqual({ kind: 'snap', frame: 'f1', before: 'b', after: 'a', rec: 7 }); expect(invert(ops[1]!).kind).toBe('frameAdd'); expect(invert(invert(ops[1]!))).toEqual(ops[1]); expect(invert(ops[2]!).kind).toBe('restore'); expect(invert(invert(ops[2]!))).toEqual(ops[2]);
  expect(invert(ops[3]!)).toMatchObject({ before: 'y', after: 'x' });
});
test('lastApplied / nextRedo follow the head; amendLast coalesces and drops the redo tail', () => {
  let l: Log = push(emptyLog(), set('left', '1', '2')); l = push(l, set('left', '2', '3')); expect(lastApplied(l)).toMatchObject({ after: '3' }); expect(nextRedo(l)).toBeUndefined();
  l = undo(l).log; expect(lastApplied(l)).toMatchObject({ after: '2' }); expect(nextRedo(l)).toMatchObject({ after: '3' });
  const m = amendLast(l, (o) => (o.kind === 'set' ? { ...o, after: '9' } : null)); expect(m).not.toBeNull(); expect(m!.branches[MAIN]!.ops).toHaveLength(1); expect(lastApplied(m!)).toMatchObject({ before: '1', after: '9' }); expect(canRedo(m!)).toBe(false);
  expect(amendLast(emptyLog(), () => null)).toBeNull(); expect(amendLast(l, () => null)).toBeNull();
});
test('prune drops ops of removed frames and keeps the head on the same applied op', () => {
  const a: Op = { kind: 'set', frame: 'gone', el: 'e', prop: 'p', before: '1', after: '2' }; const b: Op = set('color', 'white', 'red'); const c: Op = { kind: 'set', frame: 'gone', el: 'e', prop: 'p', before: '2', after: '3' };
  let l: Log = push(push(push(emptyLog(), a), b), c); l = undo(l).log; // head after a,b ; c is the redo tail
  const p = prune(l, (o) => 'frame' in o && o.frame === 'gone'); expect(p.branches[MAIN]!.ops).toEqual([b]); expect(p.head).toBe(1); expect(lastApplied(p)).toEqual(b);
});

test('fork drops the redo tail of the branch it leaves (so keep works after an undo); refused when another branch forks from inside that tail', () => {
  let l: Log = push(push(emptyLog(), set('color', 'white', 'red')), set('color', 'red', 'blue')); l = undo(l).log; expect(l.branches[MAIN]!.ops).toHaveLength(2);
  const f = fork(l, 't'); if (!f.ok) throw new Error(f.error); expect(f.log.branches[MAIN]!.ops).toHaveLength(1); l = push(f.log, set('color', 'red', 'green')); const k = keep(l, 't'); expect(k.ok).toBe(true); if (k.ok) expect(k.log.branches[MAIN]!.ops).toHaveLength(2);
  // a child forked at step 2 of main, then main undone to step 1: forking main again would orphan it
  let m: Log = push(push(emptyLog(), set('color', 'white', 'red')), set('color', 'red', 'blue')); const c = fork(m, 'child'); if (!c.ok) return; const back = switchTo(c.log, MAIN); if ('error' in back) return; m = undo(back.log).log;
  expect(fork(m, 'other')).toEqual({ ok: false, error: 'branch "child" forks from a step you have undone; redo first' });
});

test('a brand op inverts to the old token value and survives a group', () => {
  const op = { kind: 'brand', name: '--ac', before: '#0a84ff', after: '#ff0000' } as const; expect(invert(op)).toEqual({ kind: 'brand', name: '--ac', before: '#ff0000', after: '#0a84ff' });
  const g = invert({ kind: 'group', label: 'x', ops: [{ kind: 'snap', frame: 'a', before: 'b', after: 'c' }, op] }); expect(g).toMatchObject({ kind: 'group', ops: [{ kind: 'brand', after: '#0a84ff' }, { kind: 'snap', before: 'c' }] });
});

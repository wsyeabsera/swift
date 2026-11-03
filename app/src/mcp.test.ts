import { describe, expect, it } from 'vitest';
import { handleMcp, type McpEnv } from './mcp';
import type { CanvasApi } from './canvas/Canvas';
import type { Op } from './oplog';

function fake() {
  const st = { clock: { 'font-size': '40px' } as Record<string, string>, text: '12:00', extra: false }; const snap = () => JSON.stringify(st);
  const api = {
    tree: async () => [{ id: 'tv', parent: null, depth: 0, tag: 'div', text: '' }, { id: 'clock', parent: 'tv', depth: 1, tag: 'div', text: st.text }, ...(st.extra ? [{ id: 'n1', parent: 'tv', depth: 1, tag: 'i', text: '' }] : [])],
    edit: async (_f: string, el: string, prop: string, v: string) => { if (el !== 'clock') return { ok: false, ms: 0, before: '' }; const before = st.clock[prop] ?? ''; st.clock[prop] = v; return { ok: true, ms: 0, before }; },
    text: async (_f: string, _e: string, v: string) => { st.text = v; return true; }, add: async () => { st.extra = true; return true; }, remove: async () => false,
    snapshot: async () => snap(), load: async (_f: string, h: string) => { Object.assign(st, JSON.parse(h)); return true; }, outer: async () => '<div id="clock">12:00</div>', props: async () => ({ 'font-size': st.clock['font-size']! }),
  } as unknown as CanvasApi;
  const recorded: Op[] = []; const env: McpEnv = { api, frames: [{ id: 'tv', root: 'tv', title: 'TV', x: 0, y: 0, w: 1, h: 1, html: '' }], selection: { frameId: 'tv', el: 'clock' }, record: (o) => recorded.push(o), undo: async () => true, bump: () => {} };
  return { st, env, recorded };
}
describe('app MCP handler', () => {
  it('a batch is ONE recorded snap op whose before restores everything', async () => {
    const { st, env, recorded } = fake(); const before = JSON.stringify(st);
    const r = await handleMcp(env, 'apply_ops', { ops: [{ op: 'set', id: 'clock', prop: 'font-size', value: '300px' }, { op: 'text', id: 'clock', value: 'now' }, { op: 'add', parent: 'tv', id: 'n1', html: '<i>x</i>' }] }) as { applied: number; undoSteps: number };
    expect(r.applied).toBe(3); expect(r.undoSteps).toBe(1); expect(recorded).toHaveLength(1); const op = recorded[0]!; expect(op.kind).toBe('snap'); if (op.kind === 'snap') { expect(op.before).toBe(before); expect(op.after).not.toBe(before); }
  });
  it('rejects unsafe or unknown ops before touching anything', async () => {
    const { st, env, recorded } = fake(); const before = JSON.stringify(st);
    for (const o of [{ op: 'add', parent: 'tv', id: 'x', html: '<script>1</script>' }, { op: 'add', parent: 'tv', id: 'x', html: '<img onerror=1>' }, { op: 'add', parent: 'tv', id: 'x', html: '<a href="javascript:1">' }, { op: 'set', id: 'nope', prop: 'color', value: 'red' }, { op: 'set', id: 'clock', prop: 'a b', value: 'red' }]) await expect(handleMcp(env, 'apply_ops', { ops: [o] })).rejects.toThrow(/op 0/);
    expect(JSON.stringify(st)).toBe(before); expect(recorded).toHaveLength(0);
  });
  it('a failing op rolls the whole batch back and records nothing', async () => {
    const { st, env, recorded } = fake(); const before = JSON.stringify(st);
    await expect(handleMcp(env, 'apply_ops', { ops: [{ op: 'set', id: 'clock', prop: 'color', value: 'red' }, { op: 'remove', id: 'clock' }] })).rejects.toThrow(/restored/);
    expect(JSON.stringify(st)).toBe(before); expect(recorded).toHaveLength(0);
  });
  it('size caps, bad frame, read_subtree and undo', async () => {
    const { env } = fake(); await expect(handleMcp(env, 'apply_ops', { ops: [] })).rejects.toThrow(/non-empty/);
    await expect(handleMcp(env, 'apply_ops', { ops: Array.from({ length: 201 }, () => ({ op: 'set', id: 'clock', prop: 'color', value: 'red' })) })).rejects.toThrow(/too many/);
    await expect(handleMcp(env, 'apply_ops', { frame: 'zz', ops: [{ op: 'ask', value: 'x' }] })).rejects.toThrow(/unknown frame/);
    const r = await handleMcp(env, 'read_subtree', { props: ['font-size'] }) as { el: string; tree: { id: string }[]; props: Record<string, string> }; expect(r.el).toBe('clock'); expect(r.tree.map((n) => n.id)).toEqual(['clock']); expect(r.props['font-size']).toBe('40px');
    expect(await handleMcp(env, 'undo', {})).toEqual({ undone: true }); await expect(handleMcp(env, 'nope', {})).rejects.toThrow(/unknown tool/);
  });
});

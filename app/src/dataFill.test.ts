import { describe, expect, it } from 'vitest';
import { containerOf, parseTable, planFill } from './dataFill';
import { handleMcp, type McpEnv } from './mcp';
import type { CanvasApi } from './canvas/Canvas';
import type { Op } from './oplog';

const nodes = [
  { id: 'root', parent: null, tag: 'div', text: '' }, { id: 'list', parent: 'root', tag: 'ul', text: '' },
  { id: 'row', parent: 'list', tag: 'li', text: '' }, { id: 'nm', parent: 'row', tag: 'b', text: 'Name' }, { id: 'rl', parent: 'row', tag: 'span', text: 'Role' }, { id: 'ic', parent: 'row', tag: 'i', text: '' },
];
const tpl = '<li id="row" style="display:flex"><b id="nm">Name</b><span id="rl">Role</span><i id="ic"></i></li>';
const table = { columns: ['name', 'role'], rows: [['Ada <b>', 'admin'], ['Bo & "Co"', 'dev']] };

describe('planFill', () => {
  it('maps columns to text leaves in order, escapes cells, suffixes ids per row', () => {
    const p = planFill(nodes, 'list', tpl, table);
    expect(p.remove).toEqual(['row']); expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toBe('<li id="row-r0" style="display:flex"><b id="nm-r0">Ada &lt;b&gt;</b><span id="rl-r0">admin</span><i id="ic-r0"></i></li>');
    expect(p.rows[1]).toContain('Bo &amp; &quot;Co&quot;'); expect(p.rows[1]).toContain('id="nm-r1"'); expect(p.unmapped).toBe(0);
  });
  it('reports columns without a place, and refills over earlier rows without id growth', () => {
    const p = planFill(nodes, 'list', tpl, { columns: ['a', 'b', 'c'], rows: [['1', '2', '3']] }); expect(p.unmapped).toBe(1);
    const again = planFill([{ id: 'list', parent: null, tag: 'ul', text: '' }, { id: 'row-r0', parent: 'list', tag: 'li', text: '' }, { id: 'nm-r0', parent: 'row-r0', tag: 'b', text: 'Ada' }], 'list', '<li id="row-r0"><b id="nm-r0">Ada</b></li>', { columns: ['n'], rows: [['Z']] });
    expect(again.rows[0]).toBe('<li id="row-r0"><b id="nm-r0">Z</b></li>');
  });
  it('refuses a container with no template row or no text', () => {
    expect(() => planFill([{ id: 'list', parent: null, tag: 'ul', text: '' }], 'list', '', table)).toThrow(/no child/);
    expect(() => planFill([{ id: 'list', parent: null, tag: 'ul', text: '' }, { id: 'r', parent: 'list', tag: 'li', text: '' }], 'list', '<li id="r"></li>', table)).toThrow(/no text/);
  });
  it('a table fills its tbody; unknown ids are errors', () => {
    const t = [{ id: 'tb', parent: null, tag: 'table', text: '' }, { id: 'body', parent: 'tb', tag: 'tbody', text: '' }];
    expect(containerOf(t, 'tb')).toBe('body'); expect(containerOf(nodes, 'list')).toBe('list'); expect(() => containerOf(nodes, 'zz')).toThrow(/unknown/);
  });
});
describe('parseTable (the helper is not the only possible sender)', () => {
  it('validates shape and caps', () => {
    expect(() => parseTable({ columns: [], rows: [['a']] })).toThrow(); expect(() => parseTable({ columns: ['a'], rows: [] })).toThrow(/no rows/); expect(() => parseTable({ columns: ['a'], rows: [[1]] })).toThrow(/strings/);
    expect(() => parseTable({ columns: ['a'], rows: Array.from({ length: 201 }, () => ['x']) })).toThrow(/too many/);
    expect(parseTable({ columns: ['a'], rows: [['x'.repeat(500)]] }).rows[0]![0]).toHaveLength(200);
  });
});
function fake(failAdd = false) {
  const st = { rows: ['row'] as string[] }; const api = {
    tree: async () => [{ id: 'root', parent: null, tag: 'div', text: '' }, { id: 'list', parent: 'root', tag: 'ul', text: '' }, ...st.rows.flatMap((r) => [{ id: r, parent: 'list', tag: 'li', text: '' }, { id: `n-${r}`, parent: r, tag: 'b', text: 'x' }])],
    outer: async () => '<li id="row"><b id="n-row">x</b></li>', remove: async (_f: string, id: string) => { st.rows = st.rows.filter((r) => r !== id); return true; },
    add: async (_f: string, _p: string, h: string) => { if (failAdd) return false; st.rows.push(/id="([^"]+)"/.exec(h)![1]!); return true; },
    snapshot: async () => JSON.stringify(st), load: async (_f: string, h: string) => { Object.assign(st, JSON.parse(h)); return true; },
  } as unknown as CanvasApi; const rec: Op[] = [];
  const env: McpEnv = { api, frames: [{ id: 'f', root: 'root', title: 'F', x: 0, y: 0, w: 1, h: 1, html: '' }], selection: null, record: (o) => rec.push(o), undo: async () => true, bump: () => {} }; return { st, env, rec };
}
describe('fill_rows via the app handler', () => {
  it('replaces the rows as one undo step', async () => {
    const { st, env, rec } = fake(); const r = await handleMcp(env, 'fill_rows', { el: 'list', columns: ['n'], rows: [['A'], ['B'], ['C']] }) as { rows: number; undoSteps: number };
    expect(r.rows).toBe(3); expect(r.undoSteps).toBe(1); expect(st.rows).toEqual(['row-r0', 'row-r1', 'row-r2']); expect(rec).toHaveLength(1); expect(rec[0]).toMatchObject({ kind: 'snap' });
  });
  it('a failure restores the frame and records nothing', async () => {
    const { st, env, rec } = fake(true); await expect(handleMcp(env, 'fill_rows', { el: 'list', columns: ['n'], rows: [['A']] })).rejects.toThrow(/restored/); expect(st.rows).toEqual(['row']); expect(rec).toHaveLength(0);
  });
  it('bad input is refused before any edit', async () => {
    const { st, env } = fake(); await expect(handleMcp(env, 'fill_rows', { columns: ['n'], rows: [['A']] })).rejects.toThrow(/el must/); await expect(handleMcp(env, 'fill_rows', { el: 'nope', columns: ['n'], rows: [['A']] })).rejects.toThrow(/unknown/); expect(st.rows).toEqual(['row']);
  });
});

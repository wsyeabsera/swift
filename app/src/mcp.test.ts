import { describe, expect, it } from 'vitest';
import { handleMcp, resetTemplateInstances, type McpEnv } from './mcp';
import type { FrameDef } from './canvas/fixtures';
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
describe('artifact_page', () => {
  it('returns the project as one script-free page, is read-only, and refuses unknown frames', async () => {
    const { env, recorded, st } = fake(); env.project = 'tvdash'; env.frames = [{ id: 'tv', root: 'tv', title: 'TV', x: 0, y: 0, w: 1920, h: 1080, html: '' }, { id: 'ph', root: 'ph', title: 'Phone', x: 0, y: 0, w: 390, h: 844, html: '<i id="ph"></i>' }];
    const before = JSON.stringify(st); const r = (await handleMcp(env, 'artifact_page', {})) as { title: string; frames: number; bytes: number; html: string };
    expect(r.title).toBe('tvdash'); expect(r.frames).toBe(2); expect(r.bytes).toBeGreaterThan(1000); expect(r.html.startsWith('<title>tvdash</title>')).toBe(true); expect(r.html).toContain('attachShadow'); expect((r.html.match(/role="tab"/g) ?? []).length).toBe(2); expect(recorded).toEqual([]); expect(JSON.stringify(st)).toBe(before); // nothing in the design changed
    expect(((await handleMcp(env, 'artifact_page', { frames: ['ph'] })) as { frames: number }).frames).toBe(1); await expect(handleMcp(env, 'artifact_page', { frames: ['ghost'] })).rejects.toThrow(/unknown frame/);
  });
});

describe('read-side MCP tools (#1828)', () => {
  const facts = { w: 1920, h: 1080, nodes: [{ id: 'clock', tag: 'div', x: 400, y: 400, w: 300, h: 60, fs: 20, text: 'tiny', color: { r: 120, g: 120, b: 120, a: 1 }, bg: { r: 125, g: 125, b: 125, image: false }, clipX: false, clipY: false, interactive: false }] };
  function rich(over: Partial<McpEnv> = {}) {
    const { env } = fake(); const api = { ...env.api, audit: async () => facts, snapshot: async () => '<div id="tv" style="width:1920px;height:1080px"><div id="clock">12:00</div></div>' } as unknown as CanvasApi;
    return { ...env, api, brand: { '--ac': '#0a84ff' }, ...over } as McpEnv;
  }
  it('list_frames: ids, names, size and lens', async () => {
    const r = await handleMcp(rich(), 'list_frames', {}) as { frames: { id: string; name: string; lens: string }[] }; expect(r.frames).toEqual([{ id: 'tv', name: 'TV', w: 1, h: 1, lens: 'phone' }]);
  });
  it('check: numbered local findings with element ids and a fix; no Claude unless judge', async () => {
    let asked = 0; const env = rich({ ask: async () => { asked++; return '[]'; } });
    const r = await handleMcp(env, 'check', {}) as { findings: { n: number; el: string; kind: string; fix?: { prop: string } }[]; judged: number }; expect(asked).toBe(0); expect(r.findings.length).toBeGreaterThan(0);
    expect(r.findings.map((x) => x.n)).toEqual(r.findings.map((_, i) => i + 1)); expect(r.findings.every((x) => x.el === 'clock')).toBe(true); expect(r.findings.some((x) => x.kind === 'contrast' && x.fix?.prop === 'color')).toBe(true);
  });
  it('check judge:true adds Claude findings, validated against known ids; errors are returned', async () => {
    const env = rich({ ask: async () => '[{"el":"clock","message":"Too small for the room","fix":{"prop":"font-size","value":"60px"}},{"el":"ghost","message":"x"}]' });
    const r = await handleMcp(env, 'check', { judge: true }) as { findings: { kind: string; n: number }[]; judged: number; rejected: number }; expect(r.judged).toBe(1); expect(r.rejected).toBe(1); expect(r.findings.at(-1)!.kind).toBe('critique'); expect(r.findings.at(-1)!.n).toBe(r.findings.length);
    await expect(handleMcp(rich({ ask: async () => { throw new Error('Claude failed: boom'); } }), 'check', { judge: true })).rejects.toThrow(/boom/);
    await expect(handleMcp(rich(), 'check', { judge: true })).rejects.toThrow(/not available/);
    await expect(handleMcp(rich(), 'check', { judge: 'yes' })).rejects.toThrow(/judge must be/);
    await expect(handleMcp(rich(), 'check', { frame: 'zz' })).rejects.toThrow(/unknown frame/);
    await expect(handleMcp(rich({ api: { ...rich().api, audit: async () => undefined } as unknown as CanvasApi }), 'check', {})).rejects.toThrow(/did not answer/);
  });
  it('export: preview first, full content only with confirm, caps and bad targets refused', async () => {
    const env = rich(); const p = await handleMcp(env, 'export', { target: 'html' }) as { name: string; bytes: number; preview: string; content?: string }; expect(p.name).toBe('tv.html'); expect(p.content).toBeUndefined(); expect(p.preview).toContain('<!doctype html>'); expect(p.bytes).toBeGreaterThan(50);
    const full = await handleMcp(env, 'export', { target: 'html', confirm: true }) as { content: string }; expect(full.content).toContain('id="clock"');
    const tsx = await handleMcp(env, 'export', { target: 'react', confirm: true }) as { name: string; content: string }; expect(tsx.name).toMatch(/\.tsx$/); expect(tsx.content).toContain('export');
    const tok = await handleMcp(env, 'export', { target: 'tokens', confirm: true }) as { content: string }; expect(JSON.parse(tok.content)).toBeTruthy();
    for (const bad of [{}, { target: 'glb' }, { target: 'artifact' }, { target: 7 }, { target: 'html', confirm: 'y' }, { target: 'html', frame: 'zz' }]) await expect(handleMcp(env, 'export', bad)).rejects.toThrow();
    await expect(handleMcp(rich({ brand: {} }), 'export', { target: 'tokens' })).rejects.toThrow(/no brand tokens/);
    await expect(handleMcp(rich({ projectFile: async () => 'x'.repeat(1024 * 1024 + 1) }), 'export', { target: 'project', confirm: true })).rejects.toThrow(/over the/);
    const big = await handleMcp(rich({ projectFile: async () => 'x'.repeat(1024 * 1024 + 1) }), 'export', { target: 'project' }) as { preview: string; truncated: boolean }; expect(big.preview.length).toBeLessThanOrEqual(3000); expect(big.truncated).toBe(true);
  });
  it('frame_html feeds the helper screenshot', async () => { const r = await handleMcp(rich(), 'frame_html', {}) as { frame: string; html: string }; expect(r.frame).toBe('tv'); expect(r.html).toContain('clock'); });
});


describe('templates via MCP (#1834)', () => {
  const manifest = { swiftCanvasTemplate: 1, name: 'Pricing', description: 'A pricing page', slots: [
    { id: 'headline', type: 'text', label: 'Headline', prompt: 'Page headline', default: 'Plans', required: true },
    { id: 'tiers', type: 'list', label: 'Tiers', prompt: 'Tier names', default: ['Free'], required: false },
    { id: 'who', type: 'text', label: 'Customer', prompt: 'Who it is for', default: '', required: true }], tokens: { '--ac': '#0a84ff' },
    frames: [{ id: 'pricing', title: 'Pricing', file: 'main.html', w: 800, h: 600 }] };
  const folder = { files: { 'template.json': JSON.stringify(manifest), 'frames/main.html': '<div id="pricing"><h1 id="h">{{headline}}</h1><p>{{who}}</p><ul>{{tiers}}</ul></div>' } };
  function rig() {
    const { env } = fake(); const loaded: Record<string, string> = {}; const added: FrameDef[] = []; const tokens: Record<string, string> = {}; const recorded: Op[] = [];
    const api = { ...env.api, snapshot: async (f: string) => loaded[f] ?? '<div id="pricing">old</div>', load: async (f: string, h: string) => { if (h.includes('REFUSE')) return false; loaded[f] = h; return true; } } as unknown as CanvasApi;
    const e: McpEnv = { ...env, api, record: (o) => recorded.push(o), builtinTemplates: [{ dir: 'builtin/pricing', folder }], addFrames: (d) => { added.push(...d); }, setBrandToken: (n, v) => { tokens[n] = v; } };
    return { e, loaded, added, tokens, recorded };
  }
  const user = [{ dir: 'u/bad', error: 'template.json too large' }];
  it('list_templates lists good ones and reports bad folders', async () => {
    const { e } = rig(); const r = await handleMcp(e, 'list_templates', { userTemplates: user }) as { templates: { name: string; slots: number; source: string }[]; problems: { error: string }[] };
    expect(r.templates).toMatchObject([{ name: 'Pricing', slots: 3, source: 'builtin' }]); expect(r.problems[0]!.error).toMatch(/too large/);
    await expect(handleMcp(e, 'list_templates', { userTemplates: 'x' })).rejects.toThrow(/list/);
  });
  it('new_from_template: frames + tokens as ONE undo step, required empty slots get placeholders, ids stay unique', async () => {
    resetTemplateInstances(); const { e, added, tokens, recorded } = rig();
    const r = await handleMcp(e, 'new_from_template', { template: 'pricing' }) as { instance: string; slots: { id: string; type: string }[]; frames: { id: string }[] };
    expect(r.slots.map((s) => s.id)).toEqual(['headline', 'tiers', 'who']); expect(added[0]!.html).toContain('[Customer]'); expect(tokens).toEqual({ '--ac': '#0a84ff' });
    expect(recorded).toHaveLength(1); expect(recorded[0]!.kind).toBe('group'); expect(added[0]!.x).toBeGreaterThanOrEqual(121);
    await expect(handleMcp(e, 'new_from_template', { template: 'nope' })).rejects.toThrow(/unknown template/);
    await expect(handleMcp(e, 'new_from_template', { template: 'pricing', values: { zzz: 'x' } })).rejects.toThrow(/unknown slot/);
    await expect(handleMcp(e, 'new_from_template', { template: 'pricing', values: [] })).rejects.toThrow(/object/);
  });
  it('fill_slots: validated, escaped, pack markers, one undo step; bad values change nothing', async () => {
    resetTemplateInstances(); const { e, loaded, recorded } = rig(); const n = await handleMcp(e, 'new_from_template', { template: 'Pricing' }) as { instance: string; frames: { id: string }[] };
    e.frames = [...e.frames, { id: n.frames[0]!.id, root: 'pricing', title: 'Pricing', x: 0, y: 0, w: 800, h: 600, html: '' }]; recorded.length = 0;
    const r = await handleMcp(e, 'fill_slots', { instance: n.instance, values: { headline: 'Vet <b>invoicing</b>', who: '{{people.name}}', tiers: ['Solo', 'Clinic'] } }) as { filled: string[]; undoSteps: number };
    const html = loaded[n.frames[0]!.id]!; expect(r.undoSteps).toBe(1); expect(html).toContain('Vet &lt;b&gt;invoicing'); expect(html).toContain('<li>Clinic</li>'); expect(html).not.toContain('{{'); expect(recorded).toHaveLength(1); expect(recorded[0]!.kind).toBe('group');
    const before = JSON.stringify(loaded);
    await expect(handleMcp(e, 'fill_slots', { values: { headline: 'x', tiers: 'not a list' } })).rejects.toThrow(); await expect(handleMcp(e, 'fill_slots', { values: { who: '{{people.nonsense}}' } })).rejects.toThrow(/who/);
    await expect(handleMcp(e, 'fill_slots', { values: { headline: 'x'.repeat(5000) } })).rejects.toThrow(); await expect(handleMcp(e, 'fill_slots', { values: {} })).rejects.toThrow(/empty/); await expect(handleMcp(e, 'fill_slots', { instance: 'zz', values: { headline: 'x' } })).rejects.toThrow(/unknown instance/);
    expect(JSON.stringify(loaded)).toBe(before); expect(recorded).toHaveLength(1);
  });
  it('fill_slots before new_from_template says so; a refused frame rolls back', async () => {
    resetTemplateInstances(); const { e, loaded } = rig(); await expect(handleMcp(e, 'fill_slots', { values: { headline: 'x' } })).rejects.toThrow(/new_from_template first/);
    const n = await handleMcp(e, 'new_from_template', { template: 'Pricing' }) as { instance: string; frames: { id: string }[] }; e.frames = [...e.frames, { id: n.frames[0]!.id, root: 'pricing', title: 'P', x: 0, y: 0, w: 1, h: 1, html: '' }];
    await expect(handleMcp(e, 'fill_slots', { values: { headline: 'REFUSE' } })).rejects.toThrow(/refused.*nothing changed/); expect(loaded).toEqual({});
  });
});

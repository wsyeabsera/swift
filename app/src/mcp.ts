// App side of the in-app MCP server (#1712): the helper relays tool calls here (`mcp.req`); a batch of ops becomes ONE undo step (a `snap` op in the op log).
// Ops are validated again here with the Say rules (`checkLine`: no script tags, on*=, javascript:, unknown ids), because the helper is not the only possible sender.
import type { CanvasApi, Sel } from './canvas/Canvas';
import type { FrameDef } from './canvas/fixtures';
import { checkLine, type Op as SayOp } from './say/ops';
import type { Op } from './oplog';
import { buildArtifactPage } from './publish';
import { templateFromFrames, templateFromScan, type ScanLike } from './saveTemplate';
export type McpEnv = { project?: string; api: CanvasApi | undefined; frames: FrameDef[]; selection: Sel | null; record: (op: Op) => void; undo: () => Promise<boolean>; bump: () => void };
export const MCP_MAX_OPS = 200; const MAX_NODES = 400; const MAX_HTML = 6000;
const isStr = (v: unknown): v is string => typeof v === 'string';
function pick(env: McpEnv, frame: unknown): FrameDef {
  if (frame !== undefined && frame !== null && !isStr(frame)) throw new Error('frame must be a string');
  const id = isStr(frame) && frame ? frame : env.selection?.frameId ?? env.frames[0]?.id; const f = env.frames.find((x) => x.id === id);
  if (!f) throw new Error(`unknown frame ${String(id)} (frames: ${env.frames.map((x) => x.id).join(', ')})`); return f;
}
async function applyOne(api: CanvasApi, frame: string, root: string, op: SayOp): Promise<boolean> {
  switch (op.op) {
    case 'set': return (await api.edit(frame, op.id, op.prop, op.value)).ok;
    case 'token': return (await api.edit(frame, root, op.name, op.value)).ok;
    case 'text': return api.text(frame, op.id, op.value);
    case 'add': return api.add(frame, op.parent, op.html);
    case 'remove': return api.remove(frame, op.id);
    case 'ask': return true;
  }
}
/** Needs no open canvas tab for a scan; frames come from the env. Returns the template folder's files; the helper writes them to disk. */
function saveTemplate(env: McpEnv, args: Record<string, unknown>): unknown {
  if (!isStr(args.name)) throw new Error('name is required');
  const desc = isStr(args.description) ? args.description : undefined;
  const r = args.scan ? templateFromScan(args.scan as ScanLike, { name: args.name, description: desc }) : templateFromFrames(Array.isArray(args.frames) && args.frames.length ? args.frames.map((id) => pick(env, id)) : [pick(env, args.frame)], { name: args.name, description: desc });
  if (!r.ok) throw new Error(r.error); return { slug: r.slug, name: r.name, slots: r.slots, warnings: r.warnings, files: r.folder.files };
}
export async function handleMcp(env: McpEnv, tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (tool === 'save_template') return saveTemplate(env, args);
  const api = env.api; if (!api) throw new Error('the canvas is not ready');
  switch (tool) {
    case 'tree': { const f = pick(env, args.frame); const t = await api.tree(f.id); return { frame: f.id, tree: t.map((n) => ({ id: n.id, parent: n.parent, tag: n.tag, text: n.text })) }; }
    case 'read_subtree': {
      const f = pick(env, args.frame); const all = await api.tree(f.id); const el = isStr(args.el) && args.el ? args.el : env.selection && env.selection.frameId === f.id ? env.selection.el : f.root;
      if (!all.some((n) => n.id === el)) throw new Error(`unknown element ${el} in frame ${f.id}`);
      const keep = new Set([el]); const nodes = all.filter((n) => { if (n.id === el || (n.parent !== null && keep.has(n.parent))) { keep.add(n.id); return true; } return false; });
      const props = Array.isArray(args.props) ? args.props.filter(isStr).slice(0, 20) : []; const html = await api.outer(f.id, el);
      return { frame: f.id, el, selected: env.selection, frames: env.frames.map((x) => x.id), tree: nodes.slice(0, MAX_NODES).map((n) => ({ id: n.id, parent: n.parent, tag: n.tag, text: n.text.slice(0, 80) })), truncated: nodes.length > MAX_NODES, html: html.slice(0, MAX_HTML), ...(props.length ? { props: await api.props(f.id, el, props) } : {}) };
    }
    case 'apply_ops': {
      const f = pick(env, args.frame); const raw = args.ops; if (!Array.isArray(raw) || raw.length === 0) throw new Error('ops must be a non-empty array'); if (raw.length > MCP_MAX_OPS) throw new Error(`too many ops (max ${MCP_MAX_OPS})`);
      const t0 = performance.now(); const ids = new Set((await api.tree(f.id)).map((n) => n.id)); const ops: SayOp[] = [];
      for (const [i, o] of raw.entries()) { const c = checkLine(JSON.stringify(o), ids); if (!c.ok) throw new Error(`op ${i}: ${c.error}`); ops.push(c.op); }
      const before = await api.snapshot(f.id);
      try { for (const [i, op] of ops.entries()) if (!(await applyOne(api, f.id, f.root, op))) throw new Error(`op ${i} (${op.op}) did not apply`); }
      catch (e) { await api.load(f.id, before); throw new Error(`${e instanceof Error ? e.message : 'failed'}; the frame was restored, nothing changed`); } // all or nothing
      const after = await api.snapshot(f.id); if (after !== before) env.record({ kind: 'snap', frame: f.id, before, after }); env.bump();
      return { frame: f.id, applied: ops.length, undoSteps: after === before ? 0 : 1, ms: Math.round(performance.now() - t0) };
    }
    case 'artifact_page': { // the whole project (or the frames asked for) as one page; nothing in the design changes
      const want = Array.isArray(args.frames) ? args.frames.filter(isStr) : null; const list = want ? env.frames.filter((f) => want.includes(f.id)) : env.frames; if (want && list.length !== new Set(want).size) throw new Error(`unknown frame in ${JSON.stringify(want)} (frames: ${env.frames.map((x) => x.id).join(', ')})`);
      const pageFrames = await Promise.all(list.map(async (f) => ({ id: f.id, title: f.title, w: f.w, h: f.h, html: (await api.snapshot(f.id)) || f.html }))); const r = buildArtifactPage(env.project || 'Swift Canvas project', pageFrames); if (!r.ok) throw new Error(r.error); return { title: env.project || 'Swift Canvas project', frames: r.frames, bytes: r.bytes, html: r.html };
    }
    case 'undo': return { undone: await env.undo() };
    default: throw new Error(`unknown tool ${tool}`);
  }
}

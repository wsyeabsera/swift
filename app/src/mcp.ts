// App side of the in-app MCP server (#1712): the helper relays tool calls here (`mcp.req`); a batch of ops becomes ONE undo step (a `snap` op in the op log).
// Ops are validated again here with the Say rules (`checkLine`: no script tags, on*=, javascript:, unknown ids), because the helper is not the only possible sender.
import type { CanvasApi, Sel } from './canvas/Canvas';
import type { FrameDef } from './canvas/fixtures';
import { checkLine, type Op as SayOp } from './say/ops';
import type { Op } from './oplog';
import { buildArtifactPage } from './publish';
import { surfaceOf } from './canvas/frames';
import { auditFacts } from './canvas/audit';
import { CRITIQUE_SYSTEM, critiquePrompt, parseCritique } from './canvas/critique';
import { exportDoc, exportName } from './canvas/exportHtml';
import { componentName, frameToTsx } from './canvas/exportReact';
import { dtcgString } from './dtcg';
import { isTarget } from './ship';
import { templateFromFrames, templateFromScan, type ScanLike } from './saveTemplate';
import { applyFill, containerOf, parseTable, planFill } from './dataFill';
export type McpEnv = { project?: string; api: CanvasApi | undefined; frames: FrameDef[]; selection: Sel | null; record: (op: Op) => void; undo: () => Promise<boolean>; bump: () => void;
  /** One Claude answer for `check` with judge:true (rejects with the reason; the app's Say connection in production, a fake in tests). */ ask?: (system: string, prompt: string) => Promise<string>; brand?: Record<string, string>; /** The project file text, for export target `project`. */ projectFile?: () => Promise<string> };
export const MCP_MAX_OPS = 200; const MAX_NODES = 400; const MAX_HTML = 6000; export const MCP_MAX_EXPORT = 1024 * 1024; const PREVIEW_LINES = 40; const PREVIEW_CHARS = 3000;
const EXPORT_TARGETS = ['html', 'react', 'tokens', 'project'];
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
    case 'list_frames': return { source: 'open app', project: env.project ?? null, selected: env.selection, frames: env.frames.map((f) => ({ id: f.id, name: f.title, w: f.w, h: f.h, lens: surfaceOf(f) })) };
    case 'frame_html': { const f = pick(env, args.frame); const html = (await api.snapshot(f.id)) || f.html; if (!html) throw new Error(`frame ${f.id} is not ready`); return { frame: f.id, w: f.w, h: f.h, html }; }
    case 'check': { // Critique: the local pre-pass (always), then Claude's judgment only when asked; every finding is numbered and names a known element id
      if (args.judge !== undefined && typeof args.judge !== 'boolean') throw new Error('judge must be true or false');
      const f = pick(env, args.frame); const facts = await api.audit(f.id); if (!facts) throw new Error(`frame ${f.id} did not answer the audit`); const surface = surfaceOf(f); const local = auditFacts(facts, surface);
      let judged: ReturnType<typeof parseCritique> = { findings: [], rejected: 0 };
      if (args.judge === true) {
        if (!env.ask) throw new Error('Claude is not available in the app (check the helper connection); run check without judge for the local checks');
        const text = await env.ask(CRITIQUE_SYSTEM, critiquePrompt(facts, surface === 'tv' ? 'TV screen' : surface === 'phone' ? 'phone screen' : 'desktop screen', local)); judged = parseCritique(text, facts.nodes.map((n) => n.id));
      }
      const all = [...local, ...judged.findings]; return { frame: f.id, surface, local: local.length, judged: judged.findings.length, rejected: judged.rejected, findings: all.map((x, i) => ({ n: i + 1, el: x.el, kind: x.kind, message: x.message, ...(x.fix ? { fix: x.fix } : {}) })) };
    }
    case 'export': { // the Ship board's paths as text; a preview first, the full content only with confirm:true. Nothing is written anywhere.
      const target = args.target; if (!isStr(target) || !isTarget(target) || !EXPORT_TARGETS.includes(target)) throw new Error(`unknown export target ${JSON.stringify(target)} (one of: ${EXPORT_TARGETS.join(', ')})`);
      if (args.confirm !== undefined && typeof args.confirm !== 'boolean') throw new Error('confirm must be true or false');
      let name: string, content: string, f: FrameDef | undefined;
      if (target === 'tokens') { if (!env.brand || !Object.keys(env.brand).length) throw new Error('the project has no brand tokens to export'); name = 'tokens.json'; content = dtcgString(env.brand); }
      else if (target === 'project') { if (!env.projectFile) throw new Error('the project file is not available'); name = `${(env.project || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'}.swiftcanvas.json`; content = await env.projectFile(); }
      else { f = pick(env, args.frame); const html = await api.snapshot(f.id); if (!html) throw new Error(`frame ${f.id} is not ready`); if (target === 'html') { name = exportName(f.title); content = exportDoc(f.title, html); } else { name = `${componentName(f.title)}.tsx`; content = frameToTsx(f.title, html, { tailwind: true, tokens: env.brand ?? {} }); } }
      const bytes = new TextEncoder().encode(content).length; const lines = content.split('\n'); const head = { target, name, ...(f ? { frame: f.id } : {}), bytes, lines: lines.length };
      if (args.confirm === true) { if (bytes > MCP_MAX_EXPORT) throw new Error(`${name} is ${bytes} bytes; over the ${MCP_MAX_EXPORT} byte limit for MCP (export it from the app's Ship board)`); return { ...head, content }; }
      return { ...head, preview: lines.slice(0, PREVIEW_LINES).join('\n').slice(0, PREVIEW_CHARS), truncated: lines.length > PREVIEW_LINES || content.length > PREVIEW_CHARS, next: 'call export again with confirm: true to receive the full content' };
    }
    case 'fill_rows': { // rows of repo data (read + capped by the helper) into a list/table container; ONE undo step, all or nothing
      const f = pick(env, args.frame); if (!isStr(args.el) || !args.el) throw new Error('el must be a container element id'); const t = parseTable(args);
      const nodes = await api.tree(f.id); const container = containerOf(nodes, args.el); const first = nodes.find((n) => n.parent === container);
      if (!first) throw new Error(`${container} has no child to use as the row template: add one example row first`);
      const plan = planFill(nodes, container, await api.outer(f.id, first.id), t); const before = await api.snapshot(f.id);
      try { await applyFill(api, f.id, plan); } catch (e) { await api.load(f.id, before); throw new Error(`${e instanceof Error ? e.message : 'failed'}; the frame was restored, nothing changed`); }
      const after = await api.snapshot(f.id); if (after !== before) env.record({ kind: 'snap', frame: f.id, before, after }); env.bump();
      return { frame: f.id, container, rows: plan.rows.length, columnsUsed: plan.mapped, columnsUnused: plan.unmapped, undoSteps: after === before ? 0 : 1 };
    }
    case 'undo': return { undone: await env.undo() };
    default: throw new Error(`unknown tool ${tool}`);
  }
}

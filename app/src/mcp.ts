// App side of the in-app MCP server (#1712): the helper relays tool calls here (`mcp.req`); a batch of ops becomes ONE undo step (a `snap` op in the op log).
// Ops are validated again here with the Say rules (`checkLine`: no script tags, on*=, javascript:, unknown ids), because the helper is not the only possible sender.
import type { CanvasApi, Sel } from './canvas/Canvas';
import type { FrameDef } from './canvas/fixtures';
import { checkLine, type Op as SayOp } from './say/ops';
import type { Op } from './oplog';
import { buildArtifactPage } from './publish';
import { templateFromFrames, templateFromScan, type ScanLike } from './saveTemplate';
import { surfaceOf } from './canvas/frames';
import { auditFacts } from './canvas/audit';
import { CRITIQUE_SYSTEM, critiquePrompt, parseCritique } from './canvas/critique';
import { exportDoc, exportName } from './canvas/exportHtml';
import { componentName, frameToTsx } from './canvas/exportReact';
import { dtcgString } from './dtcg';
import { isTarget } from './ship';
import { instantiateTemplate, parseTemplate, slotValueError, describeSlots, MAX_SLOTS, type Template, type TemplateFolder } from './template';
import { fillText } from './content/pack';
export type McpEnv = { project?: string; api: CanvasApi | undefined; frames: FrameDef[]; selection: Sel | null; record: (op: Op) => void; undo: () => Promise<boolean>; bump: () => void;
  /** One Claude answer for `check` with judge:true (rejects with the reason; the app's Say connection in production, a fake in tests). */ ask?: (system: string, prompt: string) => Promise<string>; brand?: Record<string, string>; /** The project file text, for export target `project`. */ projectFile?: () => Promise<string>;
  /** Templates (#1834): built-in folders (from the app bundle), a way to add frames to the project and to set brand tokens. The user's own folders arrive per call from the helper (`userTemplates`). */
  builtinTemplates?: { dir: string; folder: TemplateFolder }[]; addFrames?: (defs: FrameDef[]) => void; setBrandToken?: (name: string, value: string) => void };
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

// ---- templates (#1834): Claude Code reads the slots and fills them itself; nothing here calls Claude.
type UserTemplate = { dir: string; files?: Record<string, string>; error?: string };
type Instance = { template: Template; frames: string[]; values: Record<string, unknown>; seed: string };
const instances = new Map<string, Instance>(); let instanceN = 0;
export const resetTemplateInstances = (): void => { instances.clear(); instanceN = 0; };
const MAX_INSTANCES = 50; const MAX_VALUE_KEYS = MAX_SLOTS;
function templateCatalog(env: McpEnv, user: unknown): { byName: Map<string, { t: Template; source: string }>; problems: { source: string; dir: string; error: string }[] } {
  const byName = new Map<string, { t: Template; source: string }>(); const problems: { source: string; dir: string; error: string }[] = [];
  const add = (source: string, dir: string, folder: TemplateFolder) => { const r = parseTemplate(folder); if (!r.ok) { problems.push({ source, dir, error: r.error }); return; } byName.set(r.value.name.toLowerCase(), { t: r.value, source }); };
  for (const b of env.builtinTemplates ?? []) add('builtin', b.dir, b.folder);
  if (user !== undefined && !Array.isArray(user)) throw new Error('userTemplates must be a list');
  for (const u of (user ?? []) as UserTemplate[]) { if (u.error || !u.files) problems.push({ source: 'user', dir: String(u.dir), error: u.error ?? 'no files' }); else add('user', String(u.dir), { files: u.files }); } // user folders shadow built-in ones by name
  return { byName, problems };
}
const slotView = (t: Template) => describeSlots(t).map((s) => ({ id: s.id, type: s.type, label: s.label, prompt: s.prompt, default: s.default, required: s.required }));
/** {{pack.field}} markers inside a value become realistic content (deterministic per instance); unknown markers are errors, never silent lorem. */
function packFill(v: unknown, seed: string): unknown { return typeof v === 'string' ? fillText(v, { seed }) : Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? fillText(x, { seed }) : x)) : v; }
function checkValues(v: unknown, what: string): Record<string, unknown> {
  if (v === undefined || v === null) return {}; if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`${what} must be an object of slot id -> value`);
  const o = v as Record<string, unknown>; if (Object.keys(o).length > MAX_VALUE_KEYS) throw new Error(`too many ${what} (max ${MAX_VALUE_KEYS})`); return o;
}
function fillValues(t: Template, values: Record<string, unknown>, seed: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}; for (const [k, v] of Object.entries(values)) { try { out[k] = packFill(v, seed); } catch (e) { throw new Error(`slot "${k}": ${e instanceof Error ? e.message : String(e)}`); } } void t; return out;
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
    case 'list_templates': {
      const { byName, problems } = templateCatalog(env, args.userTemplates);
      return { templates: [...byName.values()].sort((a, b) => a.t.name.localeCompare(b.t.name)).map(({ t, source }) => ({ name: t.name, description: t.description, source, slots: t.slots.length, frames: t.frames.map((f) => ({ id: f.id, title: f.title, w: f.w, h: f.h })) })), problems, next: 'call new_from_template with a template name to see its slots' };
    }
    case 'new_from_template': { // adds the template's frames (and tokens) to the project, with defaults, as ONE undo step; returns the slots for fill_slots
      if (!isStr(args.template) || !args.template || args.template.length > 80) throw new Error('template must be a template name (see list_templates)');
      if (!env.addFrames) throw new Error('this app cannot add frames from MCP');
      const { byName } = templateCatalog(env, args.userTemplates); const hit = byName.get(args.template.trim().toLowerCase());
      if (!hit) throw new Error(`unknown template ${JSON.stringify(args.template)} (templates: ${[...byName.values()].map((x) => x.t.name).join(', ') || 'none'})`);
      if (instances.size >= MAX_INSTANCES) throw new Error('too many template instances in this session; reload the app');
      const t = hit.t; const given = checkValues(args.values, 'values'); const seed = `t${instanceN + 1}`;
      // required slots without a default get a visible placeholder so the frames can be created now and filled next
      const start: Record<string, unknown> = { ...fillValues(t, given, seed) };
      for (const s of t.slots) if (start[s.id] === undefined && s.required && (s.default === '' || (Array.isArray(s.default) && s.default.length === 0))) { if (s.type === 'text') start[s.id] = `[${s.label}]`; else if (s.type === 'list') start[s.id] = [`[${s.label}]`]; }
      const r = instantiateTemplate(t, start); if (!r.ok) throw new Error(r.error);
      const taken = new Set(env.frames.map((f) => f.id)); const right = env.frames.reduce((m, f) => Math.max(m, f.x + f.w), -120) + 120;
      const defs = r.value.frames.map((f) => { let id = f.id; for (let n = 2; taken.has(id); n++) id = `${f.id}-${n}`; taken.add(id); return { ...f, id, x: f.x + right }; });
      const ops: Op[] = defs.map((d, i) => ({ kind: 'frameAdd', frame: d.id, def: d, index: env.frames.length + i }));
      const tokens = Object.entries(r.value.tokens); if (tokens.length && !env.setBrandToken) throw new Error('this app cannot set brand tokens from MCP');
      for (const [name, value] of tokens) ops.push({ kind: 'brand', name, before: env.brand?.[name] ?? '', after: value });
      env.addFrames(defs); for (const [name, value] of tokens) env.setBrandToken?.(name, value);
      env.record({ kind: 'group', label: `New from template: ${t.name}`, ops }); env.bump();
      const id = `t${++instanceN}`; instances.set(id, { template: t, frames: defs.map((d) => d.id), values: start, seed });
      return { instance: id, template: t.name, frames: defs.map((d) => ({ id: d.id, title: d.title, w: d.w, h: d.h })), tokens: r.value.tokens, slots: slotView(t), undoSteps: 1, next: 'call fill_slots with {instance, values: {slotId: value}} to fill the slots from the brief; then check' };
    }
    case 'fill_slots': { // re-renders the instance's frames with new values (given values over earlier ones); validated first, all-or-nothing, ONE undo step
      const key = isStr(args.instance) && args.instance ? args.instance : [...instances.keys()].at(-1); const inst = key ? instances.get(key) : undefined;
      if (!inst) throw new Error(isStr(args.instance) ? `unknown instance ${JSON.stringify(args.instance)} (instances: ${[...instances.keys()].join(', ') || 'none'})` : 'no template instance yet: call new_from_template first');
      const values = checkValues(args.values, 'values'); if (!Object.keys(values).length) throw new Error('values is empty: pass {slotId: value} (slots: ' + inst.template.slots.map((s) => s.id).join(', ') + ')');
      const filled = fillValues(inst.template, values, inst.seed);
      for (const [k, v] of Object.entries(filled)) { const s = inst.template.slots.find((x) => x.id === k); if (!s) throw new Error(`unknown slot "${k}" (slots: ${inst.template.slots.map((x) => x.id).join(', ')})`); const e = slotValueError(s, v); if (e) throw new Error(e); }
      const merged = { ...inst.values, ...filled }; const r = instantiateTemplate(inst.template, merged); if (!r.ok) throw new Error(r.error);
      const targets = inst.frames.map((id, i) => { const f = env.frames.find((x) => x.id === id); if (!f) throw new Error(`frame ${id} of this template is gone; run new_from_template again`); return { f, html: r.value.frames[i]!.html }; });
      const ops: Op[] = []; const done: { f: FrameDef; before: string }[] = [];
      try {
        for (const { f, html } of targets) { const before = await api.snapshot(f.id); if (!before) throw new Error(`frame ${f.id} is not ready`); if (!(await api.load(f.id, html))) throw new Error(`frame ${f.id} refused the new content`); done.push({ f, before }); ops.push({ kind: 'snap', frame: f.id, before, after: html }); }
      } catch (e) { for (const d of done.reverse()) await api.load(d.f.id, d.before); throw new Error(`${e instanceof Error ? e.message : String(e)} (restored, nothing changed)`); }
      inst.values = merged; env.record({ kind: 'group', label: `Fill slots: ${inst.template.name}`, ops }); env.bump();
      return { instance: key, filled: Object.keys(filled), frames: targets.map((t) => t.f.id), undoSteps: 1, next: 'call check on each frame, then screenshot' };
    }
    case 'undo': return { undone: await env.undo() };
    default: throw new Error(`unknown tool ${tool}`);
  }
}

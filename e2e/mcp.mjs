// In-app MCP server e2e (#1712). Default: a fake MCP client (JSON-RPC over stdio to `swift-canvas-helper mcp`) drives the RUNNING app: read_subtree, a 12-op batch (timed),
// ONE app Undo restores it, bad ops are refused. With --real it also runs the REAL Claude Code (local login, `claude -p --mcp-config ... --strict-mcp-config`, Haiku).
//   node e2e/mcp.mjs [--real] ["one-line prompt"]
import { chromium } from 'playwright-core'; import { spawn, spawnSync } from 'node:child_process'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path'; import net from 'node:net';
import { TEST_URL, viteEnv, TEST } from './env.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); const real = process.argv.includes('--real'); const prompt = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'use the swift tools to make element clock font-size 300px';
const helperBin = `${root}/target/debug/swift-canvas-helper`; const procs = []; const out = { real };
const waitHttp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('timeout ' + url); };
const taken = await new Promise((res) => { const s = net.connect(TEST.helperPort, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); }); if (taken) { console.log('port TEST.helperPort is taken (a stale helper?): kill it first'); process.exit(2); }
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-mcp-e2e-'));
/** A minimal MCP client: newline-delimited JSON-RPC over the child's stdio. */
function mcpClient() {
  const p = spawn(helperBin, ['mcp'], { env: { ...process.env, SWIFT_DATA_DIR: dataDir }, stdio: ['pipe', 'pipe', 'inherit'] }); procs.push(p); let buf = ''; const waiters = new Map(); let n = 0;
  p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; const m = JSON.parse(l); waiters.get(m.id)?.(m); waiters.delete(m.id); } });
  const rpc = (method, params) => new Promise((res) => { const id = ++n; waiters.set(id, res); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  return { rpc, call: async (name, args) => { const r = await rpc('tools/call', { name, arguments: args }); return { isError: !!r.result?.isError, text: r.result?.content?.[0]?.text ?? JSON.stringify(r.error), rpcError: r.error }; }, p };
}
try {
  procs.push(spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: root, env: viteEnv, stdio: 'ignore' })); await waitHttp(TEST_URL);
  procs.push(spawn(helperBin, [], { env: { ...process.env, SWIFT_DEV: '1', SWIFT_DATA_DIR: dataDir }, stdio: 'ignore' })); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ headless: true }); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.goto(TEST_URL);
  await p.waitForFunction(() => window.__swift && /claude/.test(document.querySelector('[data-testid=helper-status]').textContent), null, { timeout: 10000 }); await p.waitForTimeout(500);
  const state = () => p.evaluate(() => Promise.all(['font-size', 'color', 'opacity', 'letter-spacing', 'font-weight', 'line-height', 'padding', 'margin', 'text-shadow', 'width', 'border-radius'].map((k) => window.__swift.get('tv', 'clock', k))).then((a) => JSON.stringify(a)));
  await p.evaluate(() => window.__swift.fitAll()); await p.waitForTimeout(200);
  const pt = await p.evaluate(() => { const v = window.__swift.view(); return { x: v.x + 190 * v.s, y: v.y + 186 * v.s }; }); await p.mouse.click(pt.x, pt.y); await p.waitForSelector('[data-testid=sel]', { timeout: 4000 }); out.selected = (await p.textContent('[data-testid=inspector-id]'))?.trim();
  const undo = async () => { await p.getByTestId('undo').click(); await p.waitForTimeout(400); }; const before = await state(); const fs0 = await p.evaluate(() => window.__swift.get('tv', 'clock', 'font-size')); out.fontSizeBefore = fs0;
  // ---- fake client
  const c = mcpClient(); const init = await c.rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } }); out.protocol = init.result?.protocolVersion;
  out.tools = (await c.rpc('tools/list', {})).result.tools.map((t) => t.name);
  const rd = await c.call('read_subtree', { props: ['font-size'] }); const rdj = JSON.parse(rd.text); out.readSubtree = { el: rdj.el, nodes: rdj.tree.length, fontSize: rdj.props?.['font-size'] };
  const ops = [['font-size', '300px'], ['color', 'rgb(255, 0, 0)'], ['opacity', '0.5'], ['letter-spacing', '2px'], ['font-weight', '900'], ['line-height', '1.5'], ['padding', '8px'], ['margin', '4px'], ['text-shadow', '0 0 4px black'], ['width', '600px'], ['border-radius', '12px']].map(([prop, value]) => ({ op: 'set', id: 'clock', prop, value })); ops.push({ op: 'text', id: 'clock', value: '09:41' }); // 12 ops
  const t0 = Date.now(); const ap = await c.call('apply_ops', { ops }); out.batch12 = { ok: !ap.isError, ms: Date.now() - t0, reply: ap.text.slice(0, 160) }; await p.waitForTimeout(200);
  out.afterBatch = { fontSize: await p.evaluate(() => window.__swift.get('tv', 'clock', 'font-size')), changed: (await state()) !== before };
  await undo(); out.oneUndoRestoresBatch = (await state()) === before;
  const bad = await c.call('apply_ops', { ops: [{ op: 'set', id: 'clock', prop: 'color', value: 'red' }, { op: 'add', parent: 'clock', id: 'x1', html: '<img src=x onerror=alert(1)>' }] }); out.badOpRefused = bad.isError && /bad_html/.test(bad.text) && (await state()) === before;
  const unk = await c.call('apply_ops', { ops: [{ op: 'set', id: 'nope', prop: 'color', value: 'red' }] }); out.unknownIdRefused = unk.isError && /unknown_id/.test(unk.text);
  const tok = await c.call('set_token', { name: '--ac', value: '#ff0000' }); out.setToken = !tok.isError; await undo(); out.tokenUndone = (await state()) === before; c.p.kill();
  // ---- real Claude Code
  if (real) {
    const cfg = path.join(dataDir, 'mcp-config.json'); fs.writeFileSync(cfg, JSON.stringify({ mcpServers: { swift: { command: helperBin, args: ['mcp'], env: { SWIFT_DATA_DIR: dataDir } } } }));
    const t1 = Date.now(); const r = spawnSync('claude', ['-p', '--mcp-config', cfg, '--strict-mcp-config', '--model', 'haiku', '--allowedTools', 'mcp__swift', '--output-format', 'text', prompt], { encoding: 'utf8', timeout: 120000, cwd: dataDir, env: { ...process.env, ANTHROPIC_API_KEY: '' } }); const wall = Date.now() - t1; await p.waitForTimeout(300);
    const after = await p.evaluate(() => window.__swift.get('tv', 'clock', 'font-size')); await undo(); const restored = await p.evaluate(() => window.__swift.get('tv', 'clock', 'font-size'));
    out.realClaude = { prompt, status: r.status, wallMs: wall, reply: (r.stdout || r.stderr || '').trim().slice(0, 300), fontSizeAfter: after, fontSizeAfterOneUndo: restored, changed: after === '300px', undoRestored: restored === fs0 };
  }
  await b.close();
  const f = out; out.pass = f.protocol === '2024-11-05' && ['read_subtree', 'apply_ops', 'set_token', 'undo'].every((t) => f.tools.includes(t)) && f.readSubtree.el === 'clock' && f.batch12.ok && f.batch12.ms < 3000 && f.afterBatch.fontSize === '300px' && f.afterBatch.changed && f.oneUndoRestoresBatch && f.badOpRefused && f.unknownIdRefused && f.setToken && f.tokenUndone && (!real || (f.realClaude.changed && f.realClaude.undoRestored));
  console.log(JSON.stringify(out, null, 1));
} catch (e) { console.log(JSON.stringify({ ...out, pass: false, error: String(e) }, null, 1)); } finally { procs.forEach((x) => x.kill()); process.exit(0); }

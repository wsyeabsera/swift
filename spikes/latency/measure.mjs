// Spike #1707: time Say-like requests through the LOCAL Claude Code (no API key).
// usage: node measure.mjs <variant> [turns]   variants: default | lean
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
const variant = process.argv[2] || 'lean';
const turns = Number(process.argv[3] || 4);
const base = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
  '--model', process.env.MODEL || 'haiku', '--no-session-persistence'];
const lean = ['--tools', '', '--disable-slash-commands', '--strict-mcp-config', '--setting-sources', 'project'];
const args = base.concat(variant === 'lean' ? lean : []);
const t0 = performance.now();
const p = spawn('claude', args, { cwd: process.cwd(), env: { ...process.env, ANTHROPIC_API_KEY: '' }, stdio: ['pipe', 'pipe', 'pipe'] });
let buf = '', cur = null; const rows = [];
let inited = null;
p.stderr.on('data', d => process.stderr.write(d));
p.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    const now = performance.now();
    if (m.type === 'system' && m.subtype === 'init' && inited === null) { inited = now - t0; }
    if (cur && m.type === 'stream_event' && m.event?.type === 'content_block_delta' && cur.first === null) cur.first = now - cur.sent;
    if (m.type === 'result' && cur) { cur.total = now - cur.sent; cur.cost = m.total_cost_usd; rows.push(cur); const done = cur; cur = null; next(done); }
  }
});
let n = 0;
function send() {
  n++; cur = { turn: n, sent: performance.now(), first: null };
  p.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: 'Reply with exactly one word: ok' } }) + '\n');
}
function next() { if (n < turns) send(); else { p.stdin.end(); } }
p.on('close', () => { clearTimeout(killer);
  console.log(`variant=${variant} model=${process.env.MODEL || 'haiku'} init=${inited?.toFixed(0)}ms`);
  for (const r of rows) console.log(`turn ${r.turn}: first token ${r.first?.toFixed(0)} ms, total ${r.total.toFixed(0)} ms, cost $${(r.cost ?? 0).toFixed(4)}`);
  if (!rows.length) console.log('no result rows (check stderr above)'); process.exit(0);
});
send();
var killer = setTimeout(() => { console.error('timeout'); p.kill(); }, 120000);

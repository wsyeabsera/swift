// Does a pre-spawned idle `claude` (a "spare") cut Say latency vs spawning at request time? Real local Claude Code, no API key. node spare.mjs
import { spawn } from 'node:child_process'; import { performance } from 'node:perf_hooks';
const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--include-partial-messages', '--verbose', '--model', 'haiku', '--no-session-persistence', '--tools', '', '--disable-slash-commands', '--strict-mcp-config', '--setting-sources', 'project'];
const SYS = 'You edit UI designs. Reply with ONLY JSON operations, one per line. Op: {"op":"set","id":"<id>","prop":"<css prop>","value":"<v>"}. Tree: <div id="tv"><div id="clock" style="font-size:230px">21:53</div></div>';
const msg = (r) => JSON.stringify({ type: 'user', message: { role: 'user', content: SYS + '\n\nRequest: ' + r } }) + '\n';
function once(spareMs, request) { return new Promise((resolve) => {
  const t0 = performance.now(); const p = spawn('claude', args, { env: { ...process.env, ANTHROPIC_API_KEY: '' }, cwd: '/tmp', stdio: ['pipe', 'pipe', 'ignore'] }); let buf = '', sent = 0, first = null, init = null;
  p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(l); } catch { continue; } const now = performance.now();
    if (m.type === 'system' && m.subtype === 'init' && init === null) init = now - t0;
    if (sent && first === null && m.type === 'stream_event' && m.event?.delta?.text) first = now - sent;
    if (m.type === 'result') { p.stdin.end(); resolve({ initMs: Math.round(init ?? -1), firstTokenMs: Math.round(first ?? -1), totalMs: Math.round(now - sent) }); } } });
  setTimeout(() => { sent = performance.now(); p.stdin.write(msg(request)); }, spareMs); }); }
const out = { cold: [], spare: [] };
for (let i = 0; i < 4; i++) { out.cold.push(await once(0, 'make the clock bigger')); out.spare.push(await once(3000, 'make the clock bigger')); }
console.log(JSON.stringify(out)); process.exit(0);

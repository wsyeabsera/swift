// Spike #1707: Say through an in-process SDK MCP tool (apply_op) vs plain JSON text. Local Claude Code login, no API key. node mcp.mjs
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'; import { z } from 'zod'; import { performance } from 'node:perf_hooks';
const rows = [1,2,3,4,5,6].map(k => `<div id="row${k}" style="padding:12px 0"><span id="row${k}-t" style="font-size:22px">cloudflare/workers-sdk #${16550+k}</span></div>`).join('\n');
const TREE = `<div id="tv" style="width:1920px;height:1080px"><div id="clock" style="font-size:230px">21:53</div><div id="date" style="font-size:34px">Wednesday, 28 October</div><div id="recent" style="width:560px;padding:32px;background:rgba(255,255,255,.12)"><div id="recent-h">RECENT</div>${rows}</div></div>`;
const REQ = ['make the clock bigger', 'make the Recent panel more transparent and the heading blue #0a84ff', 'dim the date and move it right', 'tighten the rows and make the titles 26px', 'hide the row meta text'];
let t0 = 0; const hits = [];
const server = createSdkMcpServer({ name: 'canvas', version: '0.0.1', tools: [tool('apply_op', 'Apply ONE design operation to the selected element tree.', { op: z.enum(['set', 'token']), id: z.string().optional(), prop: z.string().optional(), name: z.string().optional(), value: z.string() }, async (a) => { hits.push(performance.now() - t0); return { content: [{ type: 'text', text: 'applied' }] }; })] });
const options = { model: 'haiku', settingSources: [], tools: [], mcpServers: { canvas: server }, allowedTools: ['mcp__canvas__apply_op'], persistSession: false, includePartialMessages: true, maxTurns: 3, env: { ...process.env, ANTHROPIC_API_KEY: '' },
  systemPrompt: `You edit UI designs ONLY by calling the apply_op tool once per change (several calls allowed, all in one message). Never answer in prose. Element tree:\n${TREE}` };
const out = [];
for (const r of REQ) { hits.length = 0; t0 = performance.now(); let firstDelta = null, total = null, calls = 0;
  for await (const m of query({ prompt: r, options })) { if (m.type === 'stream_event' && m.event?.type === 'content_block_start' && m.event.content_block?.type === 'tool_use') { calls++; if (firstDelta === null) firstDelta = performance.now() - t0; } if (m.type === 'result') total = performance.now() - t0; }
  out.push({ r: r.slice(0, 28), firstToolStartMs: Math.round(firstDelta), firstHandlerMs: Math.round(hits[0] ?? -1), handlerCalls: hits.length, totalMs: Math.round(total) }); console.log(JSON.stringify(out.at(-1))); }
process.exit(0);

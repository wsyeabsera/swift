// Spike #1707: Agent SDK prewarm()/claim vs cold query(), through the local Claude Code login (no API key). node sdk.mjs
import { query, prewarm } from '@anthropic-ai/claude-agent-sdk'; import { performance } from 'node:perf_hooks';
const PROMPT = 'Reply with ONLY one JSON line, no prose: {"op":"set","id":"clock","prop":"font-size","value":"260px"} (the request was: make the clock bigger).';
const options = { model: 'haiku', settingSources: [], tools: [], persistSession: false, includePartialMessages: true, maxTurns: 1, env: { ...process.env, ANTHROPIC_API_KEY: '' } };
async function timeIt(make) { const t0 = performance.now(); const q = make(); let first = null, total = null, text = ''; for await (const m of q) { if (m.type === 'stream_event' && m.event?.type === 'content_block_delta' && m.event.delta?.text) { text += m.event.delta.text; if (first === null) first = performance.now() - t0; } if (m.type === 'result') total = performance.now() - t0; } return { first: Math.round(first), total: Math.round(total), ok: text.includes('"op"') }; }
const rows = { cold: [], prewarmed: [] };
for (let i = 0; i < 3; i++) rows.cold.push(await timeIt(() => query({ prompt: PROMPT, options }))); console.log('cold', JSON.stringify(rows.cold));
for (let i = 0; i < 3; i++) { const t0 = performance.now(); const spare = await prewarm({ options }); const prewarmMs = Math.round(performance.now() - t0); await new Promise(r => setTimeout(r, 2500)); const r = await timeIt(() => spare.claim({ prompt: PROMPT, options: { cwd: process.cwd(), model: 'haiku' } })); r.prewarmMs = prewarmMs; rows.prewarmed.push(r); }
console.log(JSON.stringify(rows)); process.exit(0);

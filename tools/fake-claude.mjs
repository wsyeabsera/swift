#!/usr/bin/env node
// Fake Claude Code for tests: replays a recorded stream-json session (FAKE_FIXTURE=turns.json) with its original timings. No network, no login.
// turns.json = [[{ dt: ms, line: "<one stream-json line>" }, ...], ...]; FAKE_SPEED=20 plays 20x faster. Flags are ignored.
import fs from 'node:fs';
const turns = JSON.parse(fs.readFileSync(process.env.FAKE_FIXTURE, 'utf8')); const speed = Number(process.env.FAKE_SPEED || 1);
const imageIn = (line) => { try { const c = JSON.parse(line)?.message?.content; return Array.isArray(c) && c.some((b) => b.type === 'image' && b.source?.type === 'base64' && b.source.data); } catch { return false; } };
let i = 0, buf = ''; const emit = (l) => process.stdout.write(l + '\n');
emit(JSON.stringify({ type: 'system', subtype: 'init', fake: true }));
process.stdin.on('data', (d) => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, k); buf = buf.slice(k + 1); if (!line.trim()) continue; const img = process.env.FAKE_IMAGE_REPLY && imageIn(line); if (img) { /* a screenshot import: answer with the fixture HTML (a deliberately dirty one), not a recorded turn */ const html = fs.readFileSync(process.env.FAKE_IMAGE_REPLY, 'utf8'); emit(JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: html } } })); emit(JSON.stringify({ type: 'result', is_error: false })); continue; } const t = turns[Math.min(i, turns.length - 1)] ?? []; i++; for (const e of t) setTimeout(() => emit(e.line), e.dt / speed); } });
process.stdin.on('end', () => setTimeout(() => process.exit(0), 500));

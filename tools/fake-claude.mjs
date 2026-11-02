#!/usr/bin/env node
// Fake Claude Code for tests: replays a recorded stream-json session (FAKE_FIXTURE=turns.json) with its original timings. No network, no login.
// turns.json = [[{ dt: ms, line: "<one stream-json line>" }, ...], ...]; FAKE_SPEED=20 plays 20x faster. Flags are ignored.
import fs from 'node:fs';
const turns = JSON.parse(fs.readFileSync(process.env.FAKE_FIXTURE, 'utf8')); const speed = Number(process.env.FAKE_SPEED || 1);
let i = 0, buf = ''; const emit = (l) => process.stdout.write(l + '\n');
emit(JSON.stringify({ type: 'system', subtype: 'init', fake: true }));
process.stdin.on('data', (d) => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, k); buf = buf.slice(k + 1); if (!line.trim()) continue; const t = turns[Math.min(i, turns.length - 1)] ?? []; i++; for (const e of t) setTimeout(() => emit(e.line), e.dt / speed); } });
process.stdin.on('end', () => setTimeout(() => process.exit(0), 500));

#!/usr/bin/env node
// Fake Claude Code for error scenarios (e2e/fake-errors.mjs). The behavior is read from FAKE_MODE_FILE ({mode, n}) when each user message
// arrives (spares are prewarmed before a scenario picks its mode); n counts messages so the repair turn can differ from the first.
import fs from 'node:fs';
const f = process.env.FAKE_MODE_FILE; const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const delta = (text) => emit({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } });
const OK = '{"op":"set","id":"clock","prop":"font-size","value":"222px"}\n';
emit({ type: 'system', subtype: 'init', fake: true }); let buf = '';
process.stdin.on('data', (d) => { buf += d; if (!buf.includes('\n')) return; buf = '';
  const st = JSON.parse(fs.readFileSync(f, 'utf8')); fs.writeFileSync(f, JSON.stringify({ ...st, n: st.n + 1 }));
  switch (st.mode) {
    case 'exit': process.exit(0); break;
    case 'limit': emit({ type: 'result', subtype: 'success', is_error: true, result: 'Claude AI usage limit reached|1799999999' }); break;
    case 'mixed': if (st.n === 0) { delta(OK); delta('this is not json\n'); } else delta('still not json\n'); emit({ type: 'result', is_error: false }); break;
    case 'kill': delta(OK); setTimeout(() => process.kill(process.pid, 'SIGKILL'), 150); break;
    default: delta(OK); emit({ type: 'result', is_error: false });
  }
});
process.stdin.on('end', () => process.exit(0));

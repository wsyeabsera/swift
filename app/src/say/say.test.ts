import { expect, test, vi } from 'vitest';
import type { CanvasApi } from '../canvas/Canvas';
import { checkLine, LineSplitter } from './ops';
import { buildSystemPrompt, MAX_TREE, trimTree } from './prompt';
import { isRepairable, runSay, runSayRepairing, type SayEvent } from './say';
const ids = () => new Set(['tv', 'clock', 'recent']);
test('valid ops pass, unknown ids and bad fields are rejected', () => {
  expect(checkLine('{"op":"set","id":"clock","prop":"font-size","value":"260px"}', ids()).ok).toBe(true);
  expect(checkLine('{"op":"set","id":"nope","prop":"color","value":"red"}', ids())).toEqual({ ok: false, error: 'unknown id nope' });
  expect(checkLine('{"op":"set","id":"clock","prop":"font size; x","value":"1"}', ids()).ok).toBe(false);
  expect(checkLine('{"op":"token","name":"--ac","value":"#0a84ff"}', ids()).ok).toBe(true); expect(checkLine('{"op":"token","name":"ac","value":"x"}', ids()).ok).toBe(false);
  expect(checkLine('prose', ids()).ok).toBe(false); expect(checkLine('{"op":"boom"}', ids()).ok).toBe(false); expect(checkLine('[1]', ids()).ok).toBe(false);
  expect(checkLine('{"op":"ask","value":"Which photo?"}', ids()).ok).toBe(true); expect(checkLine('{"op":"ask","value":""}', ids()).ok).toBe(false);
});
test('add: needs an existing parent, a fresh id and safe html; the new id becomes usable', () => {
  const s = ids();
  expect(checkLine('{"op":"add","parent":"tv","id":"qr","html":"<div id=\\"qr\\"></div>"}', s).ok).toBe(true); expect(s.has('qr')).toBe(true);
  expect(checkLine('{"op":"add","parent":"tv","id":"qr","html":"<div></div>"}', s).ok).toBe(false); // duplicate
  expect(checkLine('{"op":"add","parent":"zzz","id":"a","html":"<div></div>"}', s).ok).toBe(false);
  for (const evil of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<a href="javascript:alert(1)">x</a>']) expect(checkLine(JSON.stringify({ op: 'add', parent: 'tv', id: 'e' + evil.length, html: evil }), s).ok).toBe(false);
});
test('line splitter handles chunks that cut lines in half', () => {
  const sp = new LineSplitter(); expect(sp.push('{"a":1}\n{"b"')).toEqual(['{"a":1}']); expect(sp.push(':2}\n\n{"c":3}')).toEqual(['{"b":2}']); expect(sp.flush()).toEqual(['{"c":3}']); expect(sp.flush()).toEqual([]);
});
test('prompt carries ids, tokens and a truncated tree', () => {
  const p = buildSystemPrompt({ tokens: { '--ac': '#0a84ff' }, ids: ['tv', 'clock'], tree: '<div id="tv"></div>' }); expect(p).toContain('--ac #0a84ff'); expect(p).toContain('tv, clock'); expect(p).toContain('<div id="tv"></div>'); expect(p).toContain('"op":"ask"');
  expect(trimTree('x'.repeat(MAX_TREE + 10)).endsWith('<!-- truncated -->')).toBe(true);
});
const fakeApi = () => { const calls: string[] = []; const api = {
  snapshot: vi.fn(async () => { calls.push('snapshot'); return '<div id="tv"></div>'; }), tree: vi.fn(async () => [{ id: 'tv', parent: null, depth: 0, tag: 'div', text: '' }, { id: 'clock', parent: 'tv', depth: 1, tag: 'div', text: '21:53' }]),
  edit: vi.fn(async (_f: string, el: string, prop: string, v: string) => { calls.push(`edit ${el} ${prop}=${v}`); return { ok: true, ms: 1, before: '' }; }), text: vi.fn(async () => true), add: vi.fn(async () => true), remove: vi.fn(async () => true) } as unknown as CanvasApi; return { api, calls }; };
test('runSay streams: applies good ops as lines complete, records rejects and asks, snapshots first', async () => {
  const { api, calls } = fakeApi(); let t = 0;
  const send = (_s: string, _r: string, on: (e: SayEvent) => void) => { setTimeout(() => { on({ kind: 'delta', text: '{"op":"set","id":"clock","prop":"font-size","value":"300px"}\n{"op":"set","id":"ghost","prop"' }); on({ kind: 'delta', text: ':"color","value":"red"}\n{"op":"token","name":"--ac","value":"#30d158"}\n{"op":"ask","value":"Which colour?"}' }); on({ kind: 'done' }); }, 0); };
  const r = await runSay({ api, send, frameId: 'tv', root: 'tv', request: 'make the clock bigger', now: () => t++ });
  expect(calls[0]).toBe('snapshot'); expect(calls.slice(1)).toEqual(['edit clock font-size=300px', 'edit tv --ac=#30d158']);
  expect(r.applied.length).toBe(2); expect(r.rejected).toEqual([{ line: '{"op":"set","id":"ghost","prop":"color","value":"red"}', error: 'unknown id ghost' }]); expect(r.asked).toEqual(['Which colour?']); expect(r.firstMs).not.toBeNull(); expect(r.snapshot).toBe('<div id="tv"></div>');
});
test('a transport error ends the Say cleanly and keeps what was applied', async () => {
  const { api } = fakeApi(); const send = (_s: string, _r: string, on: (e: SayEvent) => void) => { on({ kind: 'delta', text: '{"op":"set","id":"clock","prop":"opacity","value":"0.5"}\n' }); on({ kind: 'error', text: 'claude exited' }); };
  const r = await runSay({ api, send, frameId: 'tv', root: 'tv', request: 'x' }); expect(r.error).toBe('claude exited'); expect(r.applied.length).toBe(1);
});

test('one repair turn for malformed lines; unknown ids are not retried', async () => {
  const { api, calls } = fakeApi(); const requests: string[] = []; let turn = 0;
  const send = (_s: string, request: string, on: (e: SayEvent) => void) => { requests.push(request); const first = turn++ === 0; setTimeout(() => { on({ kind: 'delta', text: first ? '{"op":"set","id":"clock","prop":"font size","value":"300px"}\n{"op":"set","id":"ghost","prop":"color","value":"red"}\n' : '{"op":"set","id":"clock","prop":"font-size","value":"300px"}\n' }); on({ kind: 'done' }); }, 0); };
  const r = await runSayRepairing({ api, send, frameId: 'tv', root: 'tv', request: 'bigger' });
  expect(requests.length).toBe(2); expect(requests[1]).toContain('bad property'); expect(requests[1]).not.toContain('ghost'); expect(calls.filter((c) => c.startsWith('edit'))).toEqual(['edit clock font-size=300px']);
  expect(r.repaired).toBe(1); expect(r.rejected.map((x) => x.error)).toEqual(['unknown id ghost']); expect(isRepairable('unknown id x')).toBe(false); expect(isRepairable('not JSON')).toBe(true);
});
test('no repair turn when nothing is repairable', async () => {
  const { api } = fakeApi(); let n = 0; const send = (_s: string, _r: string, on: (e: SayEvent) => void) => { n++; on({ kind: 'delta', text: '{"op":"set","id":"ghost","prop":"color","value":"red"}\n' }); on({ kind: 'done' }); };
  const r = await runSayRepairing({ api, send, frameId: 'tv', root: 'tv', request: 'x' }); expect(n).toBe(1); expect(r.repaired).toBe(0);
});

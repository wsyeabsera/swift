import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { BRIDGE_SCRIPT, FRAME_JS, frameDoc, FrameBridge, isReply } from './bridge';
test('frame doc contains the design and the bridge, and only listens to its parent', () => {
  const d = frameDoc('<div id="a"></div>'); expect(d).toContain('<div id="a"></div>'); expect(d).toContain(BRIDGE_SCRIPT); expect(BRIDGE_SCRIPT).toContain('e.source !== parent');
});
test('isReply accepts only well-formed replies', () => { expect(isReply({ t: 'reply', rid: 1, ok: true })).toBe(true); expect(isReply({ t: 'edit', rid: 1 })).toBe(false); expect(isReply(null)).toBe(false); expect(isReply({ t: 'reply' })).toBe(false); });
test('request resolves with the matching reply and ignores other sources', async () => {
  const win = { postMessage: vi.fn() } as unknown as Window; const other = {} as Window; const b = new FrameBridge(() => win);
  const p = b.request({ t: 'get', el: 'clock', prop: 'font-size' }); const sent = (win.postMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { rid: number };
  b.handle({ source: other, data: { t: 'reply', rid: sent.rid, ok: true, value: 'evil' } } as unknown as MessageEvent);
  b.handle({ source: win, data: { t: 'reply', rid: sent.rid, ok: true, value: '230px' } } as unknown as MessageEvent);
  expect((await p).value).toBe('230px');
});
test('a frame that never answers times out instead of hanging', async () => {
  const b = new FrameBridge(() => ({ postMessage: () => {} }) as unknown as Window, 20); expect((await b.request({ t: 'hit', x: 1, y: 1 })).ok).toBe(false);
  expect((await new FrameBridge(() => null).request({ t: 'hit', x: 0, y: 0 })).ok).toBe(false);
});
test('the extension frame script is the same file as the inline bridge (no drift)', () => { expect(FRAME_JS).toContain("m.t === 'load'"); expect(BRIDGE_SCRIPT).toContain(FRAME_JS); expect(readFileSync('extension/frame.js', 'utf8')).toBe(FRAME_JS); });

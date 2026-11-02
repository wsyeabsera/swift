import { expect, test } from 'vitest';
import { addItem, loadLibrary, MAX_HTML, MAX_ITEMS, sanitizeLibrary, saveLibrary, uniquifyIds } from './library';
test('items are added newest first with unique ids per origin/name', () => {
  let r = addItem([], 'clock', 'tvdash', '<div id="clock">21:53</div>'); expect(r.ok).toBe(true); if (!r.ok) return; r = addItem(r.list, 'clock', 'tvdash', '<div id="clock">22:00</div>'); if (!r.ok) throw new Error('x');
  expect(r.list.map((i) => i.id)).toEqual(['tvdash:clock#2', 'tvdash:clock']); expect(r.list[0]!.html).toContain('22:00');
});
test('empty and oversized elements are refused with a reason; the list caps at 50', () => {
  expect(addItem([], 'x', 'p', '  ')).toEqual({ ok: false, error: 'nothing to save' }); const big = addItem([], 'x', 'p', 'a'.repeat(MAX_HTML + 1)); expect(big.ok).toBe(false); expect(!big.ok && big.error).toMatch(/too large/);
  let list: ReturnType<typeof sanitizeLibrary> = []; for (let i = 0; i < MAX_ITEMS + 5; i++) { const r = addItem(list, `e${i}`, 'p', '<b>x</b>'); if (r.ok) list = r.list; } expect(list.length).toBe(MAX_ITEMS); expect(list[0]!.name).toBe(`e${MAX_ITEMS + 4}`);
});
test('inserted ids never collide with the target frame or with each other', () => {
  expect(uniquifyIds('<div id="card"><span id="t">a</span><span id="t">b</span></div>', new Set(['card', 'x']))).toBe('<div id="card-2"><span id="t">a</span><span id="t-2">b</span></div>'); expect(uniquifyIds('<p>no ids</p>', new Set(['a']))).toBe('<p>no ids</p>');
});
test('storage: round trip; junk entries dropped; corrupt and throwing storage are safe', () => {
  const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; const items = [{ id: 'a:b', name: 'b', origin: 'a', html: '<i>x</i>' }];
  expect(saveLibrary(items, st)).toBeNull(); expect(loadLibrary(st)).toEqual(items); expect(sanitizeLibrary([...items, { id: 'a:b', name: 'dup', origin: 'a', html: 'x' }, { id: 5 }, null, { id: 'c', name: 'c', origin: 'a', html: '' }])).toEqual(items);
  m['swift-canvas.library.v1'] = '{bad'; expect(loadLibrary(st)).toEqual([]); expect(loadLibrary({ getItem: () => { throw new Error('b'); } })).toEqual([]); expect(saveLibrary(items, { setItem: () => { throw new Error('quota'); } })).toBe('quota');
});
test('the origin brand tokens travel with the item (validated), so another project can re-theme it', () => {
  const r = addItem([], 'card', 'radar', '<div id="card">x</div>', { '--bg': '#fff', '--bad': 'red; x:y' }); expect(r.ok && r.list[0]!.tokens).toEqual({ '--bg': '#fff' }); expect(addItem([], 'a', 'p', '<b/>').ok).toBe(true);
  const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; if (r.ok) { saveLibrary(r.list, st); expect(loadLibrary(st)[0]!.tokens).toEqual({ '--bg': '#fff' }); }
});
import { filterItems, origins, removeItem } from './library';
test('remove, origins and filter', () => {
  const l = [{ id: 'a:x', name: 'x', origin: 'a', html: '<b/>' }, { id: 'b:y', name: 'y', origin: 'b', html: '<b/>' }, { id: 'a:z', name: 'z', origin: 'a', html: '<b/>' }];
  expect(origins(l)).toEqual(['a', 'b']); expect(filterItems(l, 'a').map((i) => i.name)).toEqual(['x', 'z']); expect(filterItems(l, null)).toBe(l); expect(filterItems(l, 'nope')).toEqual([]); expect(removeItem(l, 'b:y').map((i) => i.id)).toEqual(['a:x', 'a:z']); expect(removeItem(l, 'zzz')).toEqual(l);
});

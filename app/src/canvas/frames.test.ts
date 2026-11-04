import { expect, test } from 'vitest';
import { duplicateFrame, duplicateId, newFrame, renameFrame, surfaceOf } from './frames';
import { makeFrames } from './fixtures';
test('a duplicate lands right of every frame, keeps size, root and the given html', () => {
  const f = makeFrames(20); const base = f[0]!; const d = duplicateFrame(f, base, 'tv-d1', '<div id="tv">x</div>'); const right = Math.max(...f.map((x) => x.x + x.w));
  expect(d.x).toBeGreaterThan(right); expect(d.y).toBe(base.y); expect([d.w, d.h, d.root, d.html]).toEqual([base.w, base.h, base.root, '<div id="tv">x</div>']); expect(d.title).toBe('TV · Idle 1920×1080 copy');
});
test('ids: smallest free number, duplicates of duplicates share the stem', () => {
  const f = makeFrames(3); expect(duplicateId(f, 'tv')).toBe('tv-d1'); const g = [...f, { ...f[0]!, id: 'tv-d1' }, { ...f[0]!, id: 'tv-d3' }]; expect(duplicateId(g, 'tv')).toBe('tv-d2'); expect(duplicateId(g, 'tv-d1')).toBe('tv-d2');

});
test('rename trims, caps, ignores empty or unknown, and returns the same array when nothing changes', () => {
  const f = makeFrames(3); expect(renameFrame(f, 'tv', '  Hero  ')[0]!.title).toBe('Hero'); expect(renameFrame(f, 'tv', 'x'.repeat(80))[0]!.title.length).toBe(60);
  expect(renameFrame(f, 'tv', '   ')).toBe(f); expect(renameFrame(f, 'nope', 'x')).toBe(f); expect(renameFrame(f, 'tv', f[0]!.title)).toBe(f); expect(renameFrame(f, 'tv', 'Hero')[1]).toBe(f[1]);
});
test('new frames: preset size, unique ids, root id equals frame id, placed right of everything', () => {
  const f = makeFrames(3); const a = newFrame(f, 'phone'); expect([a.id, a.root, a.w, a.h]).toEqual(['phone-1', 'phone-1', 390, 844]); expect(a.html).toContain('id="phone-1"'); expect(a.html).toContain('width:390px');
  const b = newFrame([...f, a], 'phone'); expect(b.id).toBe('phone-2'); expect(b.x).toBeGreaterThan(a.x + a.w); expect(newFrame([], 'tv')).toMatchObject({ id: 'tv-1', x: 0, y: 0, w: 1920 });
});
test('surfaceOf: the preset in the id wins (a 360px popup is not a phone), else the width decides', () => {
  expect(surfaceOf({ id: 'popup-1', w: 360 })).toBe('desktop'); expect(surfaceOf({ id: 'email-2', w: 600 })).toBe('desktop'); expect(surfaceOf({ id: 'phone-1', w: 390 })).toBe('phone'); expect(surfaceOf({ id: 'tv-3', w: 1920 })).toBe('tv'); expect(surfaceOf({ id: 'browser-1', w: 1440 })).toBe('desktop');
  expect(surfaceOf({ id: 'cap-1', w: 375 })).toBe('phone'); expect(surfaceOf({ id: 'cap-2', w: 1920 })).toBe('tv'); expect(surfaceOf({ id: 'weird-9', w: 800 })).toBe('desktop'); expect(surfaceOf({ id: 'tv', w: 1920 })).toBe('tv');
  expect(newFrame([], 'popup')).toMatchObject({ id: 'popup-1', w: 360, h: 520 }); expect(newFrame([], 'email')).toMatchObject({ id: 'email-1', w: 600 });
});

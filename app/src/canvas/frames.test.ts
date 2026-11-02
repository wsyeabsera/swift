import { expect, test } from 'vitest';
import { duplicateFrame, duplicateId, renameFrame } from './frames';
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

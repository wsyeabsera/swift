import { expect, test } from 'vitest';
import { addRef, dominantColors, loadMoodboard, MAX_DATA_URL, MAX_REFS, moodboardPrompt, removeRef, sanitizeMoodboard, saveMoodboard } from './moodboard';
const IMG = 'data:image/png;base64,AAAA';
const px = (...c: [number, number, number, number?][]) => new Uint8ClampedArray(c.flatMap(([r, g, b, a]) => [r, g, b, a ?? 255]));
test('addRef: appends, unique ids; full board, oversized and non-image refused with a reason', () => {
  let r = addRef([], { name: 'a', dataUrl: IMG, note: ' warm ' }); expect(r.ok).toBe(true); if (!r.ok) return; r = addRef(r.board, { name: 'a' }); if (!r.ok) throw new Error('x'); expect(r.board.map((x) => x.id)).toEqual(['a', 'a#2']); expect(r.board[0]!.note).toBe('warm');
  const big = addRef([], { name: 'b', dataUrl: 'data:image/png;base64,' + 'A'.repeat(MAX_DATA_URL) }); expect(!big.ok && big.error).toMatch(/too large/);
  expect(addRef([], { name: 'b', dataUrl: 'data:text/html;base64,AAAA' }).ok).toBe(false);
  let full: ReturnType<typeof sanitizeMoodboard> = []; for (let i = 0; i < MAX_REFS; i++) { const x = addRef(full, { name: `r${i}` }); if (x.ok) full = x.board; } expect(full.length).toBe(MAX_REFS); const f = addRef(full, { name: 'z' }); expect(!f.ok && f.error).toMatch(/full/); expect(removeRef(full, 'r0').length).toBe(MAX_REFS - 1);
});
test('sanitize: junk dropped per entry, bad colors/images stripped, capped, deduped', () => {
  const raw = [null, 5, { id: 'a', name: 'A', colors: ['#FF0000', 'red', '#ff0000', 3], dataUrl: 'javascript:alert(1)' }, { id: 'a', name: 'dup', colors: [] }, { id: '', name: 'x', colors: [] }, ...Array.from({ length: 20 }, (_, i) => ({ id: `i${i}`, name: 'n', colors: [] }))];
  const b = sanitizeMoodboard(raw); expect(b.length).toBe(MAX_REFS); expect(b[0]).toEqual({ id: 'a', name: 'A', colors: ['#ff0000'] }); expect(sanitizeMoodboard('x')).toEqual([]);
});
test('storage: per-project round trip; corrupt, missing and throwing storage are safe', () => {
  const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; const board = [{ id: 'a', name: 'A', dataUrl: IMG, colors: ['#112233'] }];
  expect(saveMoodboard('p1', board, st)).toBeNull(); expect(loadMoodboard('p1', st)).toEqual(board); expect(loadMoodboard('p2', st)).toEqual([]);
  m['swift-canvas.moodboard.v1.bad'] = '{nope'; expect(loadMoodboard('bad', st)).toEqual([]); expect(loadMoodboard('p', undefined)).toEqual([]);
  const boom = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('quota'); } }; expect(loadMoodboard('p', boom)).toEqual([]); expect(saveMoodboard('p', board, boom)).toBe('quota'); expect(saveMoodboard('p', board, undefined)).toBe('storage unavailable');
});
test('moodboardPrompt: notes + colors, never image bytes; empty board -> empty string', () => {
  expect(moodboardPrompt([])).toBe(''); const p = moodboardPrompt([{ id: 'a', name: 'Poster', dataUrl: IMG, note: 'bold\nserif', colors: ['#ff0000', '#00ff00'] }, { id: 'b', name: 'Tile', colors: ['#ff0000'] }]);
  expect(p).toContain('1. Poster: bold serif (colors #ff0000 #00ff00)'); expect(p).toContain('Overall palette: #ff0000 #00ff00'); expect(p).not.toContain('base64'); expect(p.length).toBeLessThan(600);
});
test('dominantColors: frequency order, merges near shades, ignores transparent, handles k and empty', () => {
  const pixels = px(...Array.from({ length: 6 }, () => [250, 0, 0] as [number, number, number]), ...Array.from({ length: 3 }, () => [0, 0, 250] as [number, number, number]), [255, 255, 255, 0], [250, 3, 2]);
  expect(dominantColors(pixels, 3)).toEqual(['#fa0000', '#0000fa']); expect(dominantColors(pixels, 1)).toEqual(['#fa0000']);
  expect(dominantColors(new Uint8ClampedArray(0), 4)).toEqual([]); expect(dominantColors(pixels, 0)).toEqual([]); expect(dominantColors(px([255, 255, 255, 0]), 2)).toEqual([]);
});
import { parseTypeCue, setNote } from './moodboard';
test('type cues: markdown and quotes stripped, long answers cut at a sentence, empty is null', () => {
  expect(parseTypeCue('  **A grotesque sans**, `light` weight,\nwide tracking.  ')).toBe('A grotesque sans, light weight, wide tracking.'); expect(parseTypeCue('"Mono, all caps."')).toBe('Mono, all caps.'); expect(parseTypeCue('  ')).toBeNull();
  const long = 'A high-contrast serif with sharp hairlines and tight leading. ' + 'It pairs with a neutral grotesque for captions and labels across the page and more words follow. '.repeat(3); const cue = parseTypeCue(long)!; expect(cue.length).toBeLessThanOrEqual(201); expect(cue.endsWith('.')).toBe(true); expect(parseTypeCue('x'.repeat(300))!.length).toBeLessThanOrEqual(201);
});
test('setNote changes one ref and leaves the rest; an unknown id changes nothing', () => {
  const b = [{ id: 'a', name: 'a', colors: [] }, { id: 'b', name: 'b', colors: [] }]; expect(setNote(b, 'b', 'Mono')).toEqual([b[0], { ...b[1], note: 'Mono' }]); expect(setNote(b, 'zz', 'x')).toBe(b); expect(setNote(b, 'a', 'y'.repeat(999))[0]!.note!.length).toBe(300);
});

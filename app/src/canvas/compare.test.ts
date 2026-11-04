import { expect, test } from 'vitest';
import { compareSet, diffSigs, mixEdits, originalId } from './compare';
import { makeFrames } from './fixtures';
test('original ids of takes and duplicates', () => { expect(originalId('tv-t3')).toBe('tv'); expect(originalId('tv-d12')).toBe('tv'); expect(originalId('phone-1-t2')).toBe('phone-1'); expect(originalId('tv')).toBeNull(); expect(originalId('x0')).toBeNull(); expect(originalId('phone-1')).toBeNull(); });
test('compare needs both frames to exist', () => { const f = makeFrames(3); const t = { ...f[0]!, id: 'tv-t1' }; expect(compareSet([...f, t], 'tv-t1')).toEqual(['tv', 'tv-t1']); expect(compareSet(f, 'tv-t1')).toBeNull(); expect(compareSet([t], 'tv-t1')).toBeNull(); expect(compareSet(f, 'tv')).toBeNull(); });

test('diffSigs lists changed properties, text, added and removed elements; identical designs have no changes', () => {
  const a = { r: { style: 'color:red;width:10px', text: '' }, t: { style: '', text: 'hi' }, gone: { style: '', text: '' } }; const b = { r: { style: 'width:12px; color: red', text: '' }, t: { style: '', text: 'yo' }, fresh: { style: '', text: '' } };
  expect(diffSigs(a, b)).toEqual([{ el: 'r', kind: 'changed', props: ['width'] }, { el: 't', kind: 'changed', props: ['text'] }, { el: 'gone', kind: 'removed', props: [] }, { el: 'fresh', kind: 'added', props: [] }]);
  expect(diffSigs(a, a)).toEqual([]);
});
test('mixEdits: a keeps its changes, b adds what a left alone, same-property clashes go to a and are counted', () => {
  const o = { r: { style: 'color:red;width:10px', text: 'x' }, c: { style: 'font-size:20px', text: '' }, d: { style: '', text: '' } };
  const a = { r: { style: 'color:blue;width:10px', text: 'x' }, c: { style: 'font-size:20px', text: '' }, d: { style: '', text: '' } };
  const b = { r: { style: 'color:green;width:30px', text: 'y' }, c: { style: 'font-size:40px', text: '' }, d: { style: 'opacity:.5', text: '' }, extra: { style: '', text: '' } };
  expect(mixEdits(o, a, b)).toEqual({ edits: [{ el: 'r', prop: 'width', value: '30px' }, { el: 'r', text: 'y' }, { el: 'c', prop: 'font-size', value: '40px' }, { el: 'd', prop: 'opacity', value: '.5' }], conflicts: 1, skipped: 1 });
  expect(mixEdits(o, a, a)).toEqual({ edits: [], conflicts: 0, skipped: 0 }); expect(mixEdits(o, a, { r: b.r }).skipped).toBe(2); // elements b lacks are skipped
  const same = { r: { style: 'color:blue', text: 'x' } }; expect(mixEdits({ r: { style: 'color:red', text: 'x' } }, same, same).conflicts).toBe(0); // both made the same change: nothing to do, no conflict
});

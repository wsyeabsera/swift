import { expect, test } from 'vitest';
import { compareSet, diffSigs, originalId } from './compare';
import { makeFrames } from './fixtures';
test('original ids of takes and duplicates', () => { expect(originalId('tv-t3')).toBe('tv'); expect(originalId('tv-d12')).toBe('tv'); expect(originalId('phone-1-t2')).toBe('phone-1'); expect(originalId('tv')).toBeNull(); expect(originalId('x0')).toBeNull(); expect(originalId('phone-1')).toBeNull(); });
test('compare needs both frames to exist', () => { const f = makeFrames(3); const t = { ...f[0]!, id: 'tv-t1' }; expect(compareSet([...f, t], 'tv-t1')).toEqual(['tv', 'tv-t1']); expect(compareSet(f, 'tv-t1')).toBeNull(); expect(compareSet([t], 'tv-t1')).toBeNull(); expect(compareSet(f, 'tv')).toBeNull(); });

test('diffSigs lists changed properties, text, added and removed elements; identical designs have no changes', () => {
  const a = { r: { style: 'color:red;width:10px', text: '' }, t: { style: '', text: 'hi' }, gone: { style: '', text: '' } }; const b = { r: { style: 'width:12px; color: red', text: '' }, t: { style: '', text: 'yo' }, fresh: { style: '', text: '' } };
  expect(diffSigs(a, b)).toEqual([{ el: 'r', kind: 'changed', props: ['width'] }, { el: 't', kind: 'changed', props: ['text'] }, { el: 'gone', kind: 'removed', props: [] }, { el: 'fresh', kind: 'added', props: [] }]);
  expect(diffSigs(a, a)).toEqual([]);
});

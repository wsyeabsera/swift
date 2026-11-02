import { expect, test } from 'vitest';
import { compareSet, originalId } from './compare';
import { makeFrames } from './fixtures';
test('original ids of takes and duplicates', () => { expect(originalId('tv-t3')).toBe('tv'); expect(originalId('tv-d12')).toBe('tv'); expect(originalId('phone-1-t2')).toBe('phone-1'); expect(originalId('tv')).toBeNull(); expect(originalId('x0')).toBeNull(); expect(originalId('phone-1')).toBeNull(); });
test('compare needs both frames to exist', () => { const f = makeFrames(3); const t = { ...f[0]!, id: 'tv-t1' }; expect(compareSet([...f, t], 'tv-t1')).toEqual(['tv', 'tv-t1']); expect(compareSet(f, 'tv-t1')).toBeNull(); expect(compareSet([t], 'tv-t1')).toBeNull(); expect(compareSet(f, 'tv')).toBeNull(); });

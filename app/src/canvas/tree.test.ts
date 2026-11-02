import { expect, test } from 'vitest';
import { firstChild, parentOf } from './tree';
const t = [{ id: 'tv', parent: null, depth: 0, tag: 'div', text: '' }, { id: 'clock', parent: 'tv', depth: 1, tag: 'div', text: '21:53' }, { id: 'recent', parent: 'tv', depth: 1, tag: 'div', text: '' }, { id: 'row1', parent: 'recent', depth: 2, tag: 'div', text: '' }];
test('parent and first child follow document order', () => { expect(parentOf(t, 'row1')).toBe('recent'); expect(parentOf(t, 'tv')).toBeNull(); expect(parentOf(t, 'nope')).toBeNull(); expect(firstChild(t, 'tv')).toBe('clock'); expect(firstChild(t, 'recent')).toBe('row1'); expect(firstChild(t, 'clock')).toBeNull(); });

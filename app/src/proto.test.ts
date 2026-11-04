import { expect, test } from 'vitest';
import { addLink, follow, MAX_LINKS, parseLinks, pruneLinks, removeLink, type Link } from './proto';
const l = (frame: string, el: string, to: string): Link => ({ frame, el, to });
test('a link replaces the one on the same element, and cannot point at its own frame', () => {
  let r = addLink([], l('a', 'btn', 'b')); if (!r.ok) throw new Error(); r = addLink(r.links, l('a', 'btn', 'c')); expect(r.ok && r.links).toEqual([l('a', 'btn', 'c')]); expect(addLink([], l('a', 'x', 'a'))).toMatchObject({ ok: false });
});
test('the innermost linked element wins; no link means null', () => { const links = [l('a', 'card', 'b'), l('a', 'btn', 'c')]; expect(follow(links, 'a', ['btn', 'card', 'a'])).toEqual(l('a', 'btn', 'c')); expect(follow(links, 'a', ['label', 'card'])).toEqual(l('a', 'card', 'b')); expect(follow(links, 'a', ['label'])).toBeNull(); expect(follow(links, 'other', ['btn'])).toBeNull(); });
test('removing and pruning', () => { const links = [l('a', 'x', 'b'), l('b', 'y', 'c')]; expect(removeLink(links, l('a', 'x', 'b'))).toEqual([l('b', 'y', 'c')]); expect(pruneLinks(links, ['a', 'b'])).toEqual([l('a', 'x', 'b')]); });
test('parseLinks keeps valid links only and caps the count', () => { expect(parseLinks([l('a', 'x', 'b'), { frame: 1 }, null, l('a', 'x', 'c'), l('b', 'q', 'b')])).toEqual([l('a', 'x', 'b')]); expect(parseLinks('nope')).toEqual([]); expect(parseLinks(Array.from({ length: MAX_LINKS + 20 }, (_, i) => l('a', `e${i}`, 'b')))).toHaveLength(MAX_LINKS); });

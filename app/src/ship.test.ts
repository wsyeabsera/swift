import { expect, test } from 'vitest';
import { isTarget, MAX_SHIP, pushShip, sanitizeShip, TARGETS, type ShipRec } from './ship';
const rec = (n: number): ShipRec => ({ at: n, kind: 'html', name: `f${n}.html`, detail: '1 KB', ok: true });
test('newest first, capped', () => { let l: ShipRec[] = []; for (let i = 0; i < MAX_SHIP + 5; i++) l = pushShip(l, rec(i)); expect(l).toHaveLength(MAX_SHIP); expect(l[0]!.at).toBe(MAX_SHIP + 4); });
test('stored data is untrusted: bad rows are dropped, long text is cut', () => { const r = sanitizeShip([rec(1), { at: 'x' }, null, 5, { ...rec(2), name: 'n'.repeat(500), ok: 'yes' }, { ...rec(3), detail: 'd'.repeat(500) }]); expect(r.map((x) => x.at)).toEqual([1, 3]); expect(r[1]!.detail).toHaveLength(160); expect(sanitizeShip('nope')).toEqual([]); });
test('targets are known ids, in run order, and every id is a target', () => { expect(TARGETS.map((t) => t.id)).toEqual(['artifact', 'html', 'react', 'tokens', 'project', 'glb', 'mp4']); expect(isTarget('glb')).toBe(true); expect(isTarget('rm -rf')).toBe(false); });

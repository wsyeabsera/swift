import test from 'node:test'; import assert from 'node:assert';
const re = (t, m) => t.map(x => m[x]);
test('maps tokens', () => assert.deepEqual(re([0, 1, 1], [10, 20]), [10, 20, 20]));
test('empty ok', () => assert.deepEqual(re([], [1]), []));

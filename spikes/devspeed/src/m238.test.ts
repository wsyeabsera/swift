import { expect, test } from 'vitest';
import { make238, f238 } from './m238';
test('m238', () => { expect(f238(make238(50))).toBeGreaterThan(0); });

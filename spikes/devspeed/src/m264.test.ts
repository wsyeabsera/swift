import { expect, test } from 'vitest';
import { make264, f264 } from './m264';
test('m264', () => { expect(f264(make264(50))).toBeGreaterThan(0); });

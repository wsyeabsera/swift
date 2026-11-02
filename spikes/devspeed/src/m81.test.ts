import { expect, test } from 'vitest';
import { make81, f81 } from './m81';
test('m81', () => { expect(f81(make81(50))).toBeGreaterThan(0); });

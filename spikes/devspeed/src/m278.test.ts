import { expect, test } from 'vitest';
import { make278, f278 } from './m278';
test('m278', () => { expect(f278(make278(50))).toBeGreaterThan(0); });

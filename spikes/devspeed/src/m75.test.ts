import { expect, test } from 'vitest';
import { make75, f75 } from './m75';
test('m75', () => { expect(f75(make75(50))).toBeGreaterThan(0); });

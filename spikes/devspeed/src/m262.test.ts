import { expect, test } from 'vitest';
import { make262, f262 } from './m262';
test('m262', () => { expect(f262(make262(50))).toBeGreaterThan(0); });

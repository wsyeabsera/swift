import { expect, test } from 'vitest';
import { make86, f86 } from './m86';
test('m86', () => { expect(f86(make86(50))).toBeGreaterThan(0); });

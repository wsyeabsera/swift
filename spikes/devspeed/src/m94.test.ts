import { expect, test } from 'vitest';
import { make94, f94 } from './m94';
test('m94', () => { expect(f94(make94(50))).toBeGreaterThan(0); });

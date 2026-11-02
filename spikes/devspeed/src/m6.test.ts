import { expect, test } from 'vitest';
import { make6, f6 } from './m6';
test('m6', () => { expect(f6(make6(50))).toBeGreaterThan(0); });

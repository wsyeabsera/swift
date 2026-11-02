import { expect, test } from 'vitest';
import { make23, f23 } from './m23';
test('m23', () => { expect(f23(make23(50))).toBeGreaterThan(0); });

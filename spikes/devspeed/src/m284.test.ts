import { expect, test } from 'vitest';
import { make284, f284 } from './m284';
test('m284', () => { expect(f284(make284(50))).toBeGreaterThan(0); });

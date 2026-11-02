import { expect, test } from 'vitest';
import { make53, f53 } from './m53';
test('m53', () => { expect(f53(make53(50))).toBeGreaterThan(0); });

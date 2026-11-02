import { expect, test } from 'vitest';
import { make95, f95 } from './m95';
test('m95', () => { expect(f95(make95(50))).toBeGreaterThan(0); });

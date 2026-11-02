import { expect, test } from 'vitest';
import { make275, f275 } from './m275';
test('m275', () => { expect(f275(make275(50))).toBeGreaterThan(0); });

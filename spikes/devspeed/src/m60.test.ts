import { expect, test } from 'vitest';
import { make60, f60 } from './m60';
test('m60', () => { expect(f60(make60(50))).toBeGreaterThan(0); });

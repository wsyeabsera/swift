import { expect, test } from 'vitest';
import { make173, f173 } from './m173';
test('m173', () => { expect(f173(make173(50))).toBeGreaterThan(0); });

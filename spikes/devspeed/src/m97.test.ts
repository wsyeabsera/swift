import { expect, test } from 'vitest';
import { make97, f97 } from './m97';
test('m97', () => { expect(f97(make97(50))).toBeGreaterThan(0); });

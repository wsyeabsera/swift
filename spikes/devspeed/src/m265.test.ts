import { expect, test } from 'vitest';
import { make265, f265 } from './m265';
test('m265', () => { expect(f265(make265(50))).toBeGreaterThan(0); });

import { expect, test } from 'vitest';
import { make64, f64 } from './m64';
test('m64', () => { expect(f64(make64(50))).toBeGreaterThan(0); });

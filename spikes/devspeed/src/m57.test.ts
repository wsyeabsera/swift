import { expect, test } from 'vitest';
import { make57, f57 } from './m57';
test('m57', () => { expect(f57(make57(50))).toBeGreaterThan(0); });

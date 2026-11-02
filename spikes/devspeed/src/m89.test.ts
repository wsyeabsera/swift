import { expect, test } from 'vitest';
import { make89, f89 } from './m89';
test('m89', () => { expect(f89(make89(50))).toBeGreaterThan(0); });

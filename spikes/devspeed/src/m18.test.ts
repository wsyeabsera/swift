import { expect, test } from 'vitest';
import { make18, f18 } from './m18';
test('m18', () => { expect(f18(make18(50))).toBeGreaterThan(0); });

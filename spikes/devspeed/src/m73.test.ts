import { expect, test } from 'vitest';
import { make73, f73 } from './m73';
test('m73', () => { expect(f73(make73(50))).toBeGreaterThan(0); });

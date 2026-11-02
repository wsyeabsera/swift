import { expect, test } from 'vitest';
import { make71, f71 } from './m71';
test('m71', () => { expect(f71(make71(50))).toBeGreaterThan(0); });

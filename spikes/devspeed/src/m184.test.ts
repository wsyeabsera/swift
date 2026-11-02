import { expect, test } from 'vitest';
import { make184, f184 } from './m184';
test('m184', () => { expect(f184(make184(50))).toBeGreaterThan(0); });

import { expect, test } from 'vitest';
import { make167, f167 } from './m167';
test('m167', () => { expect(f167(make167(50))).toBeGreaterThan(0); });

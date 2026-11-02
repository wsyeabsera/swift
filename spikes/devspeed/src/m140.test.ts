import { expect, test } from 'vitest';
import { make140, f140 } from './m140';
test('m140', () => { expect(f140(make140(50))).toBeGreaterThan(0); });

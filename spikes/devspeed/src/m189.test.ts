import { expect, test } from 'vitest';
import { make189, f189 } from './m189';
test('m189', () => { expect(f189(make189(50))).toBeGreaterThan(0); });

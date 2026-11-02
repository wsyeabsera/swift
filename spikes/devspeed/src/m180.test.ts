import { expect, test } from 'vitest';
import { make180, f180 } from './m180';
test('m180', () => { expect(f180(make180(50))).toBeGreaterThan(0); });

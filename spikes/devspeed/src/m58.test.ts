import { expect, test } from 'vitest';
import { make58, f58 } from './m58';
test('m58', () => { expect(f58(make58(50))).toBeGreaterThan(0); });

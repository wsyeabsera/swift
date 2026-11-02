import { expect, test } from 'vitest';
import { make283, f283 } from './m283';
test('m283', () => { expect(f283(make283(50))).toBeGreaterThan(0); });

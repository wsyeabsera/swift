import { expect, test } from 'vitest';
import { make40, f40 } from './m40';
test('m40', () => { expect(f40(make40(50))).toBeGreaterThan(0); });

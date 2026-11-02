import { expect, test } from 'vitest';
import { make136, f136 } from './m136';
test('m136', () => { expect(f136(make136(50))).toBeGreaterThan(0); });

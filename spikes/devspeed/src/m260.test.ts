import { expect, test } from 'vitest';
import { make260, f260 } from './m260';
test('m260', () => { expect(f260(make260(50))).toBeGreaterThan(0); });

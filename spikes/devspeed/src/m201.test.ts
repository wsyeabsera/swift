import { expect, test } from 'vitest';
import { make201, f201 } from './m201';
test('m201', () => { expect(f201(make201(50))).toBeGreaterThan(0); });

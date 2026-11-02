import { expect, test } from 'vitest';
import { make74, f74 } from './m74';
test('m74', () => { expect(f74(make74(50))).toBeGreaterThan(0); });

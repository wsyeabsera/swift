import { expect, test } from 'vitest';
import { make125, f125 } from './m125';
test('m125', () => { expect(f125(make125(50))).toBeGreaterThan(0); });

import { expect, test } from 'vitest';
import { make293, f293 } from './m293';
test('m293', () => { expect(f293(make293(50))).toBeGreaterThan(0); });

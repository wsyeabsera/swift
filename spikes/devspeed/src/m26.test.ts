import { expect, test } from 'vitest';
import { make26, f26 } from './m26';
test('m26', () => { expect(f26(make26(50))).toBeGreaterThan(0); });

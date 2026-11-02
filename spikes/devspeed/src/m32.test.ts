import { expect, test } from 'vitest';
import { make32, f32 } from './m32';
test('m32', () => { expect(f32(make32(50))).toBeGreaterThan(0); });

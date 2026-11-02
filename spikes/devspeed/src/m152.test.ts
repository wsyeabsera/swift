import { expect, test } from 'vitest';
import { make152, f152 } from './m152';
test('m152', () => { expect(f152(make152(50))).toBeGreaterThan(0); });

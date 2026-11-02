import { expect, test } from 'vitest';
import { make80, f80 } from './m80';
test('m80', () => { expect(f80(make80(50))).toBeGreaterThan(0); });

import { expect, test } from 'vitest';
import { make27, f27 } from './m27';
test('m27', () => { expect(f27(make27(50))).toBeGreaterThan(0); });

import { expect, test } from 'vitest';
import { make24, f24 } from './m24';
test('m24', () => { expect(f24(make24(50))).toBeGreaterThan(0); });

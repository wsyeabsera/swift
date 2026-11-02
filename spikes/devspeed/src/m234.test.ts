import { expect, test } from 'vitest';
import { make234, f234 } from './m234';
test('m234', () => { expect(f234(make234(50))).toBeGreaterThan(0); });

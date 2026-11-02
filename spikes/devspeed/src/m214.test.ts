import { expect, test } from 'vitest';
import { make214, f214 } from './m214';
test('m214', () => { expect(f214(make214(50))).toBeGreaterThan(0); });

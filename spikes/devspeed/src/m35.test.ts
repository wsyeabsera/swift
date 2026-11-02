import { expect, test } from 'vitest';
import { make35, f35 } from './m35';
test('m35', () => { expect(f35(make35(50))).toBeGreaterThan(0); });

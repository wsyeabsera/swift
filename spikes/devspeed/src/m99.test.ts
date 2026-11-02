import { expect, test } from 'vitest';
import { make99, f99 } from './m99';
test('m99', () => { expect(f99(make99(50))).toBeGreaterThan(0); });

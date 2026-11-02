import { expect, test } from 'vitest';
import { make237, f237 } from './m237';
test('m237', () => { expect(f237(make237(50))).toBeGreaterThan(0); });

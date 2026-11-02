import { expect, test } from 'vitest';
import { make190, f190 } from './m190';
test('m190', () => { expect(f190(make190(50))).toBeGreaterThan(0); });

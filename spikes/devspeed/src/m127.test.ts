import { expect, test } from 'vitest';
import { make127, f127 } from './m127';
test('m127', () => { expect(f127(make127(50))).toBeGreaterThan(0); });

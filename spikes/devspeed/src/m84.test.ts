import { expect, test } from 'vitest';
import { make84, f84 } from './m84';
test('m84', () => { expect(f84(make84(50))).toBeGreaterThan(0); });

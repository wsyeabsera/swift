import { expect, test } from 'vitest';
import { make296, f296 } from './m296';
test('m296', () => { expect(f296(make296(50))).toBeGreaterThan(0); });

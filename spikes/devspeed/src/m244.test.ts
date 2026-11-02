import { expect, test } from 'vitest';
import { make244, f244 } from './m244';
test('m244', () => { expect(f244(make244(50))).toBeGreaterThan(0); });

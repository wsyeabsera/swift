import { expect, test } from 'vitest';
import { make61, f61 } from './m61';
test('m61', () => { expect(f61(make61(50))).toBeGreaterThan(0); });

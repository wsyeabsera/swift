import { expect, test } from 'vitest';
import { make233, f233 } from './m233';
test('m233', () => { expect(f233(make233(50))).toBeGreaterThan(0); });

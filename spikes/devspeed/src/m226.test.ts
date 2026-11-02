import { expect, test } from 'vitest';
import { make226, f226 } from './m226';
test('m226', () => { expect(f226(make226(50))).toBeGreaterThan(0); });

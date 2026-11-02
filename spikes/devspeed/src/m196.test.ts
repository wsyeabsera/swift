import { expect, test } from 'vitest';
import { make196, f196 } from './m196';
test('m196', () => { expect(f196(make196(50))).toBeGreaterThan(0); });

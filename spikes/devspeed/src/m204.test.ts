import { expect, test } from 'vitest';
import { make204, f204 } from './m204';
test('m204', () => { expect(f204(make204(50))).toBeGreaterThan(0); });

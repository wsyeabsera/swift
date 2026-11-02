import { expect, test } from 'vitest';
import { make222, f222 } from './m222';
test('m222', () => { expect(f222(make222(50))).toBeGreaterThan(0); });

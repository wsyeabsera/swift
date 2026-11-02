import { expect, test } from 'vitest';
import { make103, f103 } from './m103';
test('m103', () => { expect(f103(make103(50))).toBeGreaterThan(0); });

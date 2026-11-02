import { expect, test } from 'vitest';
import { make104, f104 } from './m104';
test('m104', () => { expect(f104(make104(50))).toBeGreaterThan(0); });

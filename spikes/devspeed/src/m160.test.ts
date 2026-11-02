import { expect, test } from 'vitest';
import { make160, f160 } from './m160';
test('m160', () => { expect(f160(make160(50))).toBeGreaterThan(0); });

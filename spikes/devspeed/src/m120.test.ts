import { expect, test } from 'vitest';
import { make120, f120 } from './m120';
test('m120', () => { expect(f120(make120(50))).toBeGreaterThan(0); });

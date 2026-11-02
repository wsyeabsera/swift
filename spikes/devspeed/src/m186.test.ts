import { expect, test } from 'vitest';
import { make186, f186 } from './m186';
test('m186', () => { expect(f186(make186(50))).toBeGreaterThan(0); });

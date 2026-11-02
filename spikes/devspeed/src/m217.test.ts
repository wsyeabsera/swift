import { expect, test } from 'vitest';
import { make217, f217 } from './m217';
test('m217', () => { expect(f217(make217(50))).toBeGreaterThan(0); });

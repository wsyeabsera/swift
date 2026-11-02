import { expect, test } from 'vitest';
import { make166, f166 } from './m166';
test('m166', () => { expect(f166(make166(50))).toBeGreaterThan(0); });

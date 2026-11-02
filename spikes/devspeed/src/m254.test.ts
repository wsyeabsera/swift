import { expect, test } from 'vitest';
import { make254, f254 } from './m254';
test('m254', () => { expect(f254(make254(50))).toBeGreaterThan(0); });

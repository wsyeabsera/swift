import { expect, test } from 'vitest';
import { make227, f227 } from './m227';
test('m227', () => { expect(f227(make227(50))).toBeGreaterThan(0); });

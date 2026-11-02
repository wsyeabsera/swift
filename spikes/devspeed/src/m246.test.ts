import { expect, test } from 'vitest';
import { make246, f246 } from './m246';
test('m246', () => { expect(f246(make246(50))).toBeGreaterThan(0); });

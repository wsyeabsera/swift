import { expect, test } from 'vitest';
import { make100, f100 } from './m100';
test('m100', () => { expect(f100(make100(50))).toBeGreaterThan(0); });

import { expect, test } from 'vitest';
import { make138, f138 } from './m138';
test('m138', () => { expect(f138(make138(50))).toBeGreaterThan(0); });

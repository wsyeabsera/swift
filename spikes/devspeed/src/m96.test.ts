import { expect, test } from 'vitest';
import { make96, f96 } from './m96';
test('m96', () => { expect(f96(make96(50))).toBeGreaterThan(0); });

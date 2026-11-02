import { expect, test } from 'vitest';
import { make121, f121 } from './m121';
test('m121', () => { expect(f121(make121(50))).toBeGreaterThan(0); });

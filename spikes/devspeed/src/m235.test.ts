import { expect, test } from 'vitest';
import { make235, f235 } from './m235';
test('m235', () => { expect(f235(make235(50))).toBeGreaterThan(0); });

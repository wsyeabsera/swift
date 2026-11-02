import { expect, test } from 'vitest';
import { make164, f164 } from './m164';
test('m164', () => { expect(f164(make164(50))).toBeGreaterThan(0); });

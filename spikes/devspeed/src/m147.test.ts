import { expect, test } from 'vitest';
import { make147, f147 } from './m147';
test('m147', () => { expect(f147(make147(50))).toBeGreaterThan(0); });

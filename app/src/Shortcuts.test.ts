import { expect, test } from 'vitest';
import { SHORTCUTS } from './Shortcuts';
test('every shortcut is listed once with a description', () => { const keys = SHORTCUTS.map(([k]) => k); expect(new Set(keys).size).toBe(keys.length); expect(SHORTCUTS.every(([k, d]) => k.trim() && d.trim())).toBe(true); });

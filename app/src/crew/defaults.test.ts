import { expect, test } from 'vitest';
import { DEFAULT_CREW } from './defaults';
import { LIMITS, personaPrompt } from './sheet';
test('all five starter sheets load through the loader with distinct codenames', () => { expect(DEFAULT_CREW.map((s) => s.codename)).toEqual(['Marge', 'Hex', 'Dot', 'Zazz', 'Quill']); expect(new Set(DEFAULT_CREW.map((s) => s.voice)).size).toBe(5); });
test('each has 2-3 rules and at least one a local checker can verify; Quill checks the type scale and line length', () => {
  for (const s of DEFAULT_CREW) { expect(s.rules.length, s.codename).toBeGreaterThanOrEqual(2); expect(s.rules.length, s.codename).toBeLessThanOrEqual(3); expect(s.rules.some((r) => r.check), s.codename).toBe(true); }
  expect(DEFAULT_CREW.find((s) => s.codename === 'Quill')!.rules.flatMap((r) => (r.check ? [r.check] : []))).toEqual(['type-scale', 'line-length']); expect(DEFAULT_CREW.find((s) => s.codename === 'Hex')!.rules.some((r) => r.check === 'contrast')).toBe(true); expect(DEFAULT_CREW.find((s) => s.codename === 'Marge')!.rules.some((r) => r.check === 'grid')).toBe(true);
});
test('personas are short: the whole persona prompt stays under 450 characters', () => { for (const s of DEFAULT_CREW) { expect(s.persona.length).toBeLessThan(LIMITS.persona); expect(personaPrompt(s).length, s.codename).toBeLessThan(450); } });

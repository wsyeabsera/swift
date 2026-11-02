import { expect, test } from 'vitest';
import { suggestions } from './suggest';
import { localEdits } from './local';
const brand = { '--ac': '#0a84ff', '--ok': '#30d158', '--font': 'Inter', '--bg': 'rgb(1,2,3)' };
test('text elements get size, weight and brand colour chips; boxes without text size get fewer', () => {
  const t = suggestions({ 'font-size': '24px', 'font-weight': '400', opacity: '1' }, brand); expect(t.map((s) => s.label)).toEqual(['Bigger', 'Smaller', 'Bold', 'Hide', 'Text --ac', 'Text --ok']);
  expect(suggestions({ 'font-size': '24px', 'font-weight': '700', opacity: '1' }, {}).map((s) => s.label)).toEqual(['Bigger', 'Smaller', 'Hide']);
  expect(suggestions({ opacity: '1' }, brand).map((s) => s.label)).toEqual(['Hide']); expect(suggestions({ opacity: '0' }, {}).map((s) => s.label)).toEqual(['Show']); expect(suggestions({ 'font-size': '10px' }, brand, 3).length).toBe(3);
});
test('every suggestion is something the local tier answers (instant, no Claude)', async () => {
  for (const s of suggestions({ 'font-size': '24px', 'font-weight': '400', opacity: '1' }, brand)) expect(await localEdits(s.text, { get: async (p) => (p === 'font-size' ? '24px' : undefined) }), s.text).not.toBeNull();
});

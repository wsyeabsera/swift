import { expect, test } from 'vitest';
import { activeProject, addProject, baseName, DEFAULT_PROJECT, loadRegistry, sanitizeRegistry, saveRegistry, slug, switchProject } from './projects';
const fresh = () => loadRegistry({ getItem: () => null });
test('a fresh registry has tvdash, active', () => { expect(fresh()).toEqual({ active: 'tvdash', list: [DEFAULT_PROJECT] }); });
test('adding makes the project active; the same name reuses it; empty or symbol-only names are refused', () => {
  const a = addProject(fresh(), 'Research Radar')!; expect(a.active).toBe('research-radar'); expect(a.list.map((p) => p.name)).toEqual(['tvdash', 'Research Radar']);
  expect(addProject(a, 'research radar!')!.list.length).toBe(2); expect(addProject(a, '   ')).toBeNull(); expect(addProject(a, '!!!')).toBeNull();
});
test('switching to an unknown project changes nothing', () => { const a = addProject(fresh(), 'x1')!; expect(switchProject(a, 'tvdash').active).toBe('tvdash'); expect(switchProject(a, 'nope')).toBe(a); });
test('sanitize: junk, duplicates, bad ids, missing default and a dangling active id never break the registry', () => {
  expect(sanitizeRegistry(null)).toEqual(fresh()); expect(sanitizeRegistry({ active: 'ghost', list: [{ id: 'a b', name: 'bad' }, { id: 'ok', name: ' Ok ' }, { id: 'ok', name: 'dup' }, 5] })).toEqual({ active: 'tvdash', list: [DEFAULT_PROJECT, { id: 'ok', name: 'Ok' }] });
  expect(sanitizeRegistry({ active: 'ok', list: [{ id: 'ok', name: 'Ok' }] }).active).toBe('ok'); expect(sanitizeRegistry({ list: Array.from({ length: 80 }, (_, i) => ({ id: `p${i}`, name: 'n' })) }).list.length).toBeLessThanOrEqual(51);
});
test('persistence: round trip, corrupt, throwing storage', () => {
  const m: Record<string, string> = {}; const st = { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; } }; const a = addProject(fresh(), 'Auto Label')!;
  expect(saveRegistry(a, st)).toBeNull(); expect(loadRegistry(st)).toEqual(a); expect(activeProject(a).name).toBe('Auto Label'); m['swift-canvas.projects.v1'] = '{bad'; expect(loadRegistry(st)).toEqual(fresh());
  expect(saveRegistry(a, { setItem: () => { throw new Error('quota'); } })).toBe('quota'); expect(loadRegistry({ getItem: () => { throw new Error('b'); } })).toEqual(fresh());
});
test('slug and baseName', () => { expect(slug('My App_2!')).toBe('my-app-2'); expect(baseName('/Users/yab/Hobby/hearth/')).toBe('hearth'); expect(baseName('/')).toBe(''); });

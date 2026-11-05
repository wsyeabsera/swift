import { afterEach, expect, test, vi } from 'vitest';
import { firstSelection, motionMs, reducedMotion } from './a11y';
afterEach(() => vi.unstubAllGlobals());
const mm = (matches: boolean) => vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: matches && q.includes('reduce') }) });
test('reduced motion turns animated moves into jumps', () => { mm(true); expect(reducedMotion()).toBe(true); expect(motionMs(260)).toBe(0); });
test('normal motion keeps the duration', () => { mm(false); expect(reducedMotion()).toBe(false); expect(motionMs(260)).toBe(260); });
test('no matchMedia (tests, old shells) means normal motion', () => { vi.stubGlobal('window', {}); expect(motionMs(100)).toBe(100); });
test('Enter with nothing selected picks the first screen; no screens, nothing', () => { expect(firstSelection([{ id: 'a', root: 'r' }, { id: 'b', root: 's' }])).toEqual({ frameId: 'a', el: 'r' }); expect(firstSelection([])).toBeNull(); });

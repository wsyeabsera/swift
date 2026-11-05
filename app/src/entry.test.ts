import { describe, expect, it } from 'vitest';
import { lensForKey, parseEntry } from './entry';
const L = ['Design', 'Prototype', 'Motion'] as const;
const k = (key: string, o: object = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...o });
describe('parseEntry', () => {
  it('reads project, lens by name or number, say', () => { expect(parseEntry('#project=my-app&lens=3&say=1', L)).toEqual({ project: 'my-app', lens: 'Motion', say: true }); expect(parseEntry('#lens=prototype', L)).toEqual({ lens: 'Prototype' }); });
  it('ignores bad values', () => { expect(parseEntry('#project=../x&lens=9&say=0', L)).toEqual({}); expect(parseEntry('', L)).toEqual({}); });
});
describe('lensForKey', () => {
  it('maps plain digits only', () => { expect(lensForKey(k('2'), L)).toBe('Prototype'); expect(lensForKey(k('9'), L)).toBeNull(); expect(lensForKey(k('1', { metaKey: true }), L)).toBeNull(); expect(lensForKey(k('2', { shiftKey: true }), L)).toBeNull(); expect(lensForKey(k('a'), L)).toBeNull(); });
});
import { readFileSync } from 'node:fs';
describe('popup', () => {
  it('lists the same lenses, in the same order, as the app lens bar', () => {
    const lensesOf = (src: string) => /LENSES = (\[[^\]]*\])/.exec(src)?.[1]?.replace(/'/g, '"') ?? '';
    const app = JSON.parse(lensesOf(readFileSync('app/src/App.tsx', 'utf8'))); const popup = JSON.parse(lensesOf(readFileSync('extension/popup.js', 'utf8')));
    expect(popup).toEqual(app);
  });
  it('ships a popup, a side panel and a CSP-safe page (no inline script)', () => {
    const m = JSON.parse(readFileSync('extension/manifest.json', 'utf8')); expect(m.action.default_popup).toBe('popup.html'); expect(m.side_panel.default_path).toContain('app/index.html'); expect(m.permissions).toContain('sidePanel');
    expect(/<script(?![^>]*src=)/.test(readFileSync('extension/popup.html', 'utf8'))).toBe(false);
  });
});

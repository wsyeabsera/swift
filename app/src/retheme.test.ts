import { expect, test } from 'vitest';
import { retheme } from './retheme';
const radar = { '--bg': '#f4f6f8', '--fg': '#0b1220', '--accent': 'oklch(0.93 0.15 126)', '--card': '#ffffff', '--font': 'Inter' };
const tv = { '--bg': '#0b0b0f', '--text': '#f5f5f7', '--ac': '#0a84ff', '--ok': '#30d158' };
test('origin colours map to the target token of the same name or role, with a literal fallback', () => {
  const r = retheme('<div style="background:#F4F6F8;color:#0b1220"><b style="background:oklch(0.93 0.15 126)">x</b></div>', radar, tv);
  expect(r.html).toBe('<div style="background:var(--bg, #0b0b0f);color:var(--text, #f5f5f7)"><b style="background:var(--ac, #0a84ff)">x</b></div>'); expect(r.mapped).toBe(3);
});
test('literals with no matching role, non-colour tokens and identical values stay untouched', () => {
  const r = retheme('<i style="background:#ffffff;color:#111">x</i>', radar, tv); expect(r.html).toBe('<i style="background:#ffffff;color:#111">x</i>'); expect(r.mapped).toBe(0);
  expect(retheme('<p style="color:#0a84ff">x</p>', { '--ac': '#0a84ff' }, { '--ac': '#0a84ff' }).mapped).toBe(0); expect(retheme('<p>Inter</p>', { '--font': 'Inter' }, { '--font': 'Arial' }).html).toBe('<p>Inter</p>');
});
test('longer values win and nothing is replaced twice', () => {
  const r = retheme('<i style="color:#aabbccdd;background:#aabbcc">x</i>', { '--fg': '#aabbccdd', '--bg': '#aabbcc' }, { '--fg': '#000', '--bg': '#fff' }); expect(r.html).toBe('<i style="color:var(--fg, #000);background:var(--bg, #fff)">x</i>');
});
test('empty or unmappable token sets are a no-op', () => { expect(retheme('<b style="color:red">x</b>', {}, tv)).toEqual({ html: '<b style="color:red">x</b>', mapped: 0 }); expect(retheme('<b style="color:#123456">x</b>', { '--zzz': '#123456' }, tv).mapped).toBe(0); });

test('var() references of real apps map to the target kit by name or role, unmatched ones keep their origin value', () => {
  const origin = { '--bg': '#101010', '--accent': '#ff0000', '--odd': '#123456' }; const target = { '--base': '#202020', '--primary': '#00ff00' };
  const r = retheme('<div style="background:var(--bg);color:var(--accent);border-color:var(--odd, #000)">x</div>', origin, target);
  expect(r.html).toContain('background:var(--base, #202020)'); expect(r.html).toContain('color:var(--primary, #00ff00)'); expect(r.html).toContain('border-color:var(--odd, #123456)'); expect(r.mapped).toBe(3);
  expect(retheme('<p style="color:var(--unknown)">x</p>', origin, target)).toEqual({ html: '<p style="color:var(--unknown)">x</p>', mapped: 0 });
});

test('a var() whose fallback is itself a function (rgb(), oklch()) is still mapped', () => {
  const r = retheme('<p style="color:var(--fg, rgb(235, 235, 245));background:var(--bg,oklch(.2 .02 250))">x</p>', { '--fg': 'rgb(235, 235, 245)', '--bg': 'oklch(.2 .02 250)' }, { '--text': '#f5f5f7', '--base': '#101010' });
  expect(r.html).toBe('<p style="color:var(--text, #f5f5f7);background:var(--base, #101010)">x</p>'); expect(r.mapped).toBe(2);
});

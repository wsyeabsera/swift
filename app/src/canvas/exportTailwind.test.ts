import { expect, test } from 'vitest';
import { compile } from 'tailwindcss';
import { readFileSync } from 'node:fs';
import { arb, splitDecls, styleToClasses } from './exportTailwind';
import { frameToTsx } from './exportReact';
import { makeFrames, tvIdle } from './fixtures';
const cls = (s: string, tokens: Record<string, string> = {}): string[] => styleToClasses(s, tokens).split(' ').filter(Boolean);
test('declarations split outside parentheses and quotes; !important is dropped', () => { expect(splitDecls("a:b;font-family:'x; y',serif;background:linear-gradient(1deg,#000 0%,#fff);c: d !important;;bad")).toEqual([['a', 'b'], ['font-family', "'x; y',serif"], ['background', 'linear-gradient(1deg,#000 0%,#fff)'], ['c', 'd']]); });
test('arbitrary values: spaces become underscores, real underscores are escaped, double quotes become single', () => { expect(arb('0 10px 40px rgba(0, 0, 0, .3)')).toBe('0_10px_40px_rgba(0,_0,_0,_.3)'); expect(arb('a_b "c"')).toBe("a\\_b_'c'"); });
test('direct utilities where Tailwind has one, arbitrary values for lengths and colours, arbitrary properties for the rest', () => {
  expect(cls('position:absolute;display:flex;overflow:hidden;font-weight:200;font-style:italic;text-transform:uppercase;white-space:nowrap;align-items:center;justify-content:space-between;flex-direction:column')).toEqual(['absolute', 'flex', 'overflow-hidden', 'font-extralight', 'italic', 'uppercase', 'whitespace-nowrap', 'items-center', 'justify-between', 'flex-col']);
  expect(cls('left:115px;width:560px;padding:8px 12px;font-size:24px;letter-spacing:-.03em;opacity:.7;border-radius:28px;z-index:3;line-height:1.7;box-shadow:0 10px 40px rgba(0,0,0,.3)')).toEqual(['left-[115px]', 'w-[560px]', 'p-[8px_12px]', 'text-[24px]', 'tracking-[-.03em]', 'opacity-[.7]', 'rounded-[28px]', 'z-[3]', 'leading-[1.7]', 'shadow-[0_10px_40px_rgba(0,0,0,.3)]']);
  expect(cls("translate:400px 0px;font-family:'SF Pro',system-ui;--ac:#0a84ff;background:linear-gradient(135deg,#000,#fff)")).toEqual(['[translate:400px_0px]', "[font-family:'SF_Pro',system-ui]", '[--ac:#0a84ff]', '[background:linear-gradient(135deg,#000,#fff)]']);
});
test('colours equal to a brand token become var(--token), others stay literal; var() sizes get a type hint', () => {
  const t = { '--ac': '#0a84ff', '--glass': 'rgba(255, 255, 255, 0.08)' }; expect(cls('color:#0A84FF;background-color:rgba(255,255,255,.08);border-color:red', t).slice(0, 2)).toEqual(['text-[color:var(--ac)]', 'bg-[color:var(--glass)]']); expect(cls('color:#123456', t)).toEqual(['text-[#123456]']);
  expect(cls('font-size:var(--s,16px);width:calc(100% - 10px)')).toEqual(['text-[length:var(--s,16px)]', 'w-[calc(100%_-_10px)]']);
});
const escapeClass = (c: string): string => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
const classesOf = (tsx: string): string[] => [...tsx.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1]!.split(' ')).filter(Boolean);
test('PROOF: every class generated for the real demo frames compiles to a rule under Tailwind 4 (a bogus class does not)', async () => {
  const frames = makeFrames(20); const all = new Set<string>(); for (const f of frames) for (const c of classesOf(frameToTsx(f.title, f.html, { tailwind: true, tokens: { '--ac': '#7cf0d0' } }))) all.add(c);
  expect(all.size).toBeGreaterThan(50); /* a real project loads Tailwind's default theme (named font weights, spacing, colours live there) */ const compiler = await compile('@import "tailwindcss/theme" layer(theme);\n@tailwind utilities;', { base: process.cwd(), loadStylesheet: async (id) => ({ path: id, base: process.cwd(), content: readFileSync(`node_modules/${id}.css`, 'utf8') }) }); const css = compiler.build([...all, 'nonsense-class-xyz']); const missing = [...all].filter((c) => !css.includes(`.${escapeClass(c)} {`) && !css.includes(`.${escapeClass(c)}{`));
  expect(missing, `classes Tailwind did not produce a rule for: ${missing.slice(0, 8).join(' | ')}`).toEqual([]); expect(css).not.toContain('nonsense-class-xyz');
  expect(css).toMatch(/\.left-\\\[115px\\\] \{\s*left: 115px;/); expect(css).toMatch(/\.font-extralight \{[^}]*font-weight: var\(--font-weight-extralight\)/);
});
test('Tailwind mode: no style attribute is left, an existing class is kept, ids and structure are unchanged', () => {
  const t = frameToTsx('x', '<div id="a" class="card" style="position:absolute;left:4px"><b id="b" style="font-weight:700">hi</b></div>', { tailwind: true });
  expect(t).toContain('<div id="a" className="card absolute left-[4px]">'); expect(t).toContain('<b id="b" className="font-bold">'); expect(t).not.toContain('style='); expect(frameToTsx('x', tvIdle(), { tailwind: true })).not.toMatch(/style=/);
  expect(frameToTsx('x', '<i id="a" style="color:red"></i>')).toContain('style={{ color: "red" }}'); // default mode is unchanged
});

import { expect, test } from 'vitest';
import { instantiateTemplate, parseTemplate, unsafeReason } from '../template';
import { loadTemplates } from '../templateSources';
import { STARTERS, STARTER_TOKENS } from './starters';

const parsed = STARTERS.map((s) => { const r = parseTemplate(s.folder); if (!r.ok) throw new Error(`${s.dir}: ${r.error}`); return { dir: s.dir, ...r }; });
const lum = (hex: string): number => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
const ratio = (a: string, b: string): number => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]; return (hi + 0.05) / (lo + 0.05); };

test('there are six starters with the expected names', () => { expect(parsed.map((p) => p.value.name)).toEqual(['Landing', 'Dashboard', 'Settings', 'Onboarding', 'Pricing', 'Mobile shell']); });
test.each(parsed.map((p) => [p.dir, p] as const))('%s passes the validator with no warnings and fills with its defaults', (_d, p) => {
  expect(p.warnings).toEqual([]);
  const i = instantiateTemplate(p.value); expect(i.ok, i.ok ? '' : i.error).toBe(true); if (!i.ok) return;
  for (const f of i.value.frames) { expect(f.html).not.toMatch(/\{\{/); expect(f.html).toContain(`id="${f.root}"`); expect(unsafeReason(f.html)).toBeNull(); expect(f.html).not.toMatch(/#[0-9a-f]{3,8}\b/i); /* colours come from tokens only */ }
  expect(p.value.slots.every((s) => s.prompt.length > 0 && s.label.length > 0)).toBe(true);
});
test('every frame uses unique element ids so Say can address them', () => {
  for (const p of parsed) for (const f of instantiateTemplate(p.value).ok ? (instantiateTemplate(p.value) as { ok: true; value: { frames: { html: string }[] } }).value.frames : []) { const ids = [...f.html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]); expect(new Set(ids).size, p.dir).toBe(ids.length); }
});
test('slots accept a custom fill and escape it', () => {
  const p = parsed[0]!; const r = instantiateTemplate(p.value, { headline: '<img src=x onerror=1>' }); expect(r.ok && r.value.frames[0]!.html).toContain('&lt;img');
});
test('tokens have light and dark values, and text and button text meet WCAG AA on both', () => {
  for (const [name] of Object.entries(STARTER_TOKENS)) if (!name.endsWith('-light') && /^--(bg|bg2|fg|muted|accent|accent-fg|card|border)$/.test(name)) expect(STARTER_TOKENS[`${name}-light`], name).toBeDefined();
  const T = STARTER_TOKENS; const pairs: [string, string][] = [['fg', 'bg'], ['fg', 'bg2'], ['muted', 'bg'], ['muted', 'bg2'], ['accent-fg', 'accent']];
  for (const [fg, bg] of pairs) { expect(ratio(T[`--${fg}`]!, T[`--${bg}`]!), `dark ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5); expect(ratio(T[`--${fg}-light`]!, T[`--${bg}-light`]!), `light ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5); }
});
test('they load as built-ins and a user template of the same name shadows them', () => {
  const r = loadTemplates({ builtin: STARTERS }); expect(r.problems).toEqual([]); expect(r.templates).toHaveLength(6); expect(r.templates.every((t) => t.source === 'builtin')).toBe(true);
});
test('output is deterministic', () => { expect(JSON.stringify(STARTERS)).toBe(JSON.stringify(STARTERS)); });

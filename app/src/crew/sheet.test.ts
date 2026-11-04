import { expect, test } from 'vitest';
import { LIMITS, loadCrew, parseSheet, personaPrompt, type Sheet } from './sheet';
const good = (o: Record<string, string> = {}, body = 'Likes order.') => `---\ncodename: ${o.codename ?? 'Marge'}\nrole: ${o.role ?? 'Spacing designer'}\nvoice: ${o.voice ?? '"Dry, exact."'}\nspeciality: ${o.speciality ?? 'rhythm'}\nrules:\n${o.rules ?? '  - Use an 8px grid | check: grid\n  - Align left edges'}\n---\n${body}\n`;
const ok = (t: string, f = 'Marge.md') => { const r = parseSheet(t, f); if (!r.ok) throw new Error(r.error); return r.sheet; };
test('a good sheet loads: fields, quoted voice, rules with an optional named check, persona text', () => {
  expect(ok(good())).toEqual({ codename: 'Marge', role: 'Spacing designer', voice: 'Dry, exact.', speciality: 'rhythm', rules: [{ text: 'Use an 8px grid', check: 'grid' }, { text: 'Align left edges' }], persona: 'Likes order.' });
  expect(ok(good({}, '').replace(/\n$/, '')).persona).toBe(''); expect(ok(good().replace(/\n/g, '\r\n')).codename).toBe('Marge');
});
test('malformed sheets are refused whole with a reason that names the file', () => {
  const cases: [string, RegExp][] = [['no frontmatter', /must start with/], ['---\ncodename: A\n', /not closed/], [good({ codename: '' }), /"codename" is missing/], [good({ role: '' }), /"role" is missing/], [good({ codename: '9bad' }), /codename.*letters/], [good({ rules: '' }), /at least one item/], [good({ rules: '  - ' }), /rule is empty/], [good({ rules: '  - x | check: telepathy' }), /unknown check "telepathy"/], [good().replace('role:', 'job:'), /unknown field "job"/], [good().replace('---\ncodename', '---\ncodename: X\ncodename'), /twice/], [good().replace('rules:', 'rules: nope'), /followed by/], [good().replace('rules:', '  - stray\nrules:'), /outside "rules:"/], [good().replace('role: ', '??? '), /cannot read/]];
  for (const [t, re] of cases) { const r = parseSheet(t, 'crew/Marge.md'); expect(r.ok, t).toBe(false); if (!r.ok) { expect(r.error).toMatch(/^crew\/Marge\.md: /); expect(r.error).toMatch(re); } }
});
test('limits: oversize persona, long fields, too many rules, huge files, mismatched file name', () => {
  expect((parseSheet(good({}, 'x'.repeat(LIMITS.persona + 1)), 'Marge.md') as { error: string }).error).toMatch(/persona text is 601 characters/); expect(parseSheet(good({}, 'x'.repeat(LIMITS.persona)), 'Marge.md').ok).toBe(true);
  expect(parseSheet(good({ role: 'r'.repeat(61) }), 'Marge.md').ok).toBe(false); expect(parseSheet(good({ rules: Array.from({ length: 6 }, (_, i) => `  - rule ${i}`).join('\n') }), 'Marge.md').ok).toBe(false); expect(parseSheet(good({ rules: `  - ${'r'.repeat(121)}` }), 'Marge.md').ok).toBe(false);
  expect(parseSheet('x'.repeat(LIMITS.file + 1), 'Marge.md').ok).toBe(false); expect((parseSheet(good(), 'Hex.md') as { error: string }).error).toMatch(/must match the codename/); expect(parseSheet(good(), 'dir/marge.MD').ok).toBe(true);
});
const def = (n: string): Sheet => ({ codename: n, role: 'r', voice: 'v', speciality: 's', rules: [{ text: 'x' }], persona: '' });
test('project sheets override defaults by codename, bad sheets are reported and skipped, a duplicate codename is refused', () => {
  const c = loadCrew([def('Marge'), def('Hex')], [{ name: 'marge.md', text: good({ role: 'Mine' }) }, { name: 'Zed.md', text: good({ codename: 'Zed' }) }, { name: 'bad.md', text: 'nope' }, { name: 'MARGE.md', text: good() }]);
  expect(c.crew.map((s) => s.codename)).toEqual(['Marge', 'Hex', 'Zed']); expect(c.crew[0]!.role).toBe('Mine'); expect(c.overridden).toEqual(['Marge']); expect(c.errors).toHaveLength(2); expect(c.errors[0]).toMatch(/^bad\.md: must start/); expect(c.errors[1]).toMatch(/MARGE\.md: another sheet already uses the codename Marge/);
  expect(loadCrew([def('Hex')], []).crew).toHaveLength(1);
});
test('the persona prompt is short and carries the rules', () => { const p = personaPrompt(ok(good())); expect(p).toContain('You are Marge, Spacing designer.'); expect(p).toContain('- Use an 8px grid'); expect(p).toContain('Likes order.'); expect(p.length).toBeLessThan(400); });

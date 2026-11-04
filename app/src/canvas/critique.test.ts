import { expect, test } from 'vitest';
import { critiquePrompt, parseCritique, MAX_FINDINGS, MAX_NODES } from './critique';
import type { AuditFacts, AuditNode } from './bridge';
const n = (id: string, o: Partial<AuditNode> = {}): AuditNode => ({ id, tag: 'div', text: 'Hi', x: 100.4, y: 50, w: 200, h: 40, fs: 24, color: null, bg: null, clipX: false, clipY: false, interactive: false, ...o });
const facts = (nodes: AuditNode[]): AuditFacts => ({ w: 1920, h: 1080, nodes });
test('the prompt lists the elements, the problems already found, the format, and trims big screens', () => {
  const p = critiquePrompt(facts([n('clock', { text: 'a "quoted"\nline' }), n('date')]), 'TV', [{ el: 'date', kind: 'contrast', message: 'contrast 2:1' }]);
  expect(p).toContain('TV, 1920x1080px'); expect(p).toContain('clock <div> 100,50 200x40 24px "a  quoted  line"'); expect(p).toContain('- date: contrast 2:1'); expect(p).toContain('do NOT repeat'); expect(p).toContain('"fix"');
  expect(critiquePrompt(facts(Array.from({ length: 500 }, (_, i) => n(`e${i}`))), 'TV', []).split('\n').filter((l) => /^e\d+ </.test(l))).toHaveLength(MAX_NODES); expect(critiquePrompt(facts([]), 'TV', [])).toContain('- none');
});
test('valid findings pass, with a fix only when it is a plain css change', () => {
  const r = parseCritique('Here you go:\n```json\n[{"el":"clock","message":"The clock dwarfs the date; reduce the contrast in size.","fix":{"prop":"font-size","value":"160px"}},{"el":"date","message":"Date floats with no alignment to the clock"}]\n```', ['clock', 'date']);
  expect(r.rejected).toBe(0); expect(r.findings).toEqual([{ el: 'clock', kind: 'critique', message: 'The clock dwarfs the date; reduce the contrast in size.', fix: { prop: 'font-size', value: '160px' } }, { el: 'date', kind: 'critique', message: 'Date floats with no alignment to the clock' }]);
});
test('unknown ids, empty or long messages and extra findings are rejected and counted', () => {
  const many = Array.from({ length: MAX_FINDINGS + 3 }, () => ({ el: 'a', message: 'm' })); const r = parseCritique(JSON.stringify([{ el: 'ghost', message: 'x' }, { el: 'a', message: '' }, { el: 'a', message: 'y'.repeat(161) }, 7, null, ...many]), ['a']);
  expect(r.findings).toHaveLength(MAX_FINDINGS); expect(r.rejected).toBe(5 + 3);
});
test('unsafe fixes are dropped but the finding stays', () => {
  for (const [prop, value] of [['background', 'url(https://evil/x)'], ['color', 'red; position:fixed'], ['width', 'expression(alert(1))'], ['font-size', '1px } body{'], ['Color', 'red'], ['font size', '1px'], ['width', ''], ['margin', 'x'.repeat(81)], ['background-image', 'javascript:1']]) {
    const r = parseCritique(JSON.stringify([{ el: 'a', message: 'm', fix: { prop, value } }]), ['a']); expect(r.findings).toHaveLength(1); expect(r.findings[0]!.fix, `${prop}: ${value}`).toBeUndefined();
  }
});
test('anything that is not a JSON array is not trusted: empty answer is fine, prose is counted as rejected', () => {
  expect(parseCritique('[]', ['a'])).toEqual({ findings: [], rejected: 0 }); expect(parseCritique('', ['a'])).toEqual({ findings: [], rejected: 0 }); expect(parseCritique('Looks great!', ['a'])).toEqual({ findings: [], rejected: 1 }); expect(parseCritique('[{"el": broken', ['a'])).toEqual({ findings: [], rejected: 1 });
  expect(parseCritique('{"el":"a","message":"m"}', ['a']).findings).toEqual([]);
});

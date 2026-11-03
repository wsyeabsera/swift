import { describe, expect, it } from 'vitest';
import { isDue, parseProposals, refinePrompt, MAX_CHANGE } from './refine';
import type { SkillStat } from './telemetry';
const st = (o: Partial<SkillStat>): SkillStat => ({ skill: 'recolor', tier: 'claude', n: 10, p50: 3000, p95: 9000, failed: 0, undone: 0, ...o });
describe('refinePrompt', () => {
  it('null when nothing flagged', () => { expect(refinePrompt([st({ p95: 100 })], {})).toBeNull(); expect(refinePrompt([], {})).toBeNull(); });
  it('covers only flagged skills with numbers and JSON-lines instruction', () => {
    const p = refinePrompt([st({ undone: 4 }), st({ skill: 'fine', p95: 10 })], { recolor: 'RECOLOR PROMPT', fine: 'FINE PROMPT' })!;
    expect(p).toContain('recolor'); expect(p).toContain('RECOLOR PROMPT'); expect(p).not.toContain('FINE PROMPT');
    expect(p).toContain('p50 3000'); expect(p).toContain('p95 9000'); expect(p).toContain('undone 4'); expect(p).toContain('slow, often undone'); expect(p).toContain('JSON lines');
  });
  it('marks missing prompts', () => { expect(refinePrompt([st({})], {})).toContain('(not provided)'); });
});
describe('parseProposals', () => {
  const good = '{"skill":"recolor","problem":"slow","change":"shorten"}';
  it('handles fences and prose', () => {
    const r = parseProposals(`Here you go:\n\`\`\`json\n${good}\n\`\`\`\nHope it helps`, ['recolor']);
    expect(r.proposals).toEqual([{ skill: 'recolor', problem: 'slow', change: 'shorten' }]); expect(r.rejected).toEqual([]);
  });
  it('accepts a JSON array line', () => { expect(parseProposals(`[${good}]`, ['recolor']).proposals).toHaveLength(1); });
  it('rejects bad fields, long text, unknown skills, bad JSON', () => {
    const t = [good.replace('recolor', 'ghost'), '{"skill":"recolor","problem":1,"change":"x"}', `{"skill":"recolor","problem":"p","change":"${'x'.repeat(MAX_CHANGE + 1)}"}`, '{oops}', '{"skill":"recolor","problem":"p"}'].join('\n');
    const r = parseProposals(t, ['recolor']); expect(r.proposals).toEqual([]); expect(r.rejected).toHaveLength(5);
    expect(r.rejected.some((x) => x.includes('unknown skill'))).toBe(true);
  });
  it('empty text gives nothing', () => { expect(parseProposals('')).toEqual({ proposals: [], rejected: [] }); });
});
describe('isDue', () => {
  const D = 86_400_000;
  it('due when never run, after 7 days, or clock skew; not before', () => {
    expect(isDue(null, 1)).toBe(true); expect(isDue(0, 7 * D)).toBe(true); expect(isDue(0, 7 * D - 1)).toBe(false);
    expect(isDue(100, 50)).toBe(true); expect(isDue(0, 2 * D, 2)).toBe(true);
  });
});

it('a skill echoed with its tier in parentheses ("say (claude)") still maps to the skill; the prompt names the exact skills', () => {
  const r = parseProposals('{"skill":"say (claude)","problem":"slow","change":"shorter prompt"}', ['say', 'local']); expect(r.rejected).toEqual([]); expect(r.proposals.map((p) => p.skill)).toEqual(['say']);
  expect(parseProposals('{"skill":"nope (x)","problem":"p","change":"c"}', ['say']).rejected).toEqual(['nope (x): unknown skill']);
  const p = refinePrompt([{ skill: 'say', tier: 'claude', n: 10, p50: 1, p95: 9000, failed: 0, undone: 0 }], {})!; expect(p).toContain('exactly one of: say'); expect(p).toContain('### Skill: say\nTier: claude'); expect(p).not.toContain('say (claude)');
});

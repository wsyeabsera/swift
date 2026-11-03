/** Weekly skill refiner, pure half (#1694): builds the prompt and parses the answer. It never calls Claude (all Claude work goes through the local Claude Code login) and never applies a proposal. */
import { flags, type SkillStat } from './telemetry';
export type Proposal = { skill: string; problem: string; change: string };
export const MAX_PROBLEM = 300; export const MAX_CHANGE = 1500; const MAX_PROMPT_CHARS = 2000;
const DAY = 86_400_000;
/** True when no run happened yet, the clock went backwards past it, or `days` have passed. */
export const isDue = (lastRunAt: number | null, now: number, days = 7): boolean => lastRunAt === null || !Number.isFinite(lastRunAt) || now < lastRunAt || now - lastRunAt >= days * DAY;
/** One prompt covering only flagged skills; null when nothing is flagged. */
export function refinePrompt(stats: SkillStat[], currentPrompts: Record<string, string>): string | null {
  const hit = stats.map((s) => ({ s, f: flags(s) })).filter((x) => x.f.length > 0);
  if (hit.length === 0) return null;
  const blocks = hit.map(({ s, f }) => {
    const cur = Object.prototype.hasOwnProperty.call(currentPrompts, s.skill) ? currentPrompts[s.skill]!.slice(0, MAX_PROMPT_CHARS) : '(not provided)';
    return `### Skill: ${s.skill}\nTier: ${s.tier}\nFlags: ${f.join(', ')}\nEdits: ${s.n}, p50 ${Math.round(s.p50)} ms, p95 ${Math.round(s.p95)} ms, failed ${s.failed}, undone ${s.undone}\nCurrent prompt:\n${cur}`;
  });
  return `You review the edit skills of a design tool using local usage telemetry. Propose changes ONLY for the flagged skills below; do not mention any other skill.\n\n${blocks.join('\n\n')}\n\nAnswer as JSON lines, one object per line, no prose: {"skill": "<exactly one of: ${hit.map((x) => x.s.skill).join(', ')}>", "problem": "<what goes wrong>", "change": "<the prompt or skill change to make>"}. Keep problem under ${MAX_PROBLEM} characters and change under ${MAX_CHANGE}. A human reviews every proposal; nothing is applied automatically.`;
}
/** Tolerant parse of Claude's answer (fences, prose, a JSON array); invalid or unknown-skill proposals go to `rejected` with a reason. Never applies anything. */
export function parseProposals(text: string, known?: string[]): { proposals: Proposal[]; rejected: string[] } {
  const proposals: Proposal[] = []; const rejected: string[] = [];
  const objs: unknown[] = [];
  for (const raw of text.replace(/```[a-zA-Z]*/g, '\n').split('\n')) {
    const line = raw.trim().replace(/,$/, ''); if (!line) continue;
    if (line.startsWith('[')) { try { const a = JSON.parse(line) as unknown; if (Array.isArray(a)) { objs.push(...a); continue; } } catch { /* fall through */ } }
    if (!line.startsWith('{')) continue; // prose
    try { objs.push(JSON.parse(line)); } catch { rejected.push(`not valid JSON: ${line.slice(0, 80)}`); }
  }
  for (const o of objs) {
    const p = o as Partial<Proposal> | null; const name = typeof p?.skill === 'string' ? p.skill : '?';
    if (!p || typeof p !== 'object') { rejected.push('not an object'); continue; }
    if (typeof p.skill !== 'string' || !p.skill || p.skill.length > 40) { rejected.push('bad skill'); continue; }
    if (typeof p.problem !== 'string' || !p.problem.trim() || p.problem.length > MAX_PROBLEM) { rejected.push(`${name}: bad problem`); continue; }
    if (typeof p.change !== 'string' || !p.change.trim() || p.change.length > MAX_CHANGE) { rejected.push(`${name}: bad change`); continue; }
    const skill = p.skill.replace(/\s*\([^)]*\)\s*$/, '').trim(); // real Claude echoed the block header as "say (claude)"
    if (known && !known.includes(skill)) { rejected.push(`${name}: unknown skill`); continue; }
    proposals.push({ skill, problem: p.problem, change: p.change });
  }
  return { proposals, rejected };
}

// Manual check: the refiner prompt answered by the REAL local Claude Code (one Haiku call, same lean flags as the helper; uses a little subscription).
// Run: npx vite-node e2e/real-refine.mjs
import { spawnSync } from 'node:child_process';
import { refinePrompt, parseProposals } from '../app/src/refine';
import { summarize, addRecord, markUndone } from '../app/src/telemetry';
let recs = []; for (const ms of [9000, 11000, 12500, 9500, 14000, 10000]) recs = addRecord(recs, { at: 1, tier: 'claude', skill: 'say', model: 'claude-code', ms, ok: true }).list;
for (const r of recs.slice(0, 3)) recs = markUndone(recs, r.id); for (const ms of [2, 3, 2, 4, 3]) recs = addRecord(recs, { at: 1, tier: 'local', skill: 'local', model: 'rules', ms, ok: true }).list;
const stats = summarize(recs); const prompt = refinePrompt(stats, { say: 'You edit a live design by emitting one JSON op per line.' }); if (!prompt) throw new Error('nothing flagged');
const r = spawnSync('claude', ['-p', '--model', 'haiku', '--no-session-persistence', '--tools', '', '--disable-slash-commands', '--strict-mcp-config', '--setting-sources', 'project'], { input: prompt, encoding: 'utf8', env: { ...process.env, ANTHROPIC_API_KEY: '' }, cwd: '/tmp', timeout: 120000 });
const parsed = parseProposals(r.stdout, stats.map((s) => s.skill));
console.log(JSON.stringify({ exit: r.status, flagged: stats.map((s) => s.skill), proposals: parsed.proposals.map((p) => ({ skill: p.skill, problem: p.problem.slice(0, 90), change: p.change.slice(0, 90) })), rejected: parsed.rejected, rawHead: r.stdout.slice(0, 200) }, null, 1));

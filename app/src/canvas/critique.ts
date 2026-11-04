// Critique with Claude, AFTER the local pre-pass (audit.ts): Claude is shown the elements and the problems already found, and asked only for what needs judgment
// (hierarchy, spacing rhythm, alignment, clarity, copy). Its answer is parsed strictly: JSON findings about KNOWN element ids, with an optional single CSS fix that must look safe.
import type { AuditFacts } from './bridge';
import type { Finding } from './audit';
export const MAX_FINDINGS = 12; export const MAX_NODES = 60;
export type Critique = Finding & { kind: 'critique' };
export const CRITIQUE_SYSTEM = 'You are a senior product designer reviewing one screen. Answer only with a JSON array and nothing else.';
const r = (n: number): number => Math.round(n);
/** The prompt: the surface, a compact element table, the problems the local pass already found (not to be repeated), and the exact answer format. */
export function critiquePrompt(f: AuditFacts, surface: string, known: Finding[]): string {
  const rows = f.nodes.filter((n) => n.w > 0 && n.h > 0).slice(0, MAX_NODES).map((n) => `${n.id} <${n.tag}> ${r(n.x)},${r(n.y)} ${r(n.w)}x${r(n.h)}${n.fs ? ` ${r(n.fs)}px` : ''}${n.text ? ` "${n.text.replace(/["\n]/g, ' ')}"` : ''}`).join('\n');
  const done = known.length ? known.map((k) => `- ${k.el}: ${k.message}`).join('\n') : '- none';
  return `Screen: ${surface}, ${r(f.w)}x${r(f.h)}px. Elements (id, tag, x,y, size, font size, text):\n${rows}\n\nAlready found by automatic checks (do NOT repeat these):\n${done}\n\nGive at most ${MAX_FINDINGS} findings about visual hierarchy, spacing and alignment, balance, clarity or copy that those checks cannot see. Be specific and brief. Format: [{"el":"<an id from the list>","message":"<what is wrong and why, under 160 chars>","fix":{"prop":"<css property>","value":"<css value>"}}] where "fix" is optional and only for a single safe CSS change. If there is nothing worth saying answer [].`;
}
const PROP = /^[a-z]+(?:-[a-z]+){0,3}$/; const UNSAFE = /url\(|expression|javascript:|@import|<|>|\\|;|\{|\}|\/\*/i;
/** Claude's text -> findings: only ids in `ids`, messages 1-160 chars, fixes only when the property looks like a CSS property and the value like a plain value. Everything else is counted as rejected. */
export function parseCritique(text: string, ids: string[]): { findings: Critique[]; rejected: number } {
  const a = text.indexOf('['), b = text.lastIndexOf(']'); let raw: unknown; try { raw = a >= 0 && b > a ? JSON.parse(text.slice(a, b + 1)) : null; } catch { raw = null; } if (!Array.isArray(raw)) return { findings: [], rejected: text.trim() && text.trim() !== '[]' ? 1 : 0 };
  const known = new Set(ids); const findings: Critique[] = []; let rejected = 0;
  for (const x of raw) {
    const o = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>; if (typeof o.el !== 'string' || !known.has(o.el) || typeof o.message !== 'string' || !o.message.trim() || o.message.length > 160 || findings.length >= MAX_FINDINGS) { rejected++; continue; }
    const fx = (typeof o.fix === 'object' && o.fix !== null ? o.fix : null) as { prop?: unknown; value?: unknown } | null; const fix = fx && typeof fx.prop === 'string' && typeof fx.value === 'string' && PROP.test(fx.prop) && fx.value.length > 0 && fx.value.length <= 80 && !UNSAFE.test(fx.value) ? { prop: fx.prop, value: fx.value } : undefined;
    findings.push({ el: o.el, kind: 'critique', message: o.message.trim(), ...(fix ? { fix } : {}) });
  }
  return { findings, rejected };
}

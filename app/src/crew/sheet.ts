/** Crew sheets: a named designer as a small markdown file a team can share (`.swift-canvas/crew/<codename>.md`).
 *  ---\ncodename: Marge\nrole: ...\nvoice: ...\nspeciality: ...\nrules:\n  - a rule | check: grid\n---\npersona text
 *  Strict on purpose: a sheet is refused WHOLE with a reason naming its file; nothing is ever half-loaded. Persona text is capped because prompt size costs latency. Pure. */
export const CHECKS = ['contrast', 'grid', 'type-scale', 'line-length', 'density', 'palette'] as const; // verifiers the app can run locally (#1770); a rule may name one
export type CheckId = (typeof CHECKS)[number];
export type Rule = { text: string; check?: CheckId };
export type Sheet = { codename: string; role: string; voice: string; speciality: string; rules: Rule[]; persona: string };
export const LIMITS = { codename: 20, role: 60, voice: 100, speciality: 100, rule: 120, rules: 5, persona: 600, file: 20_000 } as const;
const KEYS = new Set(['codename', 'role', 'voice', 'speciality', 'rules']);
const unquote = (v: string): string => { const t = v.trim(); return /^(["']).*\1$/.test(t) && t.length >= 2 ? t.slice(1, -1) : t; };
export type SheetResult = { ok: true; sheet: Sheet } | { ok: false; error: string };
export function parseSheet(text: string, file: string): SheetResult {
  const fail = (m: string): SheetResult => ({ ok: false, error: `${file}: ${m}` });
  if (text.length > LIMITS.file) return fail(`file is larger than ${LIMITS.file} characters`); const lines = text.replace(/\r\n?/g, '\n').split('\n'); if (lines[0]!.trim() !== '---') return fail('must start with a "---" line (frontmatter)');
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---'); if (end < 0) return fail('frontmatter is not closed with a "---" line');
  const f: Record<string, string> = {}; const rules: string[] = []; let inRules = false;
  for (let i = 1; i < end; i++) {
    const line = lines[i]!; if (!line.trim()) continue; const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) { if (!inRules) return fail(`line ${i + 1}: a list item outside "rules:"`); rules.push(unquote(item[1]!)); continue; }
    const kv = /^([a-z]+):\s*(.*)$/.exec(line); if (!kv) return fail(`line ${i + 1}: cannot read "${line.trim().slice(0, 40)}"`); const [, k, v] = kv as unknown as [string, string, string];
    if (!KEYS.has(k)) return fail(`line ${i + 1}: unknown field "${k}" (allowed: ${[...KEYS].join(', ')})`); if (k in f || (k === 'rules' && inRules)) return fail(`line ${i + 1}: "${k}" appears twice`);
    if (k === 'rules') { inRules = true; if (v.trim()) return fail('"rules:" must be followed by "- " items on the next lines'); } else { inRules = false; f[k] = unquote(v); }
  }
  for (const k of ['codename', 'role', 'voice', 'speciality'] as const) { const v = f[k]; if (!v) return fail(`"${k}" is missing`); if (v.length > LIMITS[k]) return fail(`"${k}" is longer than ${LIMITS[k]} characters`); }
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(f.codename!)) return fail('"codename" must be letters, digits and dashes, starting with a letter');
  if (!rules.length) return fail('"rules" needs at least one item'); if (rules.length > LIMITS.rules) return fail(`"rules" has more than ${LIMITS.rules} items`);
  const parsed: Rule[] = []; for (const r of rules) {
    const m = /^(.*?)\s*\|\s*check:\s*([a-z-]+)\s*$/.exec(r); const text = (m ? m[1]! : r).trim(); if (!text) return fail('a rule is empty'); if (text.length > LIMITS.rule) return fail(`a rule is longer than ${LIMITS.rule} characters`);
    if (m && !(CHECKS as readonly string[]).includes(m[2]!)) return fail(`rule "${text.slice(0, 30)}": unknown check "${m[2]}" (known: ${CHECKS.join(', ')})`); parsed.push(m ? { text, check: m[2] as CheckId } : { text });
  }
  const persona = lines.slice(end + 1).join('\n').trim(); if (persona.length > LIMITS.persona) return fail(`the persona text is ${persona.length} characters; at most ${LIMITS.persona} (prompt size costs latency)`);
  const stem = file.replace(/^.*\//, '').replace(/\.md$/i, ''); if (stem.toLowerCase() !== f.codename!.toLowerCase()) return fail(`the file name must match the codename (expected ${f.codename}.md)`);
  return { ok: true, sheet: { codename: f.codename!, role: f.role!, voice: f.voice!, speciality: f.speciality!, rules: parsed, persona } };
}
export type CrewFile = { name: string; text: string };
export type Crew = { crew: Sheet[]; errors: string[]; overridden: string[] };
export const MAX_CREW = 20;
/** Bundled defaults plus a project's sheet files. A project sheet replaces a default of the same codename (case-insensitive); a bad sheet is reported and skipped, never half-loaded; a codename used twice in the project folder is refused on its second file. */
export function loadCrew(defaults: Sheet[], files: CrewFile[]): Crew {
  const errors: string[] = []; const overridden: string[] = []; const byName = new Map(defaults.map((s) => [s.codename.toLowerCase(), s])); const seen = new Set<string>(); let projectCount = 0;
  for (const f of files) {
    if (projectCount >= MAX_CREW) { errors.push(`${f.name}: more than ${MAX_CREW} sheets, the rest are ignored`); break; } const r = parseSheet(f.text, f.name); if (!r.ok) { errors.push(r.error); continue; }
    const key = r.sheet.codename.toLowerCase(); if (seen.has(key)) { errors.push(`${f.name}: another sheet already uses the codename ${r.sheet.codename}`); continue; }
    seen.add(key); projectCount++; if (byName.has(key)) overridden.push(byName.get(key)!.codename); byName.set(key, r.sheet);
  }
  return { crew: [...byName.values()], errors, overridden };
}
/** The persona as a short prompt block (codename, voice, rules, persona text), for a Spark take or a Claude Code subagent. */
export function personaPrompt(s: Sheet): string { return `You are ${s.codename}, ${s.role}. Voice: ${s.voice}. Speciality: ${s.speciality}.\nYour rules:\n${s.rules.map((r) => `- ${r.text}`).join('\n')}${s.persona ? `\n${s.persona}` : ''}`; }

/** Re-theme markup from one project's tokens to another's: every literal that equals an origin token value becomes `var(<target token>, <target value>)`, where the target token is the same name or the same ROLE (bg/background/surface, fg/text/ink, accent/primary, ...). The literal fallback keeps it working where the target root does not define the variable. */
const ROLES: string[][] = [['bg', 'background', 'base', 'surface', 'canvas'], ['fg', 'text', 'ink', 'foreground'], ['accent', 'primary', 'ac', 'brand'], ['muted', 'muted-fg', 'faint'], ['card', 'panel', 'surface-2'], ['border', 'line', 'stroke'], ['ok', 'success'], ['warn', 'warning'], ['danger', 'error']];
const bare = (n: string) => n.replace(/^--/, '').toLowerCase();
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(.+\)|hsla?\(.+\)|oklch\(.+\))$/i;
function targetFor(name: string, target: Record<string, string>): string | null {
  const b = bare(name); const exact = Object.keys(target).find((t) => bare(t) === b); if (exact) return exact;
  const role = ROLES.find((r) => r.includes(b)); if (!role) return null; return Object.keys(target).find((t) => role.includes(bare(t))) ?? null;
}
/** `var(--origin-token)` in real apps: points at the target kit's token of the same name or role (with its value as the fallback); a token the target has no match for keeps working by carrying the origin value as a fallback. */
function rethemeVars(html: string, origin: Record<string, string>, target: Record<string, string>): { html: string; mapped: number } {
  let mapped = 0; const out = html.replace(/var\(\s*(--[\w-]+)\s*(?:,(?:[^()]|\([^()]*\))*)?\)/g, (m, name: string) => { const ov = origin[name]?.trim(); if (ov === undefined) return m; const t = targetFor(name, target);
    if (t) { mapped++; return `var(${t}, ${target[t]!.trim()})`; } mapped++; return `var(${name}, ${ov})`; });
  return { html: out, mapped };
}
export function retheme(html: string, origin: Record<string, string>, target: Record<string, string>): { html: string; mapped: number } {
  const v = rethemeVars(html, origin, target); const l = rethemeLiterals(v.html, origin, target); return { html: l.html, mapped: v.mapped + l.mapped };
}
function rethemeLiterals(html: string, origin: Record<string, string>, target: Record<string, string>): { html: string; mapped: number } {
  const pairs = new Map<string, string>(); // lowercased origin literal -> replacement
  for (const [name, value] of Object.entries(origin)) {
    const v = value.trim(); if (!COLOR.test(v)) continue; const t = targetFor(name, target); if (!t) continue; const tv = target[t]!.trim(); if (v.toLowerCase() === tv.toLowerCase() || pairs.has(v.toLowerCase())) continue; pairs.set(v.toLowerCase(), `var(${t}, ${tv})`);
  }
  if (pairs.size === 0) return { html, mapped: 0 };
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const keys = [...pairs.keys()].sort((a, b) => b.length - a.length);
  let mapped = 0; const out = html.replace(new RegExp(keys.map(esc).join('|'), 'gi'), (m) => { mapped++; return pairs.get(m.toLowerCase())!; });
  return { html: out, mapped };
}

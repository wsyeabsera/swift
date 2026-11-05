/** Where smart templates come from: built in (in-memory folders), `~/.swift-canvas/templates/` (yours) and `<repo>/.swift-canvas/templates/` (shared in git). Later sources shadow earlier ones by name; a bad folder is reported, never silently dropped, and never hides the good ones. Node only (helper/CLI side). */
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_FRAME_HTML, MAX_MANIFEST, parseTemplate, type Template, type TemplateFolder } from './template';
export type TemplateSource = 'builtin' | 'user' | 'repo';
export type ListedTemplate = Template & { source: TemplateSource; dir: string; shadows?: TemplateSource[] };
export type Problem = { source: TemplateSource; dir: string; error: string };
const MAX_FOLDERS = 200;
/** One folder from disk: template.json and frames/*.html only; symlinks and non-files are skipped; oversize files are refused before being read. */
export function readTemplateFolder(dir: string): { ok: true; folder: TemplateFolder } | { ok: false; error: string } {
  const files: Record<string, string> = {};
  const take = (rel: string, abs: string, cap: number): string | null => { const st = lstatSync(abs, { throwIfNoEntry: false }); if (!st || !st.isFile()) return null; if (st.size > cap * 4) return `${rel} too large`; files[rel] = readFileSync(abs, 'utf8'); return null; };
  try {
    const e = take('template.json', join(dir, 'template.json'), MAX_MANIFEST); if (e) return { ok: false, error: e };
    const fdir = join(dir, 'frames'); const st = lstatSync(fdir, { throwIfNoEntry: false });
    if (st?.isDirectory()) for (const n of readdirSync(fdir).sort().slice(0, 100)) { if (!n.endsWith('.html')) continue; const e2 = take(`frames/${n}`, join(fdir, n), MAX_FRAME_HTML); if (e2) return { ok: false, error: e2 }; }
  } catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'unreadable folder' }; }
  return { ok: true, folder: { files } };
}
/** Template folders directly inside `root` (missing root = none). */
export function readTemplateRoot(root: string): { dir: string; result: ReturnType<typeof readTemplateFolder> }[] {
  let names: string[]; try { names = readdirSync(root).sort(); } catch { return []; }
  return names.slice(0, MAX_FOLDERS).map((n) => join(root, n)).filter((d) => lstatSync(d, { throwIfNoEntry: false })?.isDirectory()).map((dir) => ({ dir, result: readTemplateFolder(dir) }));
}
export type SourceInput = { builtin?: { dir: string; folder: TemplateFolder }[]; userDir?: string; repoDir?: string };
/** All templates, lowest to highest priority: builtin < user < repo. Duplicate names inside one source: the first (alphabetical folder) wins and the rest are problems. */
export function loadTemplates(input: SourceInput): { templates: ListedTemplate[]; problems: Problem[] } {
  const problems: Problem[] = []; const byName = new Map<string, ListedTemplate>();
  const add = (source: TemplateSource, dir: string, folder: TemplateFolder, seenHere: Set<string>): void => {
    const r = parseTemplate(folder); if (!r.ok) { problems.push({ source, dir, error: r.error }); return; }
    const key = r.value.name.toLowerCase(); if (seenHere.has(key)) { problems.push({ source, dir, error: `duplicate template name "${r.value.name}" in ${source}` }); return; } seenHere.add(key);
    const prev = byName.get(key); byName.set(key, { ...r.value, source, dir, ...(prev ? { shadows: [...(prev.shadows ?? []), prev.source] } : {}) });
  };
  const seenB = new Set<string>(); for (const b of input.builtin ?? []) add('builtin', b.dir, b.folder, seenB);
  for (const [source, root] of [['user', input.userDir], ['repo', input.repoDir]] as const) {
    if (!root) continue; const seen = new Set<string>();
    for (const { dir, result } of readTemplateRoot(root)) { if (result.ok) add(source, dir, result.folder, seen); else problems.push({ source, dir, error: result.error }); }
  }
  return { templates: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)), problems };
}

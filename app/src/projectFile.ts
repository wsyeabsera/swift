import { fitLog, parseDoc, parseLog } from './doc';
import type { Log } from './oplog';
import { toBrandTokens } from './brand';
import { slug } from './projects';
import { parseTimeline, type Timeline } from './motion';
import { parseLinks, type Link } from './proto';
import type { FrameDef } from './canvas/fixtures';
/** A portable project file: name, frames (with their current HTML) and the brand kit. Plain JSON, safe to commit to a repo. */
export const PROJECT_FILE_VERSION = 1; export const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** `log` = the undo history and branches (optional, same version-1 file: older readers ignore the extra key; a damaged log is dropped and the frames still open). */
export type ProjectFile = { name: string; frames: FrameDef[]; brand: Record<string, string>; log: Log | null; motion: Timeline | null; links: Link[] };
export function serializeProject(name: string, frames: FrameDef[], brand: Record<string, string>, log?: Log, motion?: Timeline, links?: Link[]): string {
  return JSON.stringify({ swiftCanvas: PROJECT_FILE_VERSION, name, brand, frames, ...(log ? { log: fitLog(log) } : {}), ...(motion && motion.tracks.length ? { motion } : {}), ...(links && links.length ? { links } : {}) }, null, 2) + '\n';
}
/** Untrusted file text -> a valid project or a reason it was refused. All-or-nothing. */
export function parseProjectFile(text: string): { ok: true; project: ProjectFile } | { ok: false; error: string } {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'file too large' };
  let raw: unknown; try { raw = JSON.parse(text); } catch { return { ok: false, error: 'not JSON' }; }
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  if (o.swiftCanvas !== PROJECT_FILE_VERSION) return { ok: false, error: 'not a Swift Canvas project file (or a newer version)' };
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : ''; if (!slug(name)) return { ok: false, error: 'project has no usable name' };
  const frames = parseDoc({ frames: o.frames }); if (!frames) return { ok: false, error: 'frames are missing or invalid' };
  const brand = toBrandTokens(Object.entries((typeof o.brand === 'object' && o.brand !== null ? o.brand : {}) as Record<string, unknown>).map(([n, v]) => ({ name: n, value: String(v) })));
  return { ok: true, project: { name, frames, brand, log: parseLog(o.log), motion: parseTimeline(o.motion), links: parseLinks(o.links) } };
}
export const projectFileName = (name: string): string => `${slug(name) || 'project'}.swiftcanvas.json`;

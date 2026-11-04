import { parseScene, type Scene3D } from './scene';
/** Say for the 3D lens: the scene is sent to Claude as JSON with the selected object marked, Claude answers with the whole edited scene as JSON, and the answer goes through the same strict parser as stored scenes (unknown shapes, bad colours and too many objects are dropped, a garbage answer is refused, nothing is half-applied). Pure. */
export const SCENE_SYSTEM = 'You edit a small 3D scene. The user sends the scene as JSON (objects with shape box|sphere|torus|cylinder|plane, position, rotation in degrees, scale, colour #rrggbb, metalness and roughness 0-1; lights ambient|directional|point with colour, intensity, position; an orbit camera; a background colour) and a request. Reply with ONE JSON object only: the complete edited scene in the same format, no prose, no code fences. Keep ids of objects you do not change. Only use the listed shapes and light kinds.';
export function scenePrompt(scene: Scene3D, request: string, selectedId: string | null): string {
  const target = selectedId && (scene.objects.some((o) => o.id === selectedId) || scene.lights.some((l) => l.id === selectedId)) ? `\nThe request is about the selected item: ${selectedId}.` : '';
  return `Scene:\n${JSON.stringify(scene)}${target}\nRequest: ${request.trim()}`;
}
/** The first balanced JSON object in a reply (Claude may wrap it in a fence or a sentence), or null. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf('{'); if (start < 0) return null; let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) { const ch = text[i]!; if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; } if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}' && --depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } } }
  return null;
}
export function parseSceneReply(text: string, before: Scene3D): { ok: true; scene: Scene3D; changed: boolean } | { ok: false; error: string } {
  const raw = extractJson(text); if (raw === null) return { ok: false, error: 'Claude did not answer with a scene' }; const scene = parseScene(raw); if (!scene) return { ok: false, error: 'Claude answered with something that is not a valid scene' };
  if (scene.objects.length === 0 && before.objects.length > 0) return { ok: false, error: 'Refused: the answer would remove every object' }; return { ok: true, scene, changed: JSON.stringify(scene) !== JSON.stringify(parseScene(before) ?? before) }; // compared after the same normalisation, so an unchanged answer reads as unchanged
}

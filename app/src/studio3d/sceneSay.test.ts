import { expect, test } from 'vitest';
import { starterScene } from './scene';
import { extractJson, parseSceneReply, scenePrompt, SCENE_SYSTEM } from './sceneSay';
test('the prompt carries the scene, the request and the selected item', () => {
  const p = scenePrompt(starterScene(), '  make it red ', 'box-1'); expect(p).toContain('"box-1"'); expect(p).toContain('Request: make it red'); expect(p).toContain('selected item: box-1'); expect(scenePrompt(starterScene(), 'x', 'nope')).not.toContain('selected item'); expect(SCENE_SYSTEM).toMatch(/ONE JSON object/);
});
test('extractJson finds the object in a fence or a sentence and survives braces inside strings', () => {
  expect(extractJson('Sure! ```json\n{"a": {"b": "}"}}\n``` done')).toEqual({ a: { b: '}' } }); expect(extractJson('no json here')).toBeNull(); expect(extractJson('{"a": ')).toBeNull();
});
test('a valid edited scene is accepted and flagged changed; the same scene is flagged unchanged', () => {
  const s = starterScene(); const edited = { ...s, objects: s.objects.map((o) => (o.id === 'box-1' ? { ...o, color: '#ff0000' } : o)) };
  const r = parseSceneReply(`Here you go: ${JSON.stringify(edited)}`, s); expect(r.ok && r.changed && r.scene.objects.find((o) => o.id === 'box-1')?.color).toBe('#ff0000'); const same = parseSceneReply(JSON.stringify(s), s); expect(same.ok && same.changed).toBe(false);
});
test('garbage, invalid pieces and a wipe-out are refused or cleaned, never half-applied', () => {
  const s = starterScene(); expect(parseSceneReply('I cannot do that', s)).toEqual({ ok: false, error: 'Claude did not answer with a scene' }); expect(parseSceneReply('{"x":1}', s).ok).toBe(false);
  expect(parseSceneReply(JSON.stringify({ ...s, objects: [] }), s)).toEqual({ ok: false, error: 'Refused: the answer would remove every object' });
  const bad = parseSceneReply(JSON.stringify({ ...s, objects: [...s.objects, { id: 'x', shape: 'cone', color: '#fff' }] }), s); expect(bad.ok && bad.scene.objects.length).toBe(s.objects.length);
});
